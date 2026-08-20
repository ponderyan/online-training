import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiSessionService } from './agent/ai-session.service.js';
import { AgentKernelService } from './agent/agent-kernel.service.js';
import { RetrievalService } from './agent/retrieval.service.js';
import { AgentStreamEvent, ChatMessage, SourceInfo } from './agent/types.js';

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** agent 流式问答入参 */
export interface AgentAskInput {
  question: string;
  userId: number;
  /** 已有会话（前端传入则忽略 history） */
  sessionId?: number;
  /** 前端历史（无 sessionId 时用于回放种子） */
  history?: ChatMessageInput[];
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private prisma: PrismaService,
    private retrieval: RetrievalService,
    private sessions: AiSessionService,
    private kernel: AgentKernelService,
  ) {}

  /**
   * 非流式问答（兼容旧接口，走混合检索 + 单轮）
   */
  async ask(question: string, userId: number, history: ChatMessageInput[] = []) {
    const config = await this.getActiveConfig();
    if (!config) {
      return { answer: '⚠️ AI 配置未设置。请先联系管理员在「系统管理 > AI 配置」中配置 API 密钥。', sources: [] };
    }

    const { context, sources } = await this.retrieval.buildContext(question);
    if (sources.length === 0) {
      return { answer: '教材中未找到与您问题相关的信息。请尝试换个问法或咨询您的培训老师。', sources: [] };
    }

    const studentProfile = await this.getStudentProfile(userId);
    const messages = this.buildMessages(config, question, context, history, studentProfile);
    const answer = await this.callLLM(config, messages);
    return { answer, sources };
  }

  /**
   * Agent 化流式问答（SSE）—— 事件溯源会话 + turn/step 循环 + 领域工具
   * 返回已格式化的 `data: {...}\n\n` 字节流，controller 原样转发
   */
  async askAgentStream(input: AgentAskInput): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();
    let cancelled = false;

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const emit = (e: AgentStreamEvent) => {
          if (cancelled) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        };
        try {
          await this.runAgent(input, emit);
        } catch (e) {
          this.logger.error(`agent 运行失败：${(e as Error)?.message}`);
          emit({ type: 'error', error: '服务器处理出错，请稍后重试。' });
        }
        if (!cancelled) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
      cancel: () => {
        cancelled = true;
      },
    });
  }

  /** 检索状态（health/管理员用） */
  async retrievalStatus() {
    return this.retrieval.status();
  }

  /** 重建嵌入索引（管理员） */
  async rebuildEmbeddings() {
    return this.retrieval.rebuildEmbeddings();
  }

  // ── 私有 ──

  private async runAgent(input: AgentAskInput, emit: (e: AgentStreamEvent) => void): Promise<void> {
    const config = await this.getActiveConfig();
    if (!config) {
      emit({ type: 'error', error: 'AI 配置未设置，请联系管理员。' });
      return;
    }

    // 会话解析：已有会话 → 直接用（忽略前端 history）；无会话 → 新建 + 历史种子回放
    let sessionId = input.sessionId;
    if (sessionId) {
      await this.sessions.assertOwned(input.userId, sessionId);
    } else {
      sessionId = (await this.sessions.create(input.userId)).id;
      const history = input.history || [];
      for (const m of history) {
        if (m.role === 'user' || m.role === 'assistant') {
          await this.sessions.appendEvent(sessionId, { type: m.role, content: m.content });
        }
      }
    }

    const result = await this.kernel.runTurn({
      sessionId,
      userId: input.userId,
      input: input.question,
      config,
      emit,
    });

    // 无工具调用且未流式输出时（降级路径），兜底 emit
    if (result.error && !input.sessionId) {
      // 错误已在 kernel 内 emit
    }
  }

  private async getActiveConfig() {
    return this.prisma.aiConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 构建 LLM messages（legacy 单轮：多轮历史 + P2-2 学员画像）
   */
  private buildMessages(config: any, question: string, context: string, history: ChatMessageInput[], studentProfile?: string): ChatMessage[] {
    let systemPrompt = `你是"🦊 狐学 AI 助教"，一个智能教材助教。
请基于以下教材内容回答用户的问题。

【教材内容】
${context}
`;

    if (studentProfile) {
      systemPrompt += `
【学员画像】
${studentProfile}
请根据学员的薄弱环节，在回答时优先引用其未掌握的知识点相关内容。
`;
    }

    systemPrompt += `
要求：
1. 只基于提供的教材内容回答，不要编造
2. 如果教材内容不足以回答问题，明确说"教材中未找到相关信息"
3. 用通俗易懂的语言解释，适当举例
4. 引用具体的教材章节来源
5. 回答使用 Markdown 格式
6. 如果用户的问题与教材完全无关，礼貌引导回学习话题`;

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: question });
    return messages;
  }

  /**
   * P2-2: 获取学员画像（薄弱知识点 + 最近错题）—— legacy 路径
   */
  private async getStudentProfile(userId: number): Promise<string | undefined> {
    try {
      const recentWrong = await this.prisma.practiceRecord.findMany({
        where: { studentId: userId, isCorrect: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          question: {
            include: { knowledgePoints: { include: { knowledgePoint: { select: { name: true } } } } },
          },
        },
      });

      if (recentWrong.length === 0) return undefined;

      const weakKps = new Map<string, number>();
      for (const record of recentWrong) {
        for (const qkp of (record as any).question?.knowledgePoints || []) {
          const name = qkp.knowledgePoint?.name;
          if (name) weakKps.set(name, (weakKps.get(name) || 0) + 1);
        }
      }

      if (weakKps.size === 0) return undefined;

      const sorted = [...weakKps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const profile = `薄弱知识点（近期错题统计）：${sorted.map(([name, count]) => `${name}(错${count}次)`).join('、')}`;
      return profile;
    } catch {
      return undefined;
    }
  }

  private async callLLM(config: any, messages: ChatMessage[]): Promise<string> {
    const baseUrl = config.apiBaseUrl || 'https://api.deepseek.com';
    const apiKey = config.apiKey;
    const model = config.modelVersion || 'deepseek-chat';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '未知错误');
        return `AI 请求失败 (${res.status})：${errText.slice(0, 100)}`;
      }

      const data: any = await res.json();
      return data.choices?.[0]?.message?.content || 'AI 未返回有效回答，请重试。';
    } catch (e: any) {
      if (e.name === 'AbortError') return 'AI 请求超时，请稍后重试。';
      return `AI 请求出错：${e.message || '未知错误'}`;
    }
  }
}
