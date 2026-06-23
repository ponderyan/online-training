'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const ALL_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'];
const COUNT_OPTIONS = [5, 10, 20, 30];

export default function PracticePage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [showAnswers, setShowAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [types, setTypes] = useState<string[]>([...ALL_TYPES]);
  const [count, setCount] = useState(10);

  useEffect(() => {
    fetch('/api/subjects/public').then(r => r.json()).then(setSubjects).catch(() => {});
    loadQuestions();
  }, []);

  const loadQuestions = useCallback(async (sid?: string, ts?: string[], cnt?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('count', String(cnt || count));
      if (sid || subjectId) params.set('subjectId', String(sid || subjectId));
      const selectedTypes = ts || types;
      if (selectedTypes.length < 4) params.set('types', selectedTypes.join(','));
      const res = await fetch(`/api/questions/practice?${params.toString()}`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
      setCurrentIdx(0);
      setAnswers({});
      setShowAnswers({});
    } catch {}
    setLoading(false);
  }, [count, subjectId, types]);

  const toggleType = (t: string) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleAnswer = (questionId: number, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleMultiAnswer = (questionId: number, option: string) => {
    const current = answers[questionId] || [];
    const updated = current.includes(option)
      ? current.filter((x: string) => x !== option)
      : [...current, option];
    setAnswers(prev => ({ ...prev, [questionId]: updated }));
  };

  const handleShowAnswer = async (questionId: number) => {
    if (showAnswers[questionId]) return;
    try {
      const res = await fetch(`/api/questions/practice/answer?questionId=${questionId}`);
      const data = await res.json();
      setShowAnswers(prev => ({ ...prev, [questionId]: data }));
    } catch {}
  };

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const current = safeQuestions[currentIdx] || null;
  const answeredCount = safeQuestions.filter(q => answers[q.id] !== undefined).length;
  const shownAnswerCount = Object.keys(showAnswers).length;

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在出题… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📝 练习模式</h1>
        <p className="page-subtitle">不计分 · 不限次 · 即时看解析</p>
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select text-xs" style={{ width: 160 }}>
            <option value="">全部科目</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-400)' }}>
            {ALL_TYPES.map(t => (
              <label key={t} className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded" style={{ background: types.includes(t) ? 'var(--fox-glow)' : 'transparent' }}>
                <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} className="accent-[#e87a30]" />
                {TYPE_NAMES[t]}
              </label>
            ))}
          </div>
          <select value={count} onChange={e => { setCount(parseInt(e.target.value)); }} className="input select text-xs" style={{ width: 80 }}>
            {COUNT_OPTIONS.map(c => <option key={c} value={c}>{c}题</option>)}
          </select>
          <button onClick={() => loadQuestions()} className="btn btn-fox btn-xs">换一批</button>
        </div>
      </div>

      {safeQuestions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无题目，试试调整筛选条件</p>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto py-1">
            {safeQuestions.map((q, i) => {
              const isCurrent = i === currentIdx;
              const isAnswered = answers[q.id] !== undefined;
              const isShown = showAnswers[q.id] !== undefined;
              let bg = '#e0ddd8';
              if (isShown) bg = '#80cbc4';
              else if (isAnswered) bg = '#a5d6a7';
              if (isCurrent) bg = '#e87a30';
              return (
                <button key={q.id} onClick={() => setCurrentIdx(i)}
                  className="w-7 h-7 rounded-md text-[11px] font-medium border-none cursor-pointer transition-all flex-shrink-0"
                  style={{ background: bg, color: isCurrent ? 'white' : 'var(--ink-600)' }}>
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] mb-4" style={{ color: 'var(--ink-300)' }}>
            已答 {answeredCount}/{safeQuestions.length} 题 · 已看解析 {shownAnswerCount} 题
          </div>

          {/* Current question */}
          {current && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                  {TYPE_NAMES[current.type] || current.type}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                  {current.subject?.name} · {current.chapter?.name || ''}
                </span>
              </div>

              <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--ink-700)' }}>{current.content}</p>

              {/* Answer area based on type */}
              {(current.type === 'SINGLE_CHOICE' || current.type === 'TRUE_FALSE') && (
                <div className="space-y-2">
                  {(current.options || []).map((o: any) => {
                    const selected = answers[current.id] === o.label;
                    return (
                      <div key={o.label} onClick={() => handleAnswer(current.id, o.label)}
                        className="p-3 rounded-lg cursor-pointer transition-all text-sm flex items-center gap-3"
                        style={{ background: selected ? 'rgba(232,122,48,0.08)' : 'var(--paper-dark)', border: selected ? '1px solid var(--fox)' : '1px solid transparent' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                          style={{ background: selected ? 'var(--fox)' : '#e0ddd8', color: selected ? 'white' : 'var(--ink-400)' }}>
                          {o.label}
                        </span>
                        <span style={{ color: selected ? 'var(--ink-700)' : 'var(--ink-500)' }}>{o.content}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {current.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2">
                  {(current.options || []).map((o: any) => {
                    const selected = (answers[current.id] || []).includes(o.label);
                    return (
                      <div key={o.label} onClick={() => handleMultiAnswer(current.id, o.label)}
                        className="p-3 rounded-lg cursor-pointer transition-all text-sm flex items-center gap-3"
                        style={{ background: selected ? 'rgba(232,122,48,0.08)' : 'var(--paper-dark)', border: selected ? '1px solid var(--fox)' : '1px solid transparent' }}>
                        <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium flex-shrink-0"
                          style={{ background: selected ? 'var(--fox)' : '#e0ddd8', color: selected ? 'white' : 'var(--ink-400)' }}>
                          {selected ? '✓' : o.label}
                        </span>
                        <span style={{ color: selected ? 'var(--ink-700)' : 'var(--ink-500)' }}>{o.content}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {current.type === 'FILL_BLANK' && (
                <div>
                  <textarea value={answers[current.id] || ''} onChange={e => handleAnswer(current.id, e.target.value)}
                    className="input w-full" rows={3} placeholder="输入答案…" />
                </div>
              )}

              {/* Show answer button + answer display */}
              <div className="mt-5">
                {showAnswers[current.id] ? (
                  <div className="p-4 rounded-lg" style={{ background: '#f0faf0', border: '1px solid #c8e6c9' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: '#2e7d32' }}>✅</span>
                      <span className="text-sm font-medium" style={{ color: '#2e7d32' }}>答案解析</span>
                    </div>
                    <div className="text-sm">
                      <p><b style={{ color: 'var(--ink-600)' }}>正确答案：</b>
                        <span style={{ color: 'var(--fox)' }}>{showAnswers[current.id].correctAnswer}</span></p>
                      {showAnswers[current.id].analysis && (
                        <div className="mt-2 p-3 rounded" style={{ background: 'white' }}>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}><b>解析：</b>{showAnswers[current.id].analysis}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => handleShowAnswer(current.id)} className="btn btn-sm" style={{ border: '1px solid var(--sage)', color: 'var(--sage)' }}>
                    👁️ 查看解析
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
              className="btn btn-sm" style={{ border: '1px solid var(--ink-200)', opacity: currentIdx === 0 ? 0.4 : 1 }}>
              ← 上一题
            </button>
            <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
              {currentIdx + 1} / {safeQuestions.length}
            </span>
            <button onClick={() => setCurrentIdx(i => Math.min(safeQuestions.length - 1, i + 1))} disabled={currentIdx === safeQuestions.length - 1}
              className="btn btn-sm" style={{ border: '1px solid var(--ink-200)', opacity: currentIdx === safeQuestions.length - 1 ? 0.4 : 1 }}>
              下一题 →
            </button>
          </div>
        </>
      )}
    </AppLayout>
  );
}
