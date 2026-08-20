import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiSessionService } from './ai-session.service.js';
import { ToolRegistryService } from './tool-registry.js';
import { AgentStreamEvent, AgentTurnResult, ChatMessage, ChatToolCall, SourceInfo } from './types.js';

/** 单次 turn 最大 step 数（防无限循环） */
const MAX_STEPS = 4;
/** 瞬时错误重试上限（DSH「有界重试」） */
const MAX_RETRIES = 2;
/** 工具结果回填上下文上限（防上下文爆炸） */
const MAX_TOOL_OUTPUT_CHARS = 3000;

/** LLM 结构化失败载荷（DSH 同款） */
class LlmError extends Error {
  constructor(
    public code: 'timeout' | 'network' | 'http' | 'other',
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const RETRYABLE_CODES = new Set(['network', 'timeout', 'http']);

function isRetryable(e: unknown): boolean {
  if (e instanceof LlmError) {
    if (RETRYABLE_CODES.has(e.code)) {
      // http 错误仅 429 / 5xx 重试
      if (e.code === 'http' && e.status && e.status < 500 && e.status !== 429) return false;
      return true;
    }
    return false;
  }
  return false;
}

@Injectable()
export class AgentKernelService {
  private readonly logger = new Logger(AgentKernelService.name);

  constructor(
    private session: AiSessionService,
    private registry: ToolRegistryService,
    private prisma: PrismaService,
  ) {}

  /**
   * 执行一个 turn（用户一问 → 多 step 循环 → 回答）
   * 事件溯源：整个 turn 的全部 user/assistant/tool-call/tool-result/step/error 事件都追加进日志
   */
  async runTurn(opts: {
    sessionId: number;
    userId: number;
    input: string;
    config: { apiBaseUrl?: string; apiKey: string; modelVersion?: string; temperature?: number | null };
    emit: (e: AgentStreamEvent) => void;
  }): Promise<AgentTurnResult> {
    const { sessionId, userId, input, config, emit } = opts;
    const sources: SourceInfo[] = [];

    await this.session.maybeSetTitle(sessionId, input);
    await this.session.appendEvent(sessionId, { type: 'user', content: input });
    emit({ type: 'session', sessionId });

    let lastError: LlmError | null = null;
    let retries = 0;

    for (let step = 0; step < MAX_STEPS; step++) {
      await this.session.appendEvent(sessionId, { type: 'step', meta: { phase: 'start', step } });
      try {
        const llm = await this.executeStep({ sessionId, userId, input, config });

        if (llm.toolCalls.length > 0) {
          // 工具调用步：模型"思考"内容发 thinking 事件（前端可单独展示），不进答案气泡
          if (llm.content) emit({ type: 'thinking', content: llm.content });
          // 有工具调用 → 执行并回填，继续循环
          const executed = await this.executeTools({ sessionId, userId, toolCalls: llm.toolCalls, emit, sources });
          await this.session.appendEvent(sessionId, { type: 'step', meta: { phase: 'end', step, toolExecuted: executed } });
          // 全部工具失败且模型无输出 → 中断，避免空转
          if (!executed && !llm.content) {
            const msg = '我在处理您的请求时遇到了一些问题，请稍后再试。';
            await this.session.appendEvent(sessionId, { type: 'assistant', content: msg });
            emit({ type: 'delta', content: msg });
            emit({ type: 'done' });
            return { answer: msg, sources };
          }
          continue;
        }

        // 正常回答（assistant 事件已在 executeStep 内记录）——流式输出 delta
        const answer = llm.content || '（未生成回答，请重试）';
        this.emitDeltas(answer, emit);
        await this.session.appendEvent(sessionId, { type: 'step', meta: { phase: 'end', step, toolExecuted: false } });
        emit({ type: 'done' });
        return { answer, sources };
      } catch (e) {
        lastError = e instanceof LlmError ? e : new LlmError('other', (e as Error)?.message || '未知错误');
        await this.session.appendEvent(sessionId, { type: 'error', content: `step ${step}: ${lastError.message}` });

        if (isRetryable(e) && retries < MAX_RETRIES) {
          retries++;
          this.logger.warn(`LLM 瞬时错误重试 ${retries}/${MAX_RETRIES}：${lastError.message}`);
          continue; // 有界重试 = 新 step
        }
        break; // 不可重试或重试耗尽
      }
    }

    // 循环耗尽仍未成功
    if (lastError) {
      // 错误重试耗尽 → 友好错误
      const errText = this.friendlyError(lastError);
      await this.session.appendEvent(sessionId, { type: 'error', content: errText });
      emit({ type: 'error', error: errText });
      return { answer: errText, sources, error: errText };
    }
    // 步数耗尽（模型持续调工具）→ 诚实说明检索不足
    const exhaustedMsg = '我已经尽力检索了教材和题库，但仍未找到足够信息来回答您的问题。请换个问法，或直接咨询您的培训老师。';
    await this.session.appendEvent(sessionId, { type: 'assistant', content: exhaustedMsg });
    emit({ type: 'delta', content: exhaustedMsg });
    emit({ type: 'done' });
    return { answer: exhaustedMsg, sources };
  }

  // ── 单步执行 ──

  private async executeStep(opts: {
    sessionId: number;
    userId: number;
    input: string;
    config: { apiBaseUrl?: string; apiKey: string; modelVersion?: string; temperature?: number | null };
  }): Promise<{ content: string; toolCalls: ChatToolCall[] }> {
    const { sessionId, userId, input, config } = opts;

    const history = await this.session.deriveMessages(sessionId);
    const systemPrompt = this.buildSystemPrompt(userId);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input }];
    const tools = this.registry.schemas();

    const result = await this.callLLMStream(config, messages, tools);

    // 记录 assistant 事件（工具调用或纯文本）——OpenAI 序列完整性依赖此事件
    if (result.toolCalls.length > 0) {
      await this.session.appendEvent(sessionId, {
        type: 'assistant',
        content: result.content || null,
        meta: { toolCalls: result.toolCalls },
      });
    } else if (result.content) {
      await this.session.appendEvent(sessionId, { type: 'assistant', content: result.content });
    }
    return result;
  }

  // ── 工具执行 ──

  private async executeTools(opts: {
    sessionId: number;
    userId: number;
    toolCalls: ChatToolCall[];
    emit: (e: AgentStreamEvent) => void;
    sources: SourceInfo[];
  }): Promise<number> {
    const { sessionId, userId, toolCalls, emit, sources } = opts;
    let executed = 0;

    for (const tc of toolCalls) {
      const tool = this.registry.get(tc.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {}

      await this.session.appendEvent(sessionId, {
        type: 'tool-call',
        toolCallId: tc.id,
        toolName: tc.function.name,
        toolArguments: args,
      });

      if (!tool) {
        const err = { error: `未知工具：${tc.function.name}` };
        await this.session.appendEvent(sessionId, { type: 'tool-result', toolCallId: tc.id, toolResult: err });
        emit({ type: 'step', toolName: tc.function.name, toolArgs: args });
        continue;
      }

      emit({ type: 'step', toolName: tc.function.name, toolArgs: args });
      try {
        const result = await tool.handler(args, { userId, sessionId });
        if (result.sources?.length) {
          sources.push(...result.sources);
          emit({ type: 'sources', sources: result.sources });
        }
        await this.session.appendEvent(sessionId, {
          type: 'tool-result',
          toolCallId: tc.id,
          toolName: tc.function.name,
          toolResult: this.trimOutput(result.output),
        });
        executed++;
      } catch (e) {
        this.logger.warn(`工具 ${tc.function.name} 执行失败：${(e as Error)?.message}`);
        await this.session.appendEvent(sessionId, {
          type: 'tool-result',
          toolCallId: tc.id,
          toolName: tc.function.name,
          toolResult: { error: `工具执行失败：${(e as Error)?.message?.slice(0, 200)}` },
        });
      }
    }
    return executed;
  }

  // ── LLM 调用（流式 + function calling）──

  private async callLLMStream(
    config: { apiBaseUrl?: string; apiKey: string; modelVersion?: string; temperature?: number | null },
    messages: ChatMessage[],
    tools: { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }[],
  ): Promise<{ content: string; toolCalls: ChatToolCall[] }> {
    const baseUrl = (config.apiBaseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.modelVersion || 'deepseek-chat',
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: 2000,
          stream: true,
          tools,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if ((e as { name?: string }).name === 'AbortError') throw new LlmError('timeout', 'AI 请求超时');
      throw new LlmError('network', (e as Error)?.message || '网络错误');
    }
    clearTimeout(timeout);

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new LlmError('http', errText.slice(0, 120) || `HTTP ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();
    let buffer = '';
    let done = false;

    while (!done) {
      const { done: rd, value } = await reader.read();
      if (rd) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          done = true;
          break;
        }
        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = toolAcc.get(idx) || { id: '', name: '', args: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            toolAcc.set(idx, cur);
          }
        }
      }
    }

    const toolCalls: ChatToolCall[] = [...toolAcc.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, t]) => t.name)
      .map(([i, t]) => ({
        id: t.id || `call_${Date.now()}_${i}`,
        type: 'function',
        function: { name: t.name, arguments: t.args || '{}' },
      }));

    return { content, toolCalls };
  }

  // ── 系统提示 ──

  private buildSystemPrompt(userId: number): string {
    return `你是"🦊 狐学 AI 助教"，一个智能培训助教，服务 FoxLearn 在线培训平台的学员。

你有以下能力（通过工具实现，按需调用）：
1. search_knowledge —— 检索培训教材/知识库，回答知识性问题前先检索，只基于检索到的内容回答，不编造
2. get_recent_wrong —— 学员问"错在哪/薄弱环节/复习建议"时调用，获取其个人错题与薄弱知识点
3. get_question_detail —— 学员提到某道具体题目时调用，获取题目完整信息再讲解

工作守则：
- 知识性问题：先调 search_knowledge 检索教材，再基于检索内容作答，并引用来源
- 个人学习问题：先调 get_recent_wrong 了解情况，再给出针对性建议
- 检索纪律：search_knowledge 同一问题最多检索 2 次；若返回"未找到相关内容"，不要反复换关键词重试，而是直接说明教材中未找到相关信息，并结合你自己的知识给出一般性解答（明确标注这是常识性回答而非教材内容）
- 回答用通俗语言 + Markdown 格式，适当举例
- 与培训学习完全无关的问题，礼貌引导回学习话题
- 如一次回答不完整可多次调用工具，直到信息充分`;
  }

  // ── 工具 ──

  /** 最终答案分片输出为 delta（前端逐片追加，观感流式） */
  private emitDeltas(answer: string, emit: (e: AgentStreamEvent) => void): void {
    const CHUNK = 120;
    for (let i = 0; i < answer.length; i += CHUNK) {
      emit({ type: 'delta', content: answer.slice(i, i + CHUNK) });
    }
  }

  private friendlyError(e: LlmError | null): string {
    if (!e) return 'AI 处理超时，请稍后重试。';
    const map: Record<string, string> = {
      timeout: 'AI 请求超时，请稍后重试。',
      network: 'AI 服务网络异常，请稍后重试。',
      http: `AI 服务暂时不可用（${e.status || ''}），请稍后重试。`,
    };
    return map[e.code] || `AI 请求出错：${e.message.slice(0, 100)}`;
  }

  private trimOutput(output: unknown): unknown {
    const s = typeof output === 'string' ? output : JSON.stringify(output ?? '');
    return s.length > MAX_TOOL_OUTPUT_CHARS ? s.slice(0, MAX_TOOL_OUTPUT_CHARS) + '…[已截断]' : output;
  }
}
