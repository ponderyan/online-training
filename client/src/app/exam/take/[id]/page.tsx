'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

import SubmitConfirmModal from '../components/SubmitConfirmModal';
import AlertModal from '../components/AlertModal';

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
  timeMode: 'FIXED' | 'FLEXIBLE';
  durationMinutes: number;
  remainingTime: number;
  sessionStatus: string;
  questions: QuestionData[];
  shuffleOptions?: boolean;
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
  const [alertModal, setAlertModal] = useState<{type: 'FORCE_END'|'TAB_WARN'|'TIME_REMINDER'; message: string} | null>(null);
  const alertConfirmRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatFailCount = useRef(0);
  const [networkError, setNetworkError] = useState(false);
  const [fullscreenOverlay, setFullscreenOverlay] = useState(false);
  const [proctorMessages, setProctorMessages] = useState<any[]>([]);
  const dismissedMessagesRef = useRef<Set<number>>(new Set());
  const tabSwitchLogRef = useRef<{time: string; duration: number; type?: string}[]>([]);
  const tabSwitchStartRef = useRef<number | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const TAB_SWITCH_WARN = 3;
  const TAB_SWITCH_MAX = 5;

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
      setTimeLeft(data.remainingTime ?? data.durationMinutes * 60);
      // 恢复已有答案和标记状态
      const ans: Record<number, any> = {};
      const marked = new Set<number>();
      for (const q of data.questions) {
        if (q.yourAnswer !== null) ans[q.pqId] = q.yourAnswer;
        if (q.isMarked) marked.add(q.questionId);
      }
      // 从 localStorage 恢复（服务器答案优先）
      try {
        const saved = localStorage.getItem(`exam_${params.id}_answers`);
        if (saved) {
          const parsed = JSON.parse(saved);
          for (const [k, v] of Object.entries(parsed)) {
            const pk = parseInt(k);
            // localStorage 已有且服务器没有的答案（刷新前刚答的题）
            if (ans[pk] === undefined || ans[pk] === null) ans[pk] = v;
          }
        }
      } catch {}
      setAnswers(ans);
      setMarkedQuestions(marked);
      // 进入考试自动全屏
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.warn('全屏请求失败:', err));
      }
      setLoading(false);
    }).catch(() => router.push('/exam'));
  }, [params.id, router]);

  // 选项随机排序（确定性种子，同一考生每次相同）
  useEffect(() => {
    if (!exam || !exam.shuffleOptions) return;
    const seed = `${exam.examId}-${localStorage.getItem('userId') || '0'}`;
    let seedIdx = 0;
    const seededRandom = () => {
      seedIdx++;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i) + seedIdx;
        hash |= 0;
      }
      return Math.abs(hash % 10000) / 10000;
    };
    const shuffled = exam.questions.map(q => {
      if (!q.options || q.options.length <= 1) return q;
      const opts = [...q.options];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      return { ...q, options: opts };
    });
    setExam(prev => prev ? { ...prev, questions: shuffled } : prev);
  }, [exam?.examId, exam?.shuffleOptions]);

  const handleAnswer = useCallback((pqId: number, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [pqId]: value };
      // 自动保存到 localStorage
      try { localStorage.setItem(`exam_${params.id}_answers`, JSON.stringify(next)); } catch {}
      return next;
    });
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
      localStorage.removeItem(`exam_${params.id}_answers`);
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
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { if (timerRef.current) clearInterval(timerRef.current); submitRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, submitted, exam]);

  // 心跳（每30秒）
  useEffect(() => {
    if (loading || submitted) return;
    const token = localStorage.getItem('token');
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/exams/${params.id}/heartbeat`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          heartbeatFailCount.current = 0;
          const data = await res.json();

          // === P2: 检查会话状态（强制交卷/超时/终止）===
          if (data.sessionStatus && data.sessionStatus !== 'ACTIVE') {
            alertConfirmRef.current = () => {
              setSubmitted(true);
              if (timerRef.current) clearInterval(timerRef.current);
              router.push('/exam');
            };
            setAlertModal({ type: 'FORCE_END', message: '考试已被监考员结束，系统将退出答题页面。' });
            return;
          }

          // === P1: 同步服务端剩余时间（监考延长后生效）===
          if (typeof data.remainingTime === 'number') {
            setTimeLeft(data.remainingTime);
          }

          if (data.messages?.length > 0) {
            const newMessages = data.messages.filter(
              (m: any) => !dismissedMessagesRef.current.has(m.id)
            );
            if (newMessages.length > 0) {
              setProctorMessages(prev => {
                const existing = new Set(prev.map((m: any) => m.id));
                return [...prev, ...newMessages.filter((m: any) => !existing.has(m.id))];
              });
              // TIME_REMINDER 消息额外弹出居中模态
              for (const m of newMessages) {
                if (m.messageType === 'AUTO_REMINDER') {
                  const cleanMsg = m.content.replace(/ @threshold:\d+$/, '');
                  setAlertModal({ type: 'TIME_REMINDER', message: cleanMsg });
                }
                // 非 WARN 消息 5 秒后自动消失
                if (m.messageType !== 'WARN') {
                  const msgId = m.id;
                  setTimeout(async () => {
                    const token = localStorage.getItem('token');
                    await fetch(`/api/student/exams/${params.id}/messages/${msgId}/read`, {
                      method: 'POST', headers: { Authorization: `Bearer ${token}` },
                    }).catch(() => {});
                    dismissedMessagesRef.current.add(msgId);
                    setProctorMessages(prev => prev.filter((x: any) => x.id !== msgId));
                  }, 5000);
                }
              }
            }
          }
        } else {
          heartbeatFailCount.current++;
        }
      } catch {
        heartbeatFailCount.current++;
        if (heartbeatFailCount.current >= 3) setNetworkError(true);
      }
    }, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [loading, submitted, params.id]);

  // 离开页面确认提示（FIXED 模式自动交卷）
  useEffect(() => {
    if (loading || submitted) return;
    const isFIXED = exam?.timeMode === 'FIXED';
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFIXED) {
        const token = localStorage.getItem('token');
        fetch(`/api/student/exams/${params.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            answers: Object.entries(answers).map(([pqId, answer]) => ({
              paperQuestionId: parseInt(pqId),
              questionId: exam!.questions.find(q => q.pqId === parseInt(pqId))!.questionId,
              answer,
            })),
            tabSwitchLog: [...tabSwitchLogRef.current, { time: new Date().toISOString(), duration: 0, type: 'PAGE_CLOSE' as const }],
          }),
          keepalive: true,
        });
      }
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, submitted, exam?.timeMode, answers]);

  // 全屏退出监测 + 重新进入
  useEffect(() => {
    if (loading || submitted) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          setFullscreenOverlay(true);
          setTabSwitchCount(prev => {
            const next = prev + 1;
            if (next >= TAB_SWITCH_MAX) {
              setTimeout(() => submitRef.current(), 100);
            } else {
              setAlertModal({ type: 'TAB_WARN', message: `⚠️ 检测到全屏退出（${next}/${TAB_SWITCH_MAX}次），请重新进入全屏模式` });
            }
            return next;
          });
        });
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [loading, submitted]);

  // === P3: 拦截浏览器后退/前进（FIXED 硬拦截，FLEXIBLE 确认）===
  useEffect(() => {
    if (loading || submitted) return;
    const isFIXED = exam?.timeMode === 'FIXED';
    const currentUrl = window.location.href;
    window.history.pushState({ exam: true }, '', currentUrl);
    const handlePopState = () => {
      if (isFIXED) {
        // FIXED 模式：硬拦截，不给离开选项
        window.history.pushState({ exam: true }, '', currentUrl);
        setAlertModal({ type: 'TAB_WARN', message: '统一开考模式下不允许离开考试页面' });
      } else {
        // FLEXIBLE 模式：保留确认弹窗，记录违规
        const confirmLeave = window.confirm('考试正在进行中，确定要离开吗？离开后考试不会自动交卷，回来后可继续作答。');
        if (!confirmLeave) {
          window.history.pushState({ exam: true }, '', currentUrl);
        } else {
          tabSwitchLogRef.current = [...tabSwitchLogRef.current, { time: new Date().toISOString(), duration: 0, type: 'MANUAL_LEAVE' }];
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loading, submitted, exam?.timeMode]);

  // 键盘快捷键
  useEffect(() => {
    if (!exam || submitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 阻止 F5 / Ctrl+R / Cmd+R 刷新
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 阻止 ESC（防止退出全屏后关闭弹窗）
      if (e.key === 'Escape') {
        e.preventDefault();
        setAlertModal({ type: 'TAB_WARN', message: '考试期间请保持全屏模式' });
        return;
      }
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

  // 切屏检测 + 惩罚
  useEffect(() => {
    if (loading || submitted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchStartRef.current = Date.now();
        setTabSwitchCount(prev => {
          const next = prev + 1;
          if (next >= TAB_SWITCH_MAX) {
            setTimeout(() => submitRef.current(), 100);
            return next;
          }
          if (next >= TAB_SWITCH_WARN) {
            setAlertModal({ type: 'TAB_WARN', message: `⚠️ 检测到切屏操作（${next}/${TAB_SWITCH_MAX}次），再次切屏将被强制交卷` });
          }
          return next;
        });
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

  // 禁止复制粘贴（考试中生效）
  useEffect(() => {
    if (loading || submitted) return;
    const preventEvent = (e: Event) => { e.preventDefault(); };
    document.addEventListener('copy', preventEvent);
    document.addEventListener('cut', preventEvent);
    document.addEventListener('paste', preventEvent);
    document.addEventListener('contextmenu', preventEvent);
    return () => {
      document.removeEventListener('copy', preventEvent);
      document.removeEventListener('cut', preventEvent);
      document.removeEventListener('paste', preventEvent);
      document.removeEventListener('contextmenu', preventEvent);
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
  const markedCount = markedQuestions.size;
  const totalSeconds = exam.durationMinutes * 60;
  const questionTypeSummary = (() => {
    const map: Record<string, { type: string; label: string; count: number }> = {};
    exam.questions.forEach((q: any) => {
      const label = TYPE_NAMES[q.type] || q.type;
      if (!map[q.type]) map[q.type] = { type: q.type, label, count: 0 };
      map[q.type].count++;
    });
    return Object.values(map);
  })();

  // 渲染题目
  const renderQuestion = (question: QuestionData) => {
    switch (question.type) {
      case 'SINGLE_CHOICE':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {question.options?.map(opt => {
              const isSelected = answers[question.pqId] === opt.label;
              return (
                <button key={opt.id} onClick={() => handleAnswer(question.pqId, opt.label)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '12px 16px', border: `2px solid ${isSelected ? '#e87a30' : '#e5e7eb'}`,
                    borderRadius: 10, background: isSelected ? '#fff7ed' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontSize: 15, lineHeight: 1.5,
                    transition: 'all 0.15s ease', boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 12,
                    background: isSelected ? '#e87a30' : '#f3f4f6', color: isSelected ? '#fff' : '#666',
                  }}>{opt.label}</span>
                  <span style={{ flex: 1, fontSize: 14 }}>{opt.content}</span>
                  {isSelected && <span style={{ color: '#e87a30', fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
          </div>
        );
      case 'MULTIPLE_CHOICE': {
        const selected: string[] = answers[question.pqId] || [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {question.options?.map(opt => {
              const isSelected = selected.includes(opt.label);
              return (
                <button key={opt.id} onClick={() => {
                  const newSel = isSelected ? selected.filter(s => s !== opt.label) : [...selected, opt.label];
                  handleAnswer(question.pqId, newSel);
                }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '12px 16px', border: `2px solid ${isSelected ? '#e87a30' : '#e5e7eb'}`,
                    borderRadius: 10, background: isSelected ? '#fff7ed' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontSize: 15, lineHeight: 1.5,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 12,
                    background: isSelected ? '#e87a30' : '#f3f4f6', color: isSelected ? '#fff' : '#666',
                  }}>{opt.label}</span>
                  <span style={{ flex: 1, fontSize: 14 }}>{opt.content}</span>
                  {isSelected && <span style={{ color: '#e87a30', fontSize: 16 }}>✓</span>}
                </button>
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
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-pulse { animation: pulse 2s ease-in-out infinite; }
        .animate-pulse-fast { animation: pulse 0.8s ease-in-out infinite; }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      {/* 监考消息弹窗 */}
      {proctorMessages.map(msg => (
        <div key={msg.id}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          style={{ animation: 'slideDown 0.3s ease-out' }}>
          <div className="rounded-xl p-4 shadow-lg backdrop-blur-md" style={{
            background: msg.messageType === 'WARN' ? 'rgba(254, 202, 202, 0.95)' :
                         msg.messageType === 'AUTO_REMINDER' ? 'rgba(254, 243, 199, 0.95)' :
                         'rgba(219, 234, 254, 0.95)',
            border: `1px solid ${
              msg.messageType === 'WARN' ? '#fca5a5' :
              msg.messageType === 'AUTO_REMINDER' ? '#fcd34d' :
              '#93c5fd'
            }`,
          }}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">
                {msg.messageType === 'WARN' ? '⚠️' :
                 msg.messageType === 'AUTO_REMINDER' ? '⏰' : 'ℹ️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>
                  {msg.messageType === 'WARN' ? '监考员警告' :
                   msg.messageType === 'AUTO_REMINDER' ? '⏰ 时间提醒' :
                   '监考员消息'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-600)' }}>{msg.content}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--ink-400)' }}>
                  {msg.senderName} · {new Date(msg.sentAt).toLocaleTimeString('zh-CN')}
                </p>
              </div>
              <button onClick={async () => {
                const token = localStorage.getItem('token');
                await fetch(`/api/student/exams/${params.id}/messages/${msg.id}/read`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
                dismissedMessagesRef.current.add(msg.id);
                setProctorMessages(prev => prev.filter(m => m.id !== msg.id));
              }}
                className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none font-medium"
                style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--ink-500)' }}>
                我知道了
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Top bar — 紧凑信息头 (Part 10) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>{exam.title}</span>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, color: '#666', flexWrap: 'wrap' }}>
            {questionTypeSummary.map(qt => (
              <span key={qt.type} style={{ padding: '1px 7px', background: '#f3f4f6', borderRadius: 4, whiteSpace: 'nowrap' }}>
                {qt.label}×{qt.count}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {markedCount > 0 && <span style={{ fontSize: 12, color: '#e87a30' }}>⭐ {markedCount}</span>}
          <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>
            {answeredCount}/{totalQuestions} ({totalQuestions > 0 ? Math.round(answeredCount / totalQuestions * 100) : 0}%)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 100, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${totalSeconds > 0 ? (1 - timeLeft / totalSeconds) * 100 : 0}%`,
                height: '100%', borderRadius: 3,
                background: timeLeft <= 60 ? '#ef4444' : timeLeft <= 300 ? '#f59e0b' : '#22c55e',
                transition: 'width 1s linear',
              }} />
            </div>
            <span className={`font-mono font-bold ${timeLeft < 60 ? 'animate-pulse-fast' : timeLeft < 300 ? 'animate-pulse' : ''}`}
              style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: timeLeft <= 60 ? '#ef4444' : timeLeft <= 300 ? '#f59e0b' : '#111' }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#e87a30', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {submitting ? '提交中…' : '交卷'}
          </button>
        </div>
      </div>
      {/* 全宽答题进度条 */}
      <div style={{ width: '100%', height: 3, background: '#f3f4f6' }}>
        <div style={{
          width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
          height: '100%', background: 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full px-6 py-6 gap-6">
        {/* 答题卡 — 按题型分组 (Part 11) */}
        <div style={{ width: 230, flexShrink: 0, overflowY: 'auto' }}>
          <div className="sticky top-24">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#333' }}>答题卡</p>
            {questionTypeSummary.map(section => {
              const sectionQuestions = exam.questions.filter((q: any) => q.type === section.type);
              return (
                <div key={section.type} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#999', marginBottom: 6, borderBottom: '1px solid #eee', paddingBottom: 3 }}>
                    {section.label}（{section.count}）
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                    {sectionQuestions.map((q: any) => {
                      const qIndex = exam.questions.indexOf(q);
                      const isAnswered = answers[q.pqId] !== undefined && answers[q.pqId] !== '' &&
                        !(Array.isArray(answers[q.pqId]) && answers[q.pqId].length === 0);
                      const isMarked = markedQuestions.has(q.questionId);
                      const isCurrent = qIndex === currentQ;
                      let bg = '#fff', bd = '#e5e7eb', fg = '#666';
                      if (isCurrent) { bg = '#fff7ed'; bd = '#e87a30'; fg = '#e87a30'; }
                      else if (isMarked) { bg = '#fef9c3'; bd = '#eab308'; fg = '#ca8a04'; }
                      else if (isAnswered) { bg = '#dcfce7'; bd = '#22c55e'; fg = '#16a34a'; }
                      return (
                        <button key={q.pqId} onClick={() => setCurrentQ(qIndex)}
                          style={{
                            width: 30, height: 30, padding: 0, border: `1px solid ${bd}`,
                            borderRadius: 4, background: bg, cursor: 'pointer',
                            fontSize: 11, fontWeight: 500, color: fg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title={`第${qIndex + 1}题${isAnswered ? '（已答）' : '（未答）'}${isMarked ? ' ⭐' : ''}`}>
                          {qIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', gap: 8, fontSize: 10, color: '#999', flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#dcfce7', borderRadius: 2, marginRight: 2, border: '1px solid #22c55e' }}/> 已答</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#fff', borderRadius: 2, marginRight: 2, border: '1px solid #e5e7eb' }}/> 未答</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#fff7ed', borderRadius: 2, marginRight: 2, border: '1px solid #e87a30' }}/> 当前</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#fef9c3', borderRadius: 2, marginRight: 2, border: '1px solid #eab308' }}/> 标记</span>
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
      <AlertModal
        open={alertModal !== null}
        type={alertModal?.type || 'TAB_WARN'}
        message={alertModal?.message || ''}
        onClose={() => setAlertModal(null)}
        onConfirm={alertConfirmRef.current ? () => { alertConfirmRef.current!(); alertConfirmRef.current = null; } : undefined}
        autoCloseMs={3000}
      />
      {fullscreenOverlay && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>全屏模式已退出</h2>
            <p style={{ color: '#666', margin: '0 0 24px', lineHeight: 1.5 }}>考试需要全屏模式下进行。<br/>操作已记录，请重新进入全屏。</p>
            <button onClick={() => {
              document.documentElement.requestFullscreen().then(() => setFullscreenOverlay(false)).catch(() => alert('全屏被阻止，请按 F11 或浏览器全屏按钮'));
            }} style={{
              padding: '12px 32px', fontSize: 16, fontWeight: 500,
              background: '#e87a30', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
              点击重新进入全屏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
