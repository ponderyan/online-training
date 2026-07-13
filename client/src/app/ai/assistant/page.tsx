'use client';

import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/app-layout';

interface SourceItem {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter';
}

interface AskResponse {
  answer: string;
  sources: SourceItem[];
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
}

function renderMarkdown(text: string): string {
  return text
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

const GUIDE_QUESTIONS = [
  { icon: '📝', text: 'ITSS 认证的报名条件是什么？' },
  { icon: '🔎', text: '帮我解释一下符合性评估' },
  { icon: '❌', text: '练习题做错了怎么复习？' },
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

  const nextId = () => ++msgIdRef.current;

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }

      const data: AskResponse = await res.json();
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '网络异常，请重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
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

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 0px)', minHeight: '500px' }}>
        {/* Header */}
        <div className="text-center pt-6 pb-4 px-4 flex-shrink-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-700)' }}>🦊 AI 助教</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-400)' }}>
            基于教材原文的知识问答
          </p>
        </div>

        {/* 对话区域 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {/* 引导问题：仅在对话为空时显示 */}
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
                      <span className="text-sm leading-snug" style={{ color: 'var(--ink-600)' }}>
                        {g.text}
                      </span>
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
                    <div
                      className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                      style={{
                        background: 'var(--fox)',
                        color: '#fff',
                        maxWidth: '70%',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="flex gap-2.5" style={{ maxWidth: '85%' }}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: 'var(--fox-pale)' }}
                      >
                        🦊
                      </div>
                      <div className="min-w-0">
                        <div
                          className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed"
                          style={{
                            background: 'var(--paper-bright)',
                            border: '1px solid var(--ink-200)',
                            color: 'var(--ink-700)',
                          }}
                        >
                          <div
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        </div>
                        {/* 参考来源 */}
                        {msg.sources && msg.sources.length > 0 && (
                          <details className="mt-2">
                            <summary
                              className="text-xs cursor-pointer select-none"
                              style={{ color: 'var(--fox)' }}
                            >
                              参考来源（{msg.sources.length}）
                            </summary>
                            <div className="space-y-2 mt-2">
                              {msg.sources.map((source, i) => (
                                <div
                                  key={i}
                                  className="card p-2.5 text-xs"
                                  style={{ background: 'var(--paper)' }}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold" style={{ color: 'var(--fox)' }}>
                                      {source.materialName}
                                    </span>
                                    <span style={{ color: 'var(--ink-300)' }}>·</span>
                                    <span style={{ color: 'var(--ink-400)' }}>
                                      {source.chapterTitle}
                                    </span>
                                  </div>
                                  <div className="leading-relaxed" style={{ color: 'var(--ink-400)' }}>
                                    {source.content}
                                  </div>
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

            {/* 思考中动画 */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'var(--fox-pale)' }}
                  >
                    🦊
                  </div>
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{
                      background: 'var(--paper-bright)',
                      border: '1px solid var(--ink-200)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--ink-400)' }}>思考中</span>
                      <span className="flex gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: 'var(--fox)', animationDelay: '0ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: 'var(--fox)', animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: 'var(--fox)', animationDelay: '300ms' }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3 text-sm"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
                >
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入区：固定底部 */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t"
          style={{
            borderColor: 'var(--ink-100)',
            background: 'var(--paper-bright)',
          }}
        >
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
              style={{
                borderColor: 'var(--ink-100)',
                background: 'var(--paper)',
                color: 'var(--ink-700)',
                opacity: loading ? 0.6 : 1,
                maxHeight: '120px',
                minHeight: '44px',
              }}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex-shrink-0"
              style={{ background: loading ? 'var(--ink-300)' : 'var(--fox)' }}
            >
              {loading ? '…' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
