'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

import SubmitConfirmModal from '../components/SubmitConfirmModal';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};

interface QuestionData {
  pqId: number;
  questionId: number;
  type: string;
  content: string;
  score: number;
  options: { id: number; label: string; content: string }[];
  blanks: { id: number; blankIndex: number; answer: string }[];
  subQuestions: { id: number; content: string; score: number | null }[];
  yourAnswer: any;
  isMarked?: boolean;
  section?: string;
}

interface ExamData {
  examId: number;
  title: string;
  durationMinutes: number;
  remainingTime: number;
  sessionStatus: string;
  questions: QuestionData[];
}

export default function ExamTake() {
  const params = useParams();
  const router = useRouter();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const heartbeatRef = useRef<any>(null);
  const heartbeatFailCount = useRef(0);
  const [networkError, setNetworkError] = useState(false);
  const tabSwitchLogRef = useRef<{time: string; duration: number}[]>([]);
  const tabSwitchStartRef = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    // 从 localStorage 读取自动跳转偏好
    const savedAutoAdvance = localStorage.getItem('exam-auto-advance');
    if (savedAutoAdvance !== null) setAutoAdvance(savedAutoAdvance === 'true');

    fetch(`/api/student/exams/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      if (!r.ok) throw new Error('考试不可用');
      return r.json();
    }).then(data => {
      setExam(data);
      setTimeLeft(data.remainingTime || data.durationMinutes * 60);
      // 恢复已有答案和标记状态
      const ans: Record<number, any> = {};
      const marked = new Set<number>();
      for (const q of data.questions) {
        if (q.yourAnswer !== null) ans[q.pqId] = q.yourAnswer;
        if (q.isMarked) marked.add(q.questionId);
      }
      setAnswers(ans);
      setMarkedQuestions(marked);
      setLoading(false);
    }).catch(() => router.push('/exam'));
  }, [params.id, router]);

  const handleAnswer = useCallback((pqId: number, value: any) => {
    setAnswers(prev => ({ ...prev, [pqId]: value }));
    // 自动跳转（单选题/判断题答完自动下一题）
    if (autoAdvance && exam) {
      const q = exam.questions.find(qx => qx.pqId === pqId);
      if (q && (q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE')) {
        const idx = exam.questions.findIndex(qx => qx.pqId === pqId);
        if (idx !== -1 && idx < exam.questions.length - 1) {
          setTimeout(() => setCurrentQ(idx + 1), 200);
        }
      }
    }
  }, [autoAdvance, exam]);

  const toggleMark = useCallback(async (pqId: number) => {
    const q = exam?.questions.find(qx => qx.pqId === pqId);
    if (!q || !exam) return;
    const token = localStorage.getItem('token');
    const isCurrentlyMarked = markedQuestions.has(q.questionId);

    // 乐观更新
    setMarkedQuestions(prev => {
      const next = new Set(prev);
      if (isCurrentlyMarked) next.delete(q.questionId);
      else next.add(q.questionId);
      return next;
    });

    // 发请求
    const endpoint = isCurrentlyMarked
      ? `/api/student/exams/${exam.examId}/unmark`
      : `/api/student/exams/${exam.examId}/mark`;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questionId: q.questionId }),
    });
  }, [exam, markedQuestions]);

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const answerArray = Object.entries(answers).map(([pqId, answer]) => ({
        paperQuestionId: parseInt(pqId),
        questionId: exam!.questions.find(q => q.pqId === parseInt(pqId))!.questionId,
        answer,
      }));
      await fetch(`/api/student/exams/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          answers: answerArray,
          tabSwitchLog: tabSwitchLogRef.current,
        }),
      });
      setSubmitted(true);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      router.push(`/exam/result/${params.id}`);
    } catch {
      setSubmitting(false);
    }
  };

  // 倒计时（handleSubmit 用 ref 避免闭包过期）
  const submitRef = useRef<() => Promise<void>>(async () => {});
  submitRef.current = handleSubmit;
  useEffect(() => {
    if (loading || submitted || !exam) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); submitRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitted, exam]);

  // 心跳（每30秒）
  useEffect(() => {
    if (loading || submitted) return;
    const token = localStorage.getItem('token');
    heartbeatRef.current = setInterval(() => {
      fetch(`/api/student/exams/${params.id}/heartbeat`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).then(r => {
        if (r.ok) heartbeatFailCount.current = 0;
        else heartbeatFailCount.current++;
      }).catch(() => {
        heartbeatFailCount.current++;
        if (heartbeatFailCount.current >= 3) setNetworkError(true);
      });
    }, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [loading, submitted, params.id]);

  // 离开页面确认提示
  useEffect(() => {
    if (loading || submitted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, submitted]);

  // 键盘快捷键
  useEffect(() => {
    if (!exam || submitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ← → 切换题目
      if (e.key === 'ArrowLeft') {
        setCurrentQ(prev => Math.max(0, prev - 1));
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        setCurrentQ(prev => Math.min(exam.questions.length - 1, prev + 1));
        e.preventDefault();
      }

      const question = exam.questions[currentQ];
      if (!question) return;

      // 选择题 A/B/C/D 快捷键
      if (question.type === 'SINGLE_CHOICE') {
        const keyMap: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
        if (keyMap[e.key.toLowerCase()]) {
          handleAnswer(question.pqId, keyMap[e.key.toLowerCase()]);
          e.preventDefault();
        }
      }

      // 判断题 1=对, 2=错
      if (question.type === 'TRUE_FALSE') {
        if (e.key === '1') { handleAnswer(question.pqId, '对'); e.preventDefault(); }
        if (e.key === '2') { handleAnswer(question.pqId, '错'); e.preventDefault(); }
      }

      // Ctrl+Enter 交卷
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        setShowSubmitModal(true);
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exam, submitted, currentQ, handleAnswer]);

  // 切屏检测（记而不罚）
  useEffect(() => {
    if (loading || submitted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchStartRef.current = Date.now();
      } else if (tabSwitchStartRef.current !== null) {
        const duration = Math.round((Date.now() - tabSwitchStartRef.current) / 1000);
        tabSwitchLogRef.current = [...tabSwitchLogRef.current, {
          time: new Date(tabSwitchStartRef.current).toISOString(),
          duration,
        }];
        tabSwitchStartRef.current = null;
      }
    };
    const handleBlur = () => {
      if (tabSwitchStartRef.current === null) tabSwitchStartRef.current = Date.now();
    };
    const handleFocus = () => {
      if (tabSwitchStartRef.current !== null) {
        const duration = Math.round((Date.now() - tabSwitchStartRef.current) / 1000);
        tabSwitchLogRef.current = [...tabSwitchLogRef.current, {
          time: new Date(tabSwitchStartRef.current).toISOString(),
          duration,
        }];
        tabSwitchStartRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loading, submitted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (networkError) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--ink-700)' }}>网络连接异常</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>检测到网络不稳定，但你的答题数据已保存，请不要关闭页面</p>
        <p className="text-xs" style={{ color: 'var(--ink-300)' }}>正在尝试重新连接…</p>
      </div>
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}><p>加载中…</p></div>;
  if (!exam) return null;

  const q = exam.questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;

  // 渲染题目
  const renderQuestion = (question: QuestionData) => {
    switch (question.type) {
      case 'SINGLE_CHOICE':
        return (
          <div className="space-y-2">
            {question.options?.map(opt => (
              <label key={opt.id}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: answers[question.pqId] === opt.label ? '#fef3e7' : '#faf8f5',
                  border: `1px solid ${answers[question.pqId] === opt.label ? 'var(--fox)' : 'var(--ink-100)'}`,
                }}>
                <input type="radio" name={`q-${question.pqId}`} value={opt.label}
                  checked={answers[question.pqId] === opt.label}
                  onChange={() => handleAnswer(question.pqId, opt.label)}
                  className="accent-[#e87a30]" />
                <span className="text-sm"><b>{opt.label}.</b> {opt.content}</span>
              </label>
            ))}
          </div>
        );
      case 'MULTIPLE_CHOICE': {
        const selected: string[] = answers[question.pqId] || [];
        return (
          <div className="space-y-2">
            {question.options?.map(opt => {
              const checked = selected.includes(opt.label);
              return (
                <label key={opt.id}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: checked ? '#fef3e7' : '#faf8f5',
                    border: `1px solid ${checked ? 'var(--fox)' : 'var(--ink-100)'}`,
                  }}>
                  <input type="checkbox" checked={checked}
                    onChange={() => {
                      const newSel = checked ? selected.filter(s => s !== opt.label) : [...selected, opt.label];
                      handleAnswer(question.pqId, newSel);
                    }}
                    className="accent-[#e87a30]" />
                  <span className="text-sm"><b>{opt.label}.</b> {opt.content}</span>
                </label>
              );
            })}
          </div>
        );
      }
      case 'TRUE_FALSE':
        return (
          <div className="flex gap-4">
            {['对', '错'].map(val => (
              <button key={val}
                onClick={() => handleAnswer(question.pqId, val)}
                className="flex-1 py-8 rounded-xl text-lg font-medium transition-all"
                style={{
                  background: answers[question.pqId] === val ? '#fef3e7' : '#faf8f5',
                  border: `2px solid ${answers[question.pqId] === val ? 'var(--fox)' : 'var(--ink-100)'}`,
                  color: answers[question.pqId] === val ? 'var(--fox)' : 'var(--ink-500)',
                }}>
                {val}
              </button>
            ))}
          </div>
        );
      case 'FILL_BLANK': {
        const blanks: string[] = answers[question.pqId] || [];
        const parts = question.content.split(/\{\{_\}\}/);
        return (
          <div className="leading-8">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <input type="text"
                    value={blanks[i] || ''}
                    onChange={e => {
                      const newBlanks = [...blanks];
                      newBlanks[i] = e.target.value;
                      handleAnswer(question.pqId, newBlanks);
                    }}
                    className="inline-block mx-1 px-2 border-b-2 text-center"
                    style={{ borderColor: 'var(--fox)', width: 120, background: 'transparent', outline: 'none' }}
                  />
                )}
              </span>
            ))}
          </div>
        );
      }
      case 'SHORT_ANSWER':
        return (
          <textarea
            value={answers[question.pqId] || ''}
            onChange={e => handleAnswer(question.pqId, e.target.value)}
            placeholder="请输入你的答案…"
            rows={8}
            className="w-full p-4 rounded-lg resize-none"
            style={{ border: '1px solid var(--ink-200)', background: '#faf8f5' }}
          />
        );
      case 'CASE_STUDY':
        return (
          <div className="space-y-4">
            {question.subQuestions?.map((sq, i) => (
              <div key={sq.id}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--ink-600)' }}>
                  ({i + 1}) {sq.content}
                </p>
                <textarea
                  value={(answers[question.pqId] || [])[i] || ''}
                  onChange={e => {
                    const arr = answers[question.pqId] || [];
                    arr[i] = e.target.value;
                    handleAnswer(question.pqId, [...arr]);
                  }}
                  placeholder="请输入答案…"
                  rows={4}
                  className="w-full p-3 rounded-lg resize-none"
                  style={{ border: '1px solid var(--ink-200)', background: '#faf8f5' }}
                />
              </div>
            ))}
          </div>
        );
      default:
        return <p>不支持的题型</p>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-md relative" style={{ background: 'rgba(246,241,232,0.95)', borderBottom: '1px solid var(--ink-100)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{exam.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
              {answeredCount}/{totalQuestions} 已答
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-lg font-bold"
              style={{ color: timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : 'var(--fox)' }}>
              {formatTime(timeLeft)}
            </span>
            <button onClick={() => setShowSubmitModal(true)}
              disabled={submitting}
              className="btn btn-fox text-xs py-1.5 px-4">
              {submitting ? '提交中…' : '交 卷'}
            </button>
          </div>
        </div>
        {/* 时间进度条 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--ink-100)' }}>
          <div className="h-full transition-all duration-1000" style={{
            width: `${(1 - timeLeft / (exam.durationMinutes * 60)) * 100}%`,
            background: timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#22c55e',
          }} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full px-6 py-6 gap-6">
        {/* Question navigation sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--ink-400)' }}>答题卡</p>
            {exam.questions.map((q, i) => {
              const isAnswered = answers[q.pqId] !== undefined && answers[q.pqId] !== '' &&
                !(Array.isArray(answers[q.pqId]) && answers[q.pqId].length === 0);
              const isMarked = markedQuestions.has(q.questionId);
              const isCurrent = i === currentQ;
              let bg: string, fg: string, bd: string;
              if (isCurrent) { bg = 'var(--fox)'; fg = 'white'; bd = 'var(--fox)'; }
              else if (isMarked) { bg = '#fefce8'; fg = '#ca8a04'; bd = '#fde68a'; }
              else if (isAnswered) { bg = '#fef3e7'; fg = 'var(--fox)'; bd = 'var(--fox)'; }
              else { bg = '#faf8f5'; fg = 'var(--ink-400)'; bd = 'var(--ink-100)'; }
              return (
                <button key={q.pqId} onClick={() => setCurrentQ(i)}
                  className="w-8 h-8 rounded-md text-xs font-medium transition-all mb-1.5 mr-1.5"
                  style={{ background: bg, color: fg, border: `1px solid ${bd}` }}>
                  {i + 1}
                </button>
              );
            })}
            <div className="mt-2 text-xs space-y-1.5" style={{ color: 'var(--ink-400)' }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--fox)' }}></span> 当前
                <span className="w-3 h-3 rounded ml-2" style={{ background: '#fef3e7', border: '1px solid var(--fox)' }}></span> 已答
                <span className="w-3 h-3 rounded ml-2" style={{ background: '#fefce8', border: '1px solid #fde68a' }}></span> 标记
              </div>
            </div>
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1">
          <div className="rounded-xl p-8" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                  第 {currentQ + 1} / {totalQuestions} 题 · {q.score}分
                </span>
                <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                  {TYPE_NAMES[q.type] || q.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMark(q.pqId)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                  style={{
                    background: markedQuestions.has(q.questionId) ? '#fefce8' : 'transparent',
                    color: markedQuestions.has(q.questionId) ? '#ca8a04' : 'var(--ink-300)',
                    border: `1px solid ${markedQuestions.has(q.questionId) ? '#fde68a' : 'var(--ink-100)'}`,
                  }}>
                  {markedQuestions.has(q.questionId) ? '⭐ 已标记' : '☆ 标记'}
                </button>
                {/* 自动跳转开关 */}
                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--ink-300)' }}
                  title="答完选择题/判断题后自动跳转下一题">
                  <input type="checkbox" checked={autoAdvance}
                    onChange={() => {
                      const next = !autoAdvance;
                      setAutoAdvance(next);
                      localStorage.setItem('exam-auto-advance', String(next));
                    }}
                    className="accent-[#e87a30] scale-75" />
                  自动
                </label>
              </div>
            </div>
            <p className="text-sm mb-6 leading-7" style={{ color: 'var(--ink-700)' }}>{q.content}</p>
            {renderQuestion(q)}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6" style={{ borderTop: '1px solid var(--ink-100)' }}>
              <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="btn text-sm px-5 py-2" style={{ border: '1px solid var(--ink-200)', opacity: currentQ === 0 ? 0.4 : 1 }}>
                ← 上一题
              </button>
              {currentQ < totalQuestions - 1 ? (
                <button onClick={() => setCurrentQ(currentQ + 1)}
                  className="btn btn-fox text-sm px-5 py-2">
                  下一题 →
                </button>
              ) : (
                <button onClick={() => setShowSubmitModal(true)}
                  disabled={submitting}
                  className="btn text-sm px-5 py-2" style={{ background: 'var(--fox)', color: 'white' }}>
                  {submitting ? '提交中…' : '交 卷'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="px-4 py-2 rounded-full text-[10px] backdrop-blur-md select-none"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)' }}>
          ← → 切换题目 · A~D 快速选择 · Ctrl+Enter 交卷
        </div>
      </div>

      {/* Submit confirmation modal */}
      <SubmitConfirmModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        answeredCount={answeredCount}
        totalCount={totalQuestions}
        markedCount={markedQuestions.size}
        unansweredIndices={exam.questions
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => {
            const a = answers[q.pqId];
            return a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
          })
          .map(({ i }) => i)}
        submitting={submitting}
      />
    </div>
  );
}
