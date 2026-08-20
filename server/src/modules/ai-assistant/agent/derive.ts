import { ChatMessage, ChatToolCall, DerivedMessage } from './types.js';

/** 事件日志条目（与 AiSessionEvent 字段对齐，解耦 Prisma 便于单测） */
export interface EventLike {
  seq: number;
  type: string;
  role?: string | null;
  content?: string | null;
  toolCallId?: string | null;
  toolName?: string | null;
  toolArguments?: unknown;
  toolResult?: unknown;
  /** Prisma JsonValue 或任意对象；内部通过 toolCallsOf() 安全读取 */
  meta?: unknown;
}

/** 从 meta 中安全读取 toolCalls */
function toolCallsOf(meta: unknown): ChatToolCall[] | undefined {
  if (meta && typeof meta === 'object') {
    const tc = (meta as { toolCalls?: unknown }).toolCalls;
    if (Array.isArray(tc)) return tc as ChatToolCall[];
  }
  return undefined;
}

/** 派生窗口：只取最近 N 个事件（日志全留，派生截断——v1 压缩策略） */
export const DERIVE_WINDOW = 60;

/**
 * 从事件日志派生 LLM 消息数组（OpenAI 格式，含 tool_calls / tool 角色）
 * 「日志即真相、消息即投影」——DSH 会话表面的轻量实现
 */
export function deriveMessagesFromEvents(events: EventLike[]): ChatMessage[] {
  if (events.length === 0) return [];
  const window = events.slice(-DERIVE_WINDOW);
  const messages: ChatMessage[] = [];

  for (const ev of window) {
    if (ev.type === 'user' && ev.content) {
      messages.push({ role: 'user', content: ev.content });
    } else if (ev.type === 'assistant') {
      const toolCalls = toolCallsOf(ev.meta);
      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: ev.content ?? null, tool_calls: toolCalls });
      } else if (ev.content) {
        messages.push({ role: 'assistant', content: ev.content });
      }
    } else if (ev.type === 'tool-result' && ev.toolCallId) {
      messages.push({
        role: 'tool',
        tool_call_id: ev.toolCallId,
        content: typeof ev.toolResult === 'string' ? ev.toolResult : JSON.stringify(ev.toolResult ?? ''),
      });
    }
  }
  return messages;
}

/** 派生前端展示消息（user/assistant 纯文本 + 工具调用标注） */
export function deriveDisplayFromEvents(events: EventLike[]): DerivedMessage[] {
  const out: DerivedMessage[] = [];
  for (const ev of events) {
    if (ev.type === 'user' && ev.content) {
      out.push({ role: 'user', content: ev.content });
    } else if (ev.type === 'assistant') {
      const toolCalls = toolCallsOf(ev.meta);
      const callInfo = (toolCalls || []).map((t) => ({
        name: t.function.name,
        args: safeParse(t.function.arguments),
      }));
      if (ev.content) {
        out.push({ role: 'assistant', content: ev.content, toolCalls: callInfo.length ? callInfo : undefined });
      } else if (callInfo.length) {
        out.push({ role: 'assistant', content: `[已调用工具：${callInfo.map((c) => c.name).join(', ')}]`, toolCalls: callInfo });
      }
    }
  }
  return out;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
