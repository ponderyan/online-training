'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import RichAnswerEditor from '@/components/RichAnswerEditor';

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFF_LABELS: Record<string, string> = {
  EASY: '简单', MEDIUM_EASY: '较易', MEDIUM_HARD: '较难', HARD: '困难',
};
const AUTO_TYPES = new Set(['SINGLE_CHOICE', 'TRUE_FALSE']);
const PROGRESS_KEY = 'foxlearn_practice_progress';

interface SavedProgress {
  title: string;
  questionIds: number[];
  currentIdx: number;
  answers: Record<number, any>;
  results: Record<number, { isCorrect: boolean; correctAnswer: any; analysis: string; subjective?: boolean }>;
  savedAt: string;
}

export default function PracticePlayer({ title, loadQuestions }: {
  title: string;
  loadQuestions: () => Promise<any[]>;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [results, setResults] = useState<Record<number, { isCorrect: boolean; correctAnswer: any; analysis: string; subjective?: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [mode, setMode] = useState<'practice' | 'browse'>('practice');
  const [resumePrompt, setResumePrompt] = useState<SavedProgress | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});

  // P2a: 保存进度到 localStorage
  const saveProgress = useCallback((idx: number, ans: Record<number, any>, res: Record<number, any>) => {
    if (questions.length === 0) return;
    try {
      const progress: SavedProgress = {
        title,
        questionIds: questions.map(q => q.id),
        currentIdx: idx,
        answers: ans,
        results: res,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {}
  }, [questions, title]);

  // P2a: 进度变化时自动保存
  useEffect(() => {
    if (questions.length > 0 && !done && !loading) {
      saveProgress(currentIdx, answers, results);
    }
  }, [currentIdx, answers, results, done, loading, questions.length, saveProgress]);

  // P3b: 记录每题用时
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [currentIdx]);

  const recordQuestionTime = useCallback((qId: number) => {
    const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    setQuestionTimes(prev => ({ ...prev, [qId]: (prev[qId] || 0) + elapsed }));
  }, []);

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

  // P2a: 初始化时检查是否有可恢复的进度
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        const progress: SavedProgress = JSON.parse(saved);
        const age = Date.now() - new Date(progress.savedAt).getTime();
        const answeredCount = Object.keys(progress.results).length;
        if (progress.title === title && age < 2 * 60 * 60 * 1000 && answeredCount < progress.questionIds.length) {
          setResumePrompt(progress);
          return;
        }
      }
    } catch {}
    init();
  }, [init, title]);

  // P2a: 恢复进度
  const handleResume = async () => {
    if (!resumePrompt) return;
    setLoading(true);
    try {
      const data = await loadQuestions();
      const savedIds = new Set(resumePrompt.questionIds);
      const matched = (data || []).filter((q: any) => savedIds.has(q.id));
      if (matched.length >= resumePrompt.questionIds.length * 0.5) {
        const ordered = resumePrompt.questionIds
          .map(id => matched.find((q: any) => q.id === id))
          .filter(Boolean);
        setQuestions(ordered);
        setAnswers(resumePrompt.answers || {});
        setResults(resumePrompt.results || {});
        setCurrentIdx(Math.min(resumePrompt.currentIdx, ordered.length - 1));
      } else {
        setQuestions(data || []);
      }
      const favIds = await api.practice.favorite.ids().catch(() => [] as number[]);
      setFavoriteIds(favIds || []);
    } catch { setQuestions([]); }
    setResumePrompt(null);
    setLoading(false);
  };

  const handleDiscard = () => {
    localStorage.removeItem(PROGRESS_KEY);
    setResumePrompt(null);
    init();
  };

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
    if (current) recordQuestionTime(current.id);
    if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1);
    else {
      localStorage.removeItem(PROGRESS_KEY);
      setDone(true);
    }
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

  // P2a: 恢复进度提示页
  if (resumePrompt) {
    const answeredCount = Object.keys(resumePrompt.results).length;
    const savedTime = new Date(resumePrompt.savedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' });
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-16 text-center">
          <div className="card p-8">
            <div className="text-4xl mb-4">📝</div>
            <h2 className="text-lg font-bold mb-2 text-[var(--ink-700)]">发现未完成的练习</h2>
            <p className="text-sm text-[var(--ink-400)] mb-1">{resumePrompt.title}</p>
            <p className="text-xs text-[var(--ink-300)] mb-6">已答 {answeredCount}/{resumePrompt.questionIds.length} 题 · 保存于 {savedTime}</p>
            <div className="flex gap-3">
              <button onClick={handleResume} className="btn btn-fox flex-1">继续练习</button>
              <button onClick={handleDiscard} className="btn flex-1 border border-[var(--ink-200)] text-[var(--ink-500)]">重新开始</button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在出题… 🦊</div>
      </AppLayout>
    );
  }

  if (done) {
    const allResults = Object.values(results);
    const objectiveResults = allResults.filter(r => r && !r.subjective);
    const correctCount = objectiveResults.filter(r => r?.isCorrect).length;
    const wrongCount = objectiveResults.filter(r => r && !r.isCorrect).length;
    const subjectiveCount = allResults.filter(r => r?.subjective).length;
    const accuracy = objectiveResults.length > 0 ? Math.round((correctCount / objectiveResults.length) * 100) : 0;
    const totalTime = Object.values(questionTimes).reduce((a, b) => a + b, 0);
    const answeredCount = Object.keys(results).length;
    const avgTime = answeredCount > 0 ? Math.round(totalTime / answeredCount) : 0;
    const fmtTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`;
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto py-12">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold mb-4">🎉 练习完成</h2>
            <p className="mb-2">共 <strong>{questions.length}</strong> 题 · 已答 <strong>{answeredCount}</strong> 题</p>
            <p className="text-sm text-[var(--ink-500)]">
              正确 <strong className="text-[var(--cyan)]">{correctCount}</strong> · 错误 <strong className="text-[var(--verm)]">{wrongCount}</strong>
              {subjectiveCount > 0 && <> · 自评 <strong className="text-[var(--gold)]">{subjectiveCount}</strong></>}
              {objectiveResults.length > 0 && <> · 客观题正确率 <strong>{accuracy}%</strong></>}
            </p>
            <p className="text-xs text-[var(--ink-400)] mt-2">
              总用时 {fmtTime(totalTime)} · 平均每题 {fmtTime(avgTime)}
            </p>
          </div>

          {/* 逐题回顾 */}
          <div className="card p-4 mb-6">
            <h3 className="text-sm font-bold mb-3 text-[var(--ink-600)]">📋 逐题回顾</h3>
            <div className="space-y-1.5">
              {questions.map((q: any, i: number) => {
                const r = results[q.id];
                const t = questionTimes[q.id] || 0;
                return (
                  <button key={q.id} onClick={() => { setCurrentIdx(i); setDone(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-[var(--paper)] transition-colors border-none bg-transparent cursor-pointer">
                    <span className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: !r ? 'var(--ink-200)' : r.subjective ? 'var(--warning)' : r.isCorrect ? 'var(--cyan)' : 'var(--verm)' }}>
                      {i + 1}
                    </span>
                    <span className="text-xs text-[var(--ink-400)] w-14 flex-shrink-0">{TYPE_LABELS[q.type] || q.type}</span>
                    <span className="flex-1 text-xs text-[var(--ink-500)] truncate">{q.content?.replace(/<[^>]*>/g, '').slice(0, 30)}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: !r ? 'var(--ink-300)' : r.subjective ? 'var(--warning)' : r.isCorrect ? 'var(--cyan)' : 'var(--verm)' }}>
                      {!r ? '未答' : r.subjective ? '自评' : r.isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="text-[10px] text-[var(--ink-300)] w-12 text-right flex-shrink-0">{t > 0 ? fmtTime(t) : '-'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            <button onClick={() => { setCurrentIdx(0); setDone(false); setResults({}); setAnswers({}); setQuestionTimes({}); init(); }}
              className="btn btn-fox">再练一次</button>
          </div>
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
            <button onClick={() => window.history.back()}
              className="text-xs text-[var(--ink-400)] hover:text-[var(--fox)] transition-colors border-none bg-transparent cursor-pointer flex-shrink-0">
              ← 返回
            </button>
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
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${mode === 'practice' ? 'bg-[var(--fox)] text-white border-[var(--fox)]' : 'bg-[var(--paper-bright)] text-[var(--ink-500)] border-[var(--ink-200)]'}`}>
              做题模式
            </button>
            <button onClick={() => setMode('browse')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${mode === 'browse' ? 'bg-[var(--fox)] text-white border-[var(--fox)]' : 'bg-[var(--paper-bright)] text-[var(--ink-500)] border-[var(--ink-200)]'}`}>
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

            {current.type !== 'FILL_BLANK' && (
              <div className="text-sm leading-relaxed mb-5 text-[var(--ink-800)]">
                {current.content}
              </div>
            )}

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

            {/* FILL_BLANK — 题干内嵌逐空输入框 */}
            {current.type === 'FILL_BLANK' && (
              <div className="text-sm leading-9 text-[var(--ink-800)] mb-2">
                {current.content.split(/\{\{_\}\}/).map((part: string, i: number, arr: string[]) => {
                  const blankAns = (answers[current.id] || [])[i] || '';
                  const blankCorrect = submitted && current.blanks?.[i] != null &&
                    String(blankAns).trim().toLowerCase() === String(current.blanks[i].answer || '').trim().toLowerCase();
                  const blankWrong = submitted && !blankCorrect;
                  return (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <input
                          type="text"
                          value={blankAns}
                          onChange={e => {
                            const blanks = [...(answers[current.id] || [])];
                            blanks[i] = e.target.value;
                            setAnswers(prev => ({ ...prev, [current.id]: blanks }));
                          }}
                          disabled={submitted || mode !== 'practice'}
                          className={`inline-block mx-1 px-2 py-0.5 text-center text-sm border-b-2 outline-none w-[130px] transition-colors ${
                            blankCorrect ? 'border-[var(--sage)] bg-[var(--sage-glow)] text-[var(--sage)] font-medium'
                              : blankWrong ? 'border-[var(--verm)] bg-[var(--verm-glow)] text-[var(--verm)]'
                              : 'border-[var(--fox)] bg-[var(--paper-bright)] focus:border-[var(--fox-dark)]'
                          }`}
                          placeholder={`第${i + 1}空`}
                        />
                      )}
                    </span>
                  );
                })}
                {!submitted && mode === 'practice' && (
                  <div className="flex justify-end mt-3">
                    <button onClick={handleSubmit}
                      disabled={!(answers[current.id] || []).some((a: string) => a && a.trim()) || submitting}
                      className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
                  </div>
                )}
              </div>
            )}

            {/* SHORT_ANSWER — 富文本编辑器 */}
            {current.type === 'SHORT_ANSWER' && !submitted && mode === 'practice' && (
              <div>
                <RichAnswerEditor
                  value={answers[current.id] || ''}
                  onChange={html => setAnswers(prev => ({ ...prev, [current.id]: html }))}
                  maxChars={2000}
                  placeholder="请输入你的答案…"
                />
                <div className="flex justify-end mt-3">
                  <button onClick={handleSubmit}
                    disabled={!answers[current.id] || !String(answers[current.id]).replace(/<[^>]*>/g, '').trim() || submitting}
                    className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
                </div>
              </div>
            )}

            {/* CASE_STUDY — 按子问题逐题作答 */}
            {current.type === 'CASE_STUDY' && !submitted && mode === 'practice' && (
              <div className="space-y-4">
                {(current.subQuestions?.length ? current.subQuestions : [null]).map((sq: any, i: number) => (
                  <div key={sq?.id ?? i}>
                    {sq && (
                      <div className="text-sm font-medium mb-2 pl-3 border-l-[3px] border-[var(--fox)] text-[var(--ink-600)]">
                        ({i + 1}) {sq.content}
                      </div>
                    )}
                    <RichAnswerEditor
                      value={(answers[current.id] || [])[i] || ''}
                      onChange={html => {
                        const arr = [...(answers[current.id] || [])];
                        arr[i] = html;
                        setAnswers(prev => ({ ...prev, [current.id]: arr }));
                      }}
                      maxChars={2000}
                      placeholder="请输入答案…"
                    />
                  </div>
                ))}
                <div className="flex justify-end mt-3">
                  <button onClick={handleSubmit}
                    disabled={!(answers[current.id] || []).some((a: string) => a && String(a).replace(/<[^>]*>/g, '').trim()) || submitting}
                    className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
                </div>
              </div>
            )}

            {/* Browse mode - show answer */}
            {mode === 'browse' && (
              <div className="mt-4 p-4 rounded-lg text-sm bg-[var(--fox-glow)] border border-[var(--ink-100)]">
                <p className="font-bold mb-1 text-[var(--fox-dark)]">📖 背题模式</p>
                {/* 选择题：显示正确选项 */}
                {current.options?.filter((o: any) => o.isCorrect).length > 0 && (
                  current.options.filter((o: any) => o.isCorrect).map((o: any) => (
                    <p key={o.id} className="text-sm text-[var(--ink-600)]">
                      正确答案：<strong className="text-[var(--cyan)]">{o.label}. {o.content}</strong>
                    </p>
                  ))
                )}
                {/* 非选择题：显示参考答案（支持富文本） */}
                {(!current.options || current.options.filter((o: any) => o.isCorrect).length === 0) && current.correctAnswer && (
                  <div className="text-sm text-[var(--ink-600)]">
                    <span className="font-medium">参考答案：</span>
                    <div className="mt-1 text-[var(--cyan)] leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                      dangerouslySetInnerHTML={{ __html: String(current.correctAnswer).startsWith('<') ? current.correctAnswer : `<p>${current.correctAnswer}</p>` }} />
                  </div>
                )}
                {current.analysis && (
                  <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
                    <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
                    <p className="text-xs text-[var(--ink-600)]">{current.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Result feedback — 客观题 */}
            {submitted && result && !result.subjective && (
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

            {/* Result feedback — 主观题(自评模式：展示参考答案，不判对错) */}
            {submitted && result && result.subjective && (
              <div className="mt-4 p-4 rounded-lg text-sm bg-[var(--fox-glow)] border border-[var(--fox)]">
                <p className="font-bold mb-2 text-[var(--fox-dark)]">📝 参考答案（请自行对照评判）</p>
                {result.correctAnswer && (
                  <div className="mb-2 text-[var(--ink-700)] leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ __html: typeof result.correctAnswer === 'string' && result.correctAnswer.startsWith('<') ? result.correctAnswer : `<p>${typeof result.correctAnswer === 'string' ? result.correctAnswer : JSON.stringify(result.correctAnswer, null, 2)}</p>` }} />
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
                <button onClick={() => { if (current) recordQuestionTime(current.id); if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1); else { localStorage.removeItem(PROGRESS_KEY); setDone(true); } }}
                  className="text-xs bg-transparent border-none cursor-pointer text-[var(--ink-300)]">
                  跳过本题 →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right — Answer card */}
        <aside className="w-[180px] flex-shrink-0 hidden lg:block">
          <div className="sticky top-24 bg-[var(--paper-bright)] rounded-xl border border-[var(--ink-100)] p-4">
            <div className="text-xs font-medium mb-3 text-[var(--ink-500)]">答题卡</div>
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {questions.map((q: any, i: number) => {
                const isCurrent = i === currentIdx;
                const isShown = results[q.id] !== undefined;
                const isCorrect = results[q.id]?.isCorrect;
                const isSubjective = results[q.id]?.subjective;
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(i)}
                    className={`
                      w-6 h-6 rounded text-[11px] font-medium border-none cursor-pointer
                      ${isCurrent ? 'bg-[var(--fox)] text-white' : ''}
                      ${!isCurrent && isShown && isSubjective ? 'bg-[var(--amber,#f59e0b)] text-white' : ''}
                      ${!isCurrent && isShown && !isSubjective && isCorrect ? 'bg-[var(--cyan)] text-white' : ''}
                      ${!isCurrent && isShown && !isSubjective && !isCorrect ? 'bg-[var(--verm)] text-white' : ''}
                      ${!isCurrent && !isShown ? 'bg-[var(--paper)] text-[var(--ink-300)]' : ''}
                    `}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] space-y-0.5 text-[var(--ink-400)]">
              <div>✓ 正确：{Object.values(results).filter(r => r && !r.subjective && r.isCorrect).length}</div>
              <div>✗ 错误：{Object.values(results).filter(r => r && !r.subjective && !r.isCorrect).length}</div>
              <div>✎ 自评：{Object.values(results).filter(r => r?.subjective).length}</div>
              <div>— 未答：{questions.length - Object.keys(results).length}</div>
              <div className="mt-2 pt-1 border-t border-[var(--ink-100)]">共 {questions.length} 题</div>
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
