'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '@/components/app-layout';

interface SourceItem {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter';
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  streaming?: boolean;
}

/** 简易 Markdown 渲染（安全：先转义 HTML） */
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 rounded p-2 my-1 text-xs overflow-x-auto"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 rounded px-1 text-xs">$1</code>')
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

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const nextId = () => ++msgIdRef.current;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // 构建历史（给后端做多轮上下文）
  const buildHistory = useCallback(() => {
    return messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q };
    const aiMsgId = nextId();
    const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMsg, aiMsg]);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/ask/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, history: buildHistory() }),
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
            if (parsed.type === 'delta') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: m.content + parsed.content } : m
              ));
            } else if (parsed.type === 'sources') {
              sources = parsed.sources || [];
            } else if (parsed.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: parsed.content, streaming: false } : m
              ));
            }
          } catch {}
        }
      }

      // 完成：附加 sources，关闭 streaming
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, sources, streaming: false } : m
      ));
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: m.content || '（已取消）', streaming: false } : m
        ));
      } else {
        const msg = e instanceof Error ? e.message : '网络异常，请重试';
        setError(msg);
        setMessages(prev => prev.filter(m => m.id !== aiMsgId));
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

  function handleClear() {
    setMessages([]);
    setError('');
  }

  const isEmpty = messages.length === 0 && !error;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 0px)', minHeight: '500px' }}>
        {/* Header */}
        <div className="text-center pt-6 pb-4 px-4 flex-shrink-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-700)' }}>🦊 AI 助教</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-400)' }}>
            基于教材原文的智能问答 · 支持多轮对话
          </p>
          {messages.length > 0 && (
            <button onClick={handleClear} className="mt-2 text-xs px-3 py-1 rounded-full border transition-colors"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-400)' }}>
              清空对话
            </button>
          )}
        </div>

        {/* 对话区域 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {/* 引导问题 */}
          {isEmpty && (
            <div className="max-w-lg mx-auto mt-4">
              <p className="text-center text-xs mb-4" style={{ color: 'var(--ink-300)' }}>
                你可以问我这些 👇
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GUIDE_QUESTIONS.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => handleGuideClick(g.text)}
                    className="card p-3.5 text-left transition-all hover:border-[var(--fox)]"
                    style={{ background: 'var(--paper-bright)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg flex-shrink-0">{g.icon}</span>
                      <span className="text-sm leading-snug" style={{ color: 'var(--ink-600)' }}>{g.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 消息气泡 */}
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                      style={{ background: 'var(--fox)', color: '#fff', maxWidth: '70%' }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="flex gap-2.5" style={{ maxWidth: '85%' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: 'var(--fox-pale)' }}>
                        🦊
                      </div>
                      <div className="min-w-0">
                        <div className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed"
                          style={{ background: 'var(--paper-bright)', border: '1px solid var(--ink-200)', color: 'var(--ink-700)' }}>
                          {msg.content ? (
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                          ) : msg.streaming ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: 'var(--ink-400)' }}>思考中</span>
                              <span className="flex gap-1">
                                {[0, 150, 300].map(d => (
                                  <span key={d} className="w-1.5 h-1.5 rounded-full animate-pulse"
                                    style={{ background: 'var(--fox)', animationDelay: `${d}ms` }} />
                                ))}
                              </span>
                            </div>
                          ) : null}
                          {/* 流式光标 */}
                          {msg.streaming && msg.content && (
                            <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse" style={{ background: 'var(--fox)' }} />
                          )}
                        </div>
                        {/* 参考来源 */}
                        {msg.sources && msg.sources.length > 0 && !msg.streaming && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer select-none" style={{ color: 'var(--fox)' }}>
                              参考来源（{msg.sources.length}）
                            </summary>
                            <div className="space-y-2 mt-2">
                              {msg.sources.map((source, i) => (
                                <div key={i} className="card p-2.5 text-xs" style={{ background: 'var(--paper)' }}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold" style={{ color: 'var(--fox)' }}>{source.materialName}</span>
                                    <span style={{ color: 'var(--ink-300)' }}>·</span>
                                    <span style={{ color: 'var(--ink-400)' }}>{source.chapterTitle}</span>
                                  </div>
                                  <div className="leading-relaxed" style={{ color: 'var(--ink-400)' }}>{source.content}</div>
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

            {/* 错误提示 */}
            {error && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 text-sm"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入区 */}
        <div className="flex-shrink-0 px-4 py-3 border-t" style={{ borderColor: 'var(--ink-100)', background: 'var(--paper-bright)' }}>
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题… (Enter 发送，Shift+Enter 换行)"
              disabled={loading}
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none"
              style={{ borderColor: 'var(--ink-100)', background: 'var(--paper)', color: 'var(--ink-700)', opacity: loading ? 0.6 : 1, maxHeight: '120px', minHeight: '44px' }}
            />
            {loading ? (
              <button onClick={handleStop}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors flex-shrink-0"
                style={{ background: '#ef4444' }}>
                停止
              </button>
            ) : (
              <button onClick={handleAsk} disabled={!question.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex-shrink-0"
                style={{ background: 'var(--fox)' }}>
                发送
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
