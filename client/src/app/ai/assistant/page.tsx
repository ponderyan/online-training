'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '@/components/app-layout';

interface SourceItem {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter' | 'question';
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  thinking?: string; // agent 思考过程（工具步旁白）
  workingNote?: string; // 工具活动提示（如"正在检索教材"）
  streaming?: boolean;
}

interface SessionItem {
  id: number;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 简易 Markdown 渲染（安全：先转义 HTML） */
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-[var(--paper-alt)] rounded p-2 my-1 text-xs overflow-x-auto"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-[var(--paper-alt)] rounded px-1 text-xs">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-2 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-2 mb-1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, '<br/>');
}

const GUIDE_QUESTIONS = [
  { icon: '📝', text: 'ITSS 认证的报名条件是什么？' },
  { icon: '🔎', text: '帮我解释一下符合性评估' },
  { icon: '📖', text: '这个教材的重点章节有哪些？' },
  { icon: '📜', text: '如何获取学时证明？' },
];

/** 工具名 → 活动提示 */
const TOOL_NOTE: Record<string, string> = {
  search_knowledge: '正在检索教材知识库…',
  get_recent_wrong: '正在分析你的错题与薄弱环节…',
  get_question_detail: '正在查询题目详情…',
};

function toolLabel(name: string): string {
  return TOOL_NOTE[name] || `正在使用 ${name}…`;
}

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 会话模式状态 ──
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const nextId = () => ++msgIdRef.current;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  /** 加载会话列表 */
  const loadSessions = useCallback(async () => {
    const t = token();
    try {
      const res = await fetch('/api/ai/sessions', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setSessions(await res.json());
    } catch {}
    setSessionsLoaded(true);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /** 新建会话（清空当前对话） */
  function handleNewChat() {
    abortRef.current?.abort();
    setMessages([]);
    setActiveSessionId(null);
    setError('');
    inputRef.current?.focus();
  }

  /** 切换到历史会话 */
  async function handleSelectSession(sessionId: number) {
    if (loading) return;
    abortRef.current?.abort();
    setError('');
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) {
        if (res.status === 404) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        }
        return;
      }
      const data = await res.json();
      const msgs: ChatMessage[] = (data.messages || []).map((m: any, i: number) => ({
        id: nextId(),
        role: m.role,
        content: m.content || '',
      }));
      setMessages(msgs);
      setActiveSessionId(sessionId);
      setShowSessions(false);
    } catch {}
  }

  /** 删除会话 */
  async function handleDeleteSession(sessionId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('删除该会话？此操作不可恢复。')) return;
    try {
      await fetch(`/api/ai/sessions/${sessionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    } catch {}
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setMessages([]);
      setActiveSessionId(null);
    }
  }

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q };
    const aiMsgId = nextId();
    const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '', streaming: true };

    setMessages((prev) => [...prev, userMsg, aiMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/ask/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify({ question: q, sessionId: activeSessionId ?? undefined }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('请求过于频繁，请稍后再试');
        }
        throw new Error(`请求失败 (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let sources: SourceItem[] = [];
      let thinking = '';
      let workingNote = '';
      let gotSession = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'session' && !gotSession) {
              // 服务端返回真实会话 id（新会话），后续消息归属该会话
              gotSession = true;
              if (parsed.sessionId) {
                setActiveSessionId(parsed.sessionId);
                setSessions((prev) => (prev.some((s) => s.id === parsed.sessionId) ? prev : [{ id: parsed.sessionId, title: q.slice(0, 40), preview: '', messageCount: 0, createdAt: '', updatedAt: '' }, ...prev]));
              }
            } else if (parsed.type === 'delta') {
              setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + parsed.content } : m)));
            } else if (parsed.type === 'thinking') {
              thinking += parsed.content || '';
            } else if (parsed.type === 'step') {
              const note = toolLabel(parsed.toolName || '');
              workingNote = note;
              setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, workingNote: note } : m)));
            } else if (parsed.type === 'sources') {
              sources = parsed.sources || [];
            } else if (parsed.type === 'error') {
              setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: parsed.content, streaming: false } : m)));
            }
          } catch {}
        }
      }

      // 完成：附加 sources / thinking，关闭 streaming
      setMessages((prev) => prev.map((m) =>
        m.id === aiMsgId ? { ...m, sources, thinking: thinking || undefined, workingNote: undefined, streaming: false } : m
      ));
      loadSessions(); // 刷新标题/预览
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') {
        setMessages((prev) => prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: m.content || '（已取消）', streaming: false } : m
        ));
      } else {
        const msg = e instanceof Error ? e.message : '网络异常，请重试';
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  function handleGuideClick(text: string) {
    setQuestion(text);
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !error;
  const activeTitle = sessions.find((s) => s.id === activeSessionId)?.title;

  return (
    <AppLayout>
      <div className="flex h-full" style={{ height: 'calc(100vh - 0px)', minHeight: '500px' }}>
        {/* ── 会话侧栏（桌面端） ── */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-[var(--ink-100)] bg-[var(--paper)]">
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full py-2 rounded-xl text-sm font-medium text-white bg-[var(--fox)] transition-colors hover:opacity-90"
            >
              + 新对话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {!sessionsLoaded ? (
              <div className="text-xs text-[var(--ink-300)] text-center py-4">加载中…</div>
            ) : sessions.length === 0 ? (
              <div className="text-xs text-[var(--ink-300)] text-center py-4">暂无历史会话</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={`group rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    activeSessionId === s.id ? 'bg-[var(--fox-pale)]' : 'hover:bg-[var(--ink-50)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-[var(--ink-600)] truncate">{s.title || '新对话'}</span>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--ink-300)] hover:text-[var(--error)] text-xs flex-shrink-0"
                      title="删除会话"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--ink-300)] truncate mt-0.5">{s.preview || s.messageCount + ' 条消息'}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── 主对话区 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="text-center pt-6 pb-4 px-4 flex-shrink-0">
            <div className="flex items-center justify-center gap-2">
              {/* 移动端会话入口 */}
              <button
                onClick={() => setShowSessions((v) => !v)}
                className="md:hidden text-xs px-2 py-1 rounded-lg border border-[var(--ink-200)] text-[var(--ink-400)]"
              >
                会话
              </button>
              <h1 className="text-[var(--ink-700)] text-2xl font-bold">🦊 AI 助教</h1>
            </div>
            <p className="text-[var(--ink-400)] mt-1 text-xs">
              智能助手 · 自动检索教材 · 支持多轮会话
            </p>
            {messages.length > 0 && (
              <button onClick={handleNewChat} className="mt-2 text-xs px-3 py-1 rounded-full border transition-colors border-[var(--ink-200)] text-[var(--ink-400)]">
                新对话
              </button>
            )}
          </div>

          {/* 移动端会话抽屉 */}
          {showSessions && (
            <div className="md:hidden border-b border-[var(--ink-100)] bg-[var(--paper)] px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
              <button onClick={() => { handleNewChat(); setShowSessions(false); }} className="w-full text-left text-sm text-[var(--fox)] py-1.5">
                + 新对话
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={`w-full text-left text-sm py-1.5 px-2 rounded ${activeSessionId === s.id ? 'bg-[var(--fox-pale)]' : ''}`}
                >
                  {s.title || '新对话'}
                </button>
              ))}
            </div>
          )}

          {/* 对话区域 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
            {isEmpty && (
              <div className="max-w-lg mx-auto mt-4">
                <p className="text-[var(--ink-300)] text-center text-xs mb-4">
                  {activeTitle ? `当前会话：${activeTitle}` : '你可以问我这些 👇'}
                </p>
                {!activeTitle && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GUIDE_QUESTIONS.map((g, i) => (
                      <button
                        key={i}
                        onClick={() => handleGuideClick(g.text)}
                        className="card p-3.5 text-left transition-all hover:border-[var(--fox)] bg-[var(--paper-bright)]"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg flex-shrink-0">{g.icon}</span>
                          <span className="text-[var(--ink-600)] text-sm leading-snug">{g.text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 消息气泡 */}
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm bg-[var(--fox)] text-[#fff]" style={{ maxWidth: '70%' }}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] flex gap-2.5">
                        <div className="bg-[var(--fox-pale)] w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0">🦊</div>
                        <div className="min-w-0">
                          {/* 工具活动提示 */}
                          {msg.workingNote && (
                            <div className="text-[11px] text-[var(--ink-300)] mb-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--fox)]" />
                              {msg.workingNote}
                            </div>
                          )}
                          <div
                            className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed bg-[var(--paper-bright)] text-[var(--ink-700)]"
                            style={{ border: '1px solid var(--ink-200)' }}
                          >
                            {msg.content ? (
                              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                            ) : msg.streaming ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--ink-400)] text-xs">思考中</span>
                                <span className="flex gap-1">
                                  {[0, 150, 300].map((d) => (
                                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--fox)]" style={{ animationDelay: `${d}ms` }} />
                                  ))}
                                </span>
                              </div>
                            ) : null}
                            {msg.streaming && msg.content && (
                              <span className="bg-[var(--fox)] inline-block w-0.5 h-4 ml-0.5 animate-pulse" />
                            )}
                          </div>
                          {/* 思考过程（可折叠） */}
                          {msg.thinking && !msg.streaming && (
                            <details className="mt-1">
                              <summary className="text-[var(--ink-300)] text-[11px] cursor-pointer select-none">思考过程</summary>
                              <div className="mt-1 text-[11px] text-[var(--ink-300)] leading-relaxed whitespace-pre-wrap">{msg.thinking}</div>
                            </details>
                          )}
                          {/* 参考来源 */}
                          {msg.sources && msg.sources.length > 0 && !msg.streaming && (
                            <details className="mt-2">
                              <summary className="text-[var(--fox)] text-xs cursor-pointer select-none">
                                参考来源（{msg.sources.length}）
                              </summary>
                              <div className="space-y-2 mt-2">
                                {msg.sources.map((source, i) => (
                                  <div key={i} className="bg-[var(--paper)] card p-2.5 text-xs">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[var(--fox)] font-semibold">{source.materialName || '教材'}</span>
                                      <span className="text-[var(--ink-300)]">·</span>
                                      <span className="text-[var(--ink-400)]">{source.chapterTitle}</span>
                                    </div>
                                    <div className="text-[var(--ink-400)] leading-relaxed">{source.content}</div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-[var(--error-pale)] text-[var(--error)]" style={{ border: '1px solid var(--verm)' }}>
                    {error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 输入区 */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--ink-100)] bg-[var(--paper-bright)]">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题… (Enter 发送，Shift+Enter 换行)"
                disabled={loading}
                rows={1}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none border-[var(--ink-100)] bg-[var(--paper)] text-[var(--ink-700)]"
                style={{ opacity: loading ? 0.6 : 1, maxHeight: '120px', minHeight: '44px' }}
              />
              {loading ? (
                <button onClick={handleStop} className="bg-[var(--error)] px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors flex-shrink-0">
                  停止
                </button>
              ) : (
                <button onClick={handleAsk} disabled={!question.trim()} className="bg-[var(--fox)] px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex-shrink-0">
                  发送
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
