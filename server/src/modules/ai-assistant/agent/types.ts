/**
 * AI 助教 Agent 内核 —— 共享类型
 * 设计来源：DSH 调研结论（事件溯源会话 + turn/step + 工具注册表），轻量落地
 */

/** 教材来源信息（前端「参考来源」展示用） */
export interface SourceInfo {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter' | 'question';
}

/** OpenAI 兼容工具调用声明 */
export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string }; // arguments 为 JSON 字符串
}

/** LLM 消息（含 function calling 三件套） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

/** 领域工具定义 */
export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema（OpenAI tools.parameters 直接透传） */
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{
    output: unknown;
    sources?: SourceInfo[];
  }>;
}

/** 工具执行上下文 */
export interface ToolContext {
  userId: number;
  sessionId: number;
}

/** SSE 事件（前端消费） */
export type AgentStreamEvent =
  | { type: 'session'; sessionId: number }
  | { type: 'thinking'; content: string }
  | { type: 'step'; toolName: string; toolArgs: unknown }
  | { type: 'delta'; content: string }
  | { type: 'sources'; sources: SourceInfo[] }
  | { type: 'error'; error: string }
  | { type: 'done' };

/** Agent 内核运行结果 */
export interface AgentTurnResult {
  answer: string;
  sources: SourceInfo[];
  error?: string;
}

/** 会话派生消息（供前端展示） */
export interface DerivedMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; args: unknown }[];
}
