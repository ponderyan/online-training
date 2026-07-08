'use client';

import { useState } from 'react';
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

function renderMarkdown(text: string): string {
  return text
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

const placeholderCards = [
  { icon: '💡', text: '基于教材的知识问答' },
  { icon: '📖', text: '学习辅导与答疑解惑' },
  { icon: '🎯', text: '错题分析与薄弱点诊断' },
  { icon: '📊', text: '个性化学习路径推荐' },
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setHasAsked(true);
    setSubmittedQuestion(q);
    setAnswer('');
    setSources([]);
    setSourcesOpen(false);

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
      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '网络异常，请重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--ink-700)' }}>🦊 AI 助教</h1>
          <p className="mt-2" style={{ color: 'var(--ink-400)' }}>
            基于教材原文的知识问答
          </p>
        </div>

        {/* Initial state: smaller placeholder cards */}
        {!hasAsked && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 max-w-lg mx-auto">
            {placeholderCards.map((card, i) => (
              <div
                key={i}
                className="card p-3 text-center"
                style={{ background: 'var(--bg-card)' }}
              >
                <div className="text-xl mb-1">{card.icon}</div>
                <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                  {card.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submitted question display */}
        {hasAsked && !loading && (
          <div
            className="card p-4 mb-6"
            style={{ background: 'var(--bg-card)', borderLeft: '4px solid var(--fox)' }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--ink-400)' }}>我的提问</div>
            <div className="text-sm" style={{ color: 'var(--ink-600)' }}>{submittedQuestion}</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-4 mb-6" style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
            <div className="text-sm" style={{ color: '#dc2626' }}>{error}</div>
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div
            className="card p-5 mb-6"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="text-xs font-semibold mb-3" style={{ color: 'var(--ink-400)' }}>AI 回答</div>
            <div
              className="text-sm leading-relaxed"
              style={{ color: 'var(--ink-600)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }}
            />
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-2 text-sm font-medium w-full text-left px-1 py-2"
              style={{ color: 'var(--ink-500)' }}
            >
              <span style={{ transform: sourcesOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
              参考来源（{sources.length}）
            </button>
            {sourcesOpen && (
              <div className="space-y-3 mt-2">
                {sources.map((source, i) => (
                  <div
                    key={i}
                    className="card p-3 text-sm"
                    style={{ background: 'var(--bg-card)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--fox)' }}>
                        {source.materialName}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ink-300)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--ink-400)' }}>
                        {source.chapterTitle}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-400)' }}>
                      {source.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
            placeholder="输入您的问题..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--ink-700)',
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: loading ? 'var(--ink-300)' : 'var(--fox)' }}
          >
            {loading ? '思考中...' : '提问'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
