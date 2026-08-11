'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { AUTO_TYPES, PROGRESS_KEY } from './practice-constants';
import type { SavedProgress, PracticeResult } from './practice-constants';
import { PracticeSummary } from './practice-summary';
import { AnswerPanel } from './answer-panel';
import { QuestionCard } from './question-card';

export default function PracticePlayer({ title, loadQuestions }: {
  title: string;
  loadQuestions: () => Promise<any[]>;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [results, setResults] = useState<Record<number, PracticeResult>>({});
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
    return (
      <AppLayout>
        <PracticeSummary
          questions={questions}
          results={results}
          questionTimes={questionTimes}
          onReview={i => { setCurrentIdx(i); setDone(false); }}
          onRestart={() => { setCurrentIdx(0); setDone(false); setResults({}); setAnswers({}); setQuestionTimes({}); init(); }}
        />
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
          <QuestionCard
            current={current}
            mode={mode}
            submitted={submitted}
            result={result}
            submitting={submitting}
            answers={answers}
            setAnswers={setAnswers}
            isFavorite={favoriteIds.includes(current.id)}
            isFirst={currentIdx === 0}
            isLast={currentIdx >= questions.length - 1}
            onToggleFavorite={handleToggleFavorite}
            onSelect={handleSelect}
            onSubmit={handleSubmit}
            onPrev={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            onNext={handleNext}
            onSkip={() => { if (current) recordQuestionTime(current.id); if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1); else { localStorage.removeItem(PROGRESS_KEY); setDone(true); } }}
          />
        </div>

        {/* Right — Answer card */}
        <AnswerPanel questions={questions} results={results} currentIdx={currentIdx} onJump={setCurrentIdx} />
      </div>
    </AppLayout>
  );
}
