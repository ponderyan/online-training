'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  const heartbeatRef = useRef<any>(null);
  const tabSwitchLogRef = useRef<{time: string; duration: number}[]>([]);
  const tabSwitchStartRef = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    fetch(`/api/student/exams/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      setExam(data);
      setTimeLeft(data.remainingTime || data.durationMinutes * 60);
      // 恢复已有答案
      const ans: Record<number, any> = {};
      for (const q of data.questions) {
        if (q.yourAnswer !== null) ans[q.pqId] = q.yourAnswer;
      }
      setAnswers(ans);
      setLoading(false);
    }).catch(() => router.push('/exam'));
  }, [params.id, router]);

  // 倒计时
  useEffect(() => {
    if (loading || submitted || !exam) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
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
      }).catch(() => {});
    }, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [loading, submitted, params.id]);

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

  const handleAnswer = useCallback((pqId: number, value: any) => {
    setAnswers(prev => ({ ...prev, [pqId]: value }));
  }, []);

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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

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
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ background: 'rgba(246,241,232,0.95)', borderBottom: '1px solid var(--ink-100)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{exam.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
              {answeredCount}/{totalQuestions} 已答
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : ''}`}
              style={{ color: timeLeft < 60 ? '#ef4444' : 'var(--fox)' }}>
              {formatTime(timeLeft)}
            </span>
            <button onClick={() => { if (confirm('确定交卷吗？未答的题目将计0分。')) handleSubmit(); }}
              disabled={submitting}
              className="btn btn-fox text-xs py-1.5 px-4">
              {submitting ? '提交中…' : '交 卷'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full px-6 py-6 gap-6">
        {/* Question navigation sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--ink-400)' }}>答题卡</p>
            <div className="grid grid-cols-5 gap-1.5">
              {exam.questions.map((q, i) => {
                const isAnswered = answers[q.pqId] !== undefined && answers[q.pqId] !== '' &&
                  !(Array.isArray(answers[q.pqId]) && answers[q.pqId].length === 0);
                return (
                  <button key={q.pqId}
                    onClick={() => setCurrentQ(i)}
                    className="w-8 h-8 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: i === currentQ ? 'var(--fox)' : isAnswered ? '#fef3e7' : '#faf8f5',
                      color: i === currentQ ? 'white' : isAnswered ? 'var(--fox)' : 'var(--ink-400)',
                      border: `1px solid ${i === currentQ ? 'var(--fox)' : isAnswered ? 'var(--fox)' : 'var(--ink-100)'}`,
                    }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 text-xs space-y-1.5" style={{ color: 'var(--ink-400)' }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--fox)' }}></span> 当前
                <span className="w-3 h-3 rounded ml-3" style={{ background: '#fef3e7', border: '1px solid var(--fox)' }}></span> 已答
                <span className="w-3 h-3 rounded ml-3" style={{ background: '#faf8f5', border: '1px solid var(--ink-100)' }}></span> 未答
              </div>
            </div>
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1">
          <div className="rounded-xl p-8" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                第 {currentQ + 1} / {totalQuestions} 题 · {q.score}分
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                {({ SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题', FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题' } as any)[q.type] || q.type}
              </span>
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
                <button onClick={() => { if (confirm('确定交卷吗？')) handleSubmit(); }}
                  disabled={submitting}
                  className="btn text-sm px-5 py-2" style={{ background: 'var(--fox)', color: 'white' }}>
                  {submitting ? '提交中…' : '交 卷'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
