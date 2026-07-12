'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFF_LABELS: Record<string, string> = {
  EASY: '简单', MEDIUM: '中等', HARD: '困难',
};
const AUTO_TYPES = new Set(['SINGLE_CHOICE', 'TRUE_FALSE']);

export default function PracticePlayer({ title, loadQuestions }: {
  title: string;
  loadQuestions: () => Promise<any[]>;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [results, setResults] = useState<Record<number, { isCorrect: boolean; correctAnswer: any; analysis: string }>>({});
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [mode, setMode] = useState<'practice' | 'browse'>('practice');

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const [data, favIds] = await Promise.all([
        loadQuestions(),
        api.practice.favorite.ids().catch(() => [] as number[]),
      ]);
      setQuestions(data || []);
      setFavoriteIds(favIds || []);
    } catch { setQuestions([]); }
    setLoading(false);
  }, [loadQuestions]);

  useEffect(() => { init(); }, [init]);

  const current = questions[currentIdx];
  const submitted = results[current?.id] != null;
  const result = results[current?.id];
  const isAutoType = current && AUTO_TYPES.has(current.type);

  const handleSubmit = async () => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.practice.submit({
        questionId: current.id,
        answer: answers[current.id] || null,
      });
      setResults(prev => ({ ...prev, [current.id]: res }));
    } catch (e: any) {
      alert('提交失败：' + e.message);
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1);
    else setDone(true);
  };

  const handleToggleFavorite = useCallback(async (questionId: number) => {
    const res = await api.practice.favorite.toggle(questionId);
    if (res.favorited) setFavoriteIds(prev => [...prev, questionId]);
    else setFavoriteIds(prev => prev.filter(id => id !== questionId));
  }, []);

  // Auto-submit for single choice / true false
  const handleSelect = (questionId: number, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (mode === 'practice' && !submitted) {
      const q = questions.find(x => x.id === questionId);
      if (q && AUTO_TYPES.has(q.type)) {
        api.practice.submit({ questionId, answer: value }).then(res => {
          setResults(prev => ({ ...prev, [questionId]: res }));
        });
      }
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在出题… 🦊</div>
      </AppLayout>
    );
  }

  if (done) {
    const correctCount = Object.values(results).filter(r => r?.isCorrect).length;
    const wrongCount = Object.values(results).filter(r => r && !r.isCorrect).length;
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-16">
          <h2 className="text-xl font-bold mb-4">🎉 练习完成</h2>
          <p>共 <strong>{questions.length}</strong> 题 · 正确 <strong className="text-[var(--cyan)]">{correctCount}</strong> · 错误 <strong className="text-[var(--verm)]">{wrongCount}</strong></p>
          <button onClick={() => { setCurrentIdx(0); setDone(false); setResults({}); setAnswers({}); init(); }}
            className="btn btn-fox mt-6">再练一次</button>
        </div>
      </AppLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-[var(--ink-300)]">暂无练习题目</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex gap-6 max-w-5xl mx-auto">
        {/* Left — main content */}
        <div className="flex-1 min-w-0">
          {/* Progress + mode toggle */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium">{title}</span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--ink-100)]">
              <div className="h-full rounded-full transition-all bg-[var(--fox)]"
                style={{ width: `${((Object.keys(results).length) / questions.length) * 100}%` }} />
            </div>
            <span className="text-xs text-[var(--ink-300)]">{currentIdx + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[var(--ink-400)]">模式：</span>
            <button onClick={() => setMode('practice')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${mode === 'practice' ? 'bg-[var(--fox)] text-white border-[var(--fox)]' : 'bg-white text-[var(--ink-500)] border-[var(--ink-200)]'}`}>
              做题模式
            </button>
            <button onClick={() => setMode('browse')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${mode === 'browse' ? 'bg-[var(--fox)] text-white border-[var(--fox)]' : 'bg-white text-[var(--ink-500)] border-[var(--ink-200)]'}`}>
              背题模式
            </button>
          </div>

          {/* Question card */}
          <div className="card p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="tag tag-fox text-xs">{TYPE_LABELS[current.type] || current.type}</span>
              {current.difficulty && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-400)]">
                  {DIFF_LABELS[current.difficulty] || current.difficulty}
                </span>
              )}
              <span className="text-xs flex-1 text-[var(--ink-300)]">
                {current.subject?.name || ''}{current.chapter?.name ? ` · ${current.chapter.name}` : ''}
              </span>
              <button onClick={() => handleToggleFavorite(current.id)}
                className="text-lg bg-transparent border-none cursor-pointer transition-transform hover:scale-110"
                title={favoriteIds.includes(current.id) ? '取消收藏' : '收藏本题'}>
                {favoriteIds.includes(current.id) ? '★' : '☆'}
              </button>
            </div>

            <div className="text-sm leading-relaxed mb-5 text-[var(--ink-800)]">
              {current.content}
            </div>

            {/* Single Choice & True/False */}
            {(current.type === 'SINGLE_CHOICE' || current.type === 'TRUE_FALSE') && current.options?.map((o: any) => {
              const isSelected = answers[current.id] === o.label;
              const showResult = mode === 'browse' || submitted;
              return (
                <label key={o.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg mb-2 transition-all
                    ${showResult ? '' : 'cursor-pointer'}
                    ${isSelected && mode === 'practice' ? 'bg-[var(--fox-glow)] border border-[var(--fox)]' : 'bg-[var(--paper)] border border-transparent'}
                    ${showResult && o.isCorrect ? 'bg-[var(--cyan-glow)] border border-[var(--cyan)] ring-1 ring-[var(--cyan)]' : ''}
                  `}
                  onClick={() => mode === 'practice' && !submitted && handleSelect(current.id, o.label)}>
                  <input type="radio" name={`q-${current.id}`} checked={isSelected}
                    onChange={() => mode === 'practice' && !submitted && handleSelect(current.id, o.label)}
                    disabled={showResult} className="accent-[var(--fox)]" />
                  <span className="text-sm"><b>{o.label}.</b> {o.content}</span>
                  {showResult && o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--cyan)]">✓ 正确答案</span>}
                  {showResult && isSelected && !o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--verm)]">✗</span>}
                </label>
              );
            })}

            {/* Multiple Choice */}
            {current.type === 'MULTIPLE_CHOICE' && current.options?.map((o: any) => {
              const selected: string[] = answers[current.id] || [];
              const checked = selected.includes(o.label);
              const showResult = mode === 'browse' || submitted;
              return (
                <label key={o.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg mb-2 transition-all
                    ${showResult ? '' : 'cursor-pointer'}
                    ${checked && mode === 'practice' ? 'bg-[var(--fox-glow)] border border-[var(--fox)]' : 'bg-[var(--paper)] border border-transparent'}
                    ${showResult && o.isCorrect ? 'bg-[var(--cyan-glow)] border border-[var(--cyan)] ring-1 ring-[var(--cyan)]' : ''}
                  `}>
                  <input type="checkbox" checked={checked}
                    onChange={() => {
                      if (showResult || mode !== 'practice') return;
                      const newSel = checked ? selected.filter((s: string) => s !== o.label) : [...selected, o.label];
                      setAnswers(prev => ({ ...prev, [current.id]: newSel }));
                    }}
                    disabled={showResult} className="accent-[var(--fox)]" />
                  <span className="text-sm"><b>{o.label}.</b> {o.content}</span>
                  {showResult && o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--cyan)]">✓</span>}
                  {showResult && checked && !o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--verm)]">✗</span>}
                </label>
              );
            })}

            {/* Multi-choice confirm button */}
            {current.type === 'MULTIPLE_CHOICE' && mode === 'practice' && !submitted && (
              <div className="flex justify-end mt-3">
                <button onClick={handleSubmit} disabled={!answers[current.id]?.length || submitting}
                  className="btn btn-fox btn-xs">
                  {submitting ? '提交中…' : '确定作答'}
                </button>
              </div>
            )}

            {/* Fill Blank / Short Answer / Case Study */}
            {(current.type === 'FILL_BLANK' || current.type === 'SHORT_ANSWER' || current.type === 'CASE_STUDY') && !submitted && (
              <div>
                <textarea value={answers[current.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
                  disabled={submitted}
                  className="input w-full" rows={current.type === 'FILL_BLANK' ? 3 : 5}
                  placeholder={current.type === 'FILL_BLANK' ? '输入答案…' : '输入你的答案…'} />
                <div className="flex justify-end mt-3">
                  <button onClick={handleSubmit} disabled={answers[current.id] == null || submitting}
                    className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
                </div>
              </div>
            )}

            {/* Browse mode - show answer */}
            {mode === 'browse' && (
              <div className="mt-4 p-4 rounded-lg text-sm bg-[var(--fox-glow)] border border-[var(--ink-100)]">
                <p className="font-bold mb-1 text-[var(--fox-dark)]">📖 背题模式</p>
                {current.options?.map((o: any) => o.isCorrect && (
                  <p key={o.id} className="text-sm text-[var(--ink-600)]">
                    正确答案：<strong className="text-[var(--cyan)]">{o.label}. {o.content}</strong>
                  </p>
                ))}
                {current.analysis && (
                  <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
                    <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
                    <p className="text-xs text-[var(--ink-600)]">{current.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Result feedback */}
            {submitted && result && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${result.isCorrect ? 'bg-[var(--sage-glow)] border border-[var(--sage)]' : 'bg-[var(--verm-glow)] border border-[var(--verm)]'}`}>
                <p className={`font-bold mb-2 ${result.isCorrect ? 'text-[var(--sage)]' : 'text-red-700'}`}>
                  {result.isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
                </p>
                {!result.isCorrect && (
                  <p className="mb-1 text-[var(--ink-600)]">
                    正确答案：<strong className="text-[var(--cyan)]">{result.correctAnswer}</strong>
                  </p>
                )}
                {result.analysis && (
                  <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
                    <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
                    <p className="text-xs text-[var(--ink-600)]">{result.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-[var(--ink-100)]">
              <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="btn text-sm px-4 py-2 border border-[var(--ink-200)] disabled:opacity-40">
                ← 上一题
              </button>
              {submitted || mode === 'browse' ? (
                <button onClick={handleNext} className="btn btn-fox text-sm px-4 py-2">
                  {currentIdx < questions.length - 1 ? '下一题 →' : '查看结果'}
                </button>
              ) : (
                <button onClick={() => { if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1); else setDone(true); }}
                  className="text-xs bg-transparent border-none cursor-pointer text-[var(--ink-300)]">
                  跳过本题 →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right — Answer card */}
        <aside className="w-[180px] flex-shrink-0 hidden lg:block">
          <div className="sticky top-24 bg-white rounded-xl border border-[var(--ink-100)] p-4">
            <div className="text-xs font-medium mb-3 text-[var(--ink-500)]">答题卡</div>
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {questions.map((q: any, i: number) => {
                const isCurrent = i === currentIdx;
                const isShown = results[q.id] !== undefined;
                const isCorrect = results[q.id]?.isCorrect;
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(i)}
                    className={`
                      w-6 h-6 rounded text-[11px] font-medium border-none cursor-pointer
                      ${isCurrent ? 'bg-[var(--fox)] text-white' : ''}
                      ${!isCurrent && isShown && isCorrect ? 'bg-[var(--cyan)] text-white' : ''}
                      ${!isCurrent && isShown && !isCorrect ? 'bg-[var(--verm)] text-white' : ''}
                      ${!isCurrent && !isShown ? 'bg-[var(--paper)] text-[var(--ink-300)]' : ''}
                    `}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] space-y-0.5 text-[var(--ink-400)]">
              <div>✓ 正确：{Object.values(results).filter(r => r?.isCorrect).length}</div>
              <div>✗ 错误：{Object.values(results).filter(r => r && !r.isCorrect).length}</div>
              <div>— 未答：{questions.length - Object.keys(results).length}</div>
              <div className="mt-2 pt-1 border-t border-[var(--ink-100)]">共 {questions.length} 题</div>
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
