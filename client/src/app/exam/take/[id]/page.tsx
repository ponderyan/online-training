'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

import SubmitConfirmModal from '../components/SubmitConfirmModal';
import AlertModal from '../components/AlertModal';
import ExamInfoBar from '../../components/ExamInfoBar';
import SaveIndicator from '../../components/SaveIndicator';
import QuestionContent from '../../components/QuestionContent';
import { useToast } from '@/components/Toast';

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
  isOpenBook?: boolean;
  openBookRules?: string;
  autoSaveInterval?: number;
  studentInfo?: {
    displayName: string;
    studentNumber: string | null;
    avatar: string | null;
    gender: string | null;
  };
}

export default function ExamTake() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedRef = useRef<string>('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    }).catch((err: any) => {
      setAlertModal({ type: 'TIME_REMINDER', message: `无法进入考试：${err.message || '未知错误'}` });
      setLoading(false);
    });
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

  const saveCurrentAnswer = useCallback(async () => {
    if (!exam || submitted) return;
    const qObj = exam.questions[currentQ];
    if (!qObj) return;
    const answer = answers[qObj.pqId];
    if (answer === undefined || answer === null) return;

    setSaveStatus('saving');
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/student/exams/${exam.examId}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questionId: qObj.questionId, paperQuestionId: qObj.pqId, answer }),
      });
      lastSavedRef.current = new Date().toISOString();
      setSaveStatus('saved');
      // localStorage 兜底
      try {
        const saved = localStorage.getItem(`exam_${exam.examId}_answers`);
        const all = saved ? JSON.parse(saved) : {};
        all[qObj.pqId] = answer;
        localStorage.setItem(`exam_${exam.examId}_answers`, JSON.stringify(all));
      } catch {}
    } catch {
      setSaveStatus('error');
      toast.error('答案保存失败，请检查网络。答案已暂存本地，恢复网络后会自动重试。');
    }
  }, [exam, currentQ, answers, submitted]);

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
      const res = await fetch(`/api/student/exams/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          answers: answerArray,
          tabSwitchLog: tabSwitchLogRef.current,
        }),
      });
      if (!res.ok) {
        // 交卷失败：提示用户并允许重试，不跳转、不清除 localStorage 答案
        let msg = `交卷失败（HTTP ${res.status}）`;
        try {
          const err = await res.json();
          if (err?.message) msg = `交卷失败：${err.message}`;
        } catch {}
        toast.error(msg + '，请检查网络后重试');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      localStorage.removeItem(`exam_${params.id}_answers`);
      router.push(`/exam/result/${params.id}`);
    } catch (e: any) {
      // 网络错误：答案仍在 localStorage，可重试
      toast.error('网络异常，交卷未成功，请检查网络后重试');
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

  // 离开页面确认提示 + localStorage 兜底（不自动交卷）
  useEffect(() => {
    if (loading || submitted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 只做 localStorage 兜底保存
      if (exam) {
        const curQ = exam.questions[currentQ];
        if (curQ) {
          const answer = answers[curQ.pqId];
          if (answer !== undefined && answer !== null) {
            try {
              const saved = localStorage.getItem(`exam_${exam.examId}_answers`);
              const all = saved ? JSON.parse(saved) : {};
              all[curQ.pqId] = answer;
              localStorage.setItem(`exam_${exam.examId}_answers`, JSON.stringify(all));
            } catch {}
          }
        }
      }
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, submitted, exam, currentQ, answers]);

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
        goToQuestion(Math.max(0, currentQ - 1));
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        goToQuestion(Math.min(exam.questions.length - 1, currentQ + 1));
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

      // 判断题 1=正确, 2=错误
      if (question.type === 'TRUE_FALSE') {
        if (question.options && question.options.length >= 2) {
          if (e.key === '1') { handleAnswer(question.pqId, question.options[0].label); e.preventDefault(); }
          if (e.key === '2') { handleAnswer(question.pqId, question.options[1].label); e.preventDefault(); }
        }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--paper)]">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold mb-2 text-[var(--ink-700)]">网络连接异常</h2>
        <p className="text-sm mb-4 text-[var(--ink-400)]">检测到网络不稳定，但你的答题数据已保存，请不要关闭页面</p>
        <p className="text-xs text-[var(--ink-300)]">正在尝试重新连接…</p>
      </div>
    </div>
  );

  // 自动保存定时器
  useEffect(() => {
    if (!exam || submitted) return;
    const interval = (exam.autoSaveInterval || 60) * 1000;
    saveTimerRef.current = setInterval(() => saveCurrentAnswer(), interval);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [exam, submitted, saveCurrentAnswer]);

  // 切换题目时先保存当前题
  const goToQuestion = async (index: number) => {
    await saveCurrentAnswer();
    setCurrentQ(index);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]"><p>加载中…</p></div>;
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
  const renderQuestion = (question: QuestionData, index: number) => {
    return (
      <QuestionContent
        question={question}
        questionNumber={index + 1}
        currentAnswer={answers[question.pqId]}
        onAnswer={handleAnswer}
        isMarked={markedQuestions.has(question.questionId)}
        onToggleMark={(qId) => {
          const token = localStorage.getItem('token');
          const isCurrentlyMarked = markedQuestions.has(qId);
          setMarkedQuestions(prev => {
            const next = new Set(prev);
            isCurrentlyMarked ? next.delete(qId) : next.add(qId);
            return next;
          });
          fetch(`/api/student/exams/${exam!.examId}/${isCurrentlyMarked ? 'unmark' : 'mark'}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ questionId: qId }),
          }).catch(() => {});
        }}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--paper)] overflow-hidden">
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
          <div className={`rounded-xl p-4 shadow-lg backdrop-blur-md ${
            msg.messageType === 'WARN'
              ? 'bg-[rgba(217,54,74,0.12)] border border-[rgba(217,54,74,0.25)]'
              : msg.messageType === 'AUTO_REMINDER'
              ? 'bg-[rgba(201,160,58,0.12)] border border-[rgba(201,160,58,0.25)]'
              : 'bg-[rgba(0,137,123,0.10)] border border-[rgba(0,137,123,0.2)]'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">
                {msg.messageType === 'WARN' ? '⚠️' :
                 msg.messageType === 'AUTO_REMINDER' ? '⏰' : 'ℹ️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink-700)]">
                  {msg.messageType === 'WARN' ? '监考员警告' :
                   msg.messageType === 'AUTO_REMINDER' ? '⏰ 时间提醒' :
                   '监考员消息'}
                </p>
                <p className="text-sm mt-1 text-[var(--ink-600)]">{msg.content}</p>
                <p className="text-[10px] mt-1 text-[var(--ink-400)]">
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
                className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none font-medium bg-white/80 text-[var(--ink-500)]">
                我知道了
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* ExamInfoBar — 深色顶部信息条（含计时进度条 + 题目信息） */}
      <ExamInfoBar
        examTitle={exam.title}
        isOpenBook={exam.isOpenBook}
        openBookRules={exam.openBookRules}
        studentDisplayName={exam.studentInfo?.displayName || '考生'}
        studentNumber={exam.studentInfo?.studentNumber || null}
        avatar={exam.studentInfo?.avatar || null}
        timeLeft={timeLeft}
        totalDuration={totalSeconds}
        currentQuestion={currentQ + 1}
        totalQuestions={totalQuestions}
        currentQuestionType={q?.type}
        currentQuestionScore={q?.score}
        timeMode={exam.timeMode}
        onShowSubmitModal={() => setShowSubmitModal(true)}
      />
      {/* 答题进度条 */}
      <div className="w-full h-1.5 bg-[var(--paper-dark)]">
        <div
          className="h-full transition-all duration-300 rounded-r bg-gradient-to-r from-[var(--fox)] to-[var(--fox-light)]"
          style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-[1100px] mx-auto w-full px-6 py-5 gap-5 overflow-hidden">
        {/* 答题卡 — 按题型分组 */}
        <div className="w-[230px] flex-shrink-0 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-sm font-semibold font-serif text-[var(--ink-700)]">答题卡</p>
              <span className="text-[11px] text-[var(--ink-400)] tabular-nums">
                <span className="text-[var(--fox)] font-semibold">{answeredCount}</span>/{totalQuestions}
              </span>
            </div>
            {questionTypeSummary.map(section => {
              const sectionQuestions = exam.questions.filter((q: any) => q.type === section.type);
              return (
                <div key={section.type} className="mb-4.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-[var(--ink-400)] mb-2 pb-1.5 border-b border-[var(--ink-100)]">
                    <span>{section.label}</span>
                    <span className="text-[var(--ink-300)]">{section.count}题</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {sectionQuestions.map((q: any) => {
                      const qIndex = exam.questions.indexOf(q);
                      const isAnswered = answers[q.pqId] !== undefined && answers[q.pqId] !== '' &&
                        !(Array.isArray(answers[q.pqId]) && answers[q.pqId].length === 0);
                      const isMarked = markedQuestions.has(q.questionId);
                      const isCurrent = qIndex === currentQ;
                      return (
                        <button key={q.pqId} onClick={() => goToQuestion(qIndex)}
                          className={`w-8 h-8 rounded-md text-[12px] font-semibold flex items-center justify-center cursor-pointer border-[1.5px] transition-all relative ${
                            qIndex === currentQ
                              ? 'bg-[var(--fox)] border-[var(--fox)] text-white shadow-[0_2px_8px_var(--fox-glow-strong)] scale-110'
                              : isMarked && isAnswered
                                ? 'bg-[var(--sage-glow)] border-[var(--gold)] text-[var(--sage)]'
                                : isMarked
                                  ? 'bg-[var(--gold-glow)] border-[var(--gold)] text-[var(--gold-dark)]'
                                  : isAnswered
                                    ? 'bg-[var(--sage-glow)] border-[var(--sage)] text-[var(--sage)]'
                                    : 'bg-[var(--paper-bright)] border-[var(--ink-100)] text-[var(--ink-400)] hover:border-[var(--fox)] hover:text-[var(--fox)]'
                          }`}
                          title={`第${qIndex + 1}题${isAnswered ? '（已答）' : '（未答）'}${isMarked ? ' ⭐' : ''}`}>
                          {qIndex + 1}
                          {isMarked && !isCurrent && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="mt-3.5 pt-3 border-t border-[var(--ink-100)]">
              {/* 答题进度统计 */}
              <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                <div className="py-1.5 rounded-md bg-[var(--sage-glow)]">
                  <p className="text-sm font-bold font-serif text-[var(--sage)] tabular-nums leading-none">{answeredCount}</p>
                  <p className="text-[9px] text-[var(--ink-400)] mt-0.5">已答</p>
                </div>
                <div className="py-1.5 rounded-md bg-[var(--paper-dark)]">
                  <p className="text-sm font-bold font-serif text-[var(--ink-500)] tabular-nums leading-none">{totalQuestions - answeredCount}</p>
                  <p className="text-[9px] text-[var(--ink-400)] mt-0.5">未答</p>
                </div>
                <div className="py-1.5 rounded-md bg-[var(--gold-glow)]">
                  <p className="text-sm font-bold font-serif text-[var(--gold-dark)] tabular-nums leading-none">{markedCount}</p>
                  <p className="text-[9px] text-[var(--ink-400)] mt-0.5">标记</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 gap-x-3 text-[10px] text-[var(--ink-400)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--fox)] border-[var(--fox)]" /> 当前
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--sage-glow)] border-[var(--sage)]" /> 已答
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--gold-glow)] border-[var(--gold)]" /> 标记
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--paper-bright)] border-[var(--ink-100)]" /> 未答
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 px-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer text-[var(--ink-400)]" title="答完选择题/判断题后自动跳转下一题">
              <input type="checkbox" checked={autoAdvance}
                onChange={() => { const next = !autoAdvance; setAutoAdvance(next); localStorage.setItem('exam-auto-advance', String(next)); }}
                className="accent-[var(--fox)] w-3.5 h-3.5" />
              自动跳转
            </label>
            <SaveIndicator status={saveStatus} lastSaved={lastSavedRef.current || undefined} />
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl px-10 py-8 bg-[var(--paper-bright)] border border-[var(--ink-100)] shadow-sm">
            {/* key 变化触发重新挂载 → 淡入动画 */}
            <div key={currentQ} className="animate-fadeInScale">
            {renderQuestion(q, currentQ)}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-[var(--ink-100)]">
              <button onClick={() => goToQuestion(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border-[1.5px] border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-500)] hover:border-[var(--ink-300)] hover:text-[var(--ink-700)] disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                ← 上一题
              </button>
              {currentQ < totalQuestions - 1 ? (
                <button onClick={() => goToQuestion(currentQ + 1)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--fox)] text-white hover:bg-[var(--fox-dark)] hover:shadow-[0_2px_8px_var(--fox-glow)] transition-all">
                  下一题 →
                </button>
              ) : (
                <button onClick={() => setShowSubmitModal(true)}
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--verm)] text-white hover:bg-[#b82d3f] hover:shadow-[0_2px_8px_var(--verm-glow)] transition-all">
                  {submitting ? '提交中…' : '交 卷'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="px-4 py-2 rounded-full text-[10px] backdrop-blur-md select-none bg-[rgba(26,23,18,0.65)] text-white/60">
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
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[rgba(26,23,18,0.88)] backdrop-blur-sm">
          <div className="bg-[var(--paper-bright)] rounded-2xl p-10 text-center max-w-sm shadow-lg border border-[var(--ink-100)]">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="m-0 mb-2 text-xl font-semibold font-serif text-[var(--ink-800)]">全屏模式已退出</h2>
            <p className="text-[var(--ink-500)] m-0 mb-6 leading-relaxed text-sm">考试需要全屏模式下进行。<br/>操作已记录，请重新进入全屏。</p>
            <button onClick={() => {
              document.documentElement.requestFullscreen().then(() => setFullscreenOverlay(false)).catch(() => toast.error('全屏被阻止，请按 F11 或浏览器全屏按钮'));
            }}
              className="px-8 py-3 text-base font-medium text-white border-none rounded-lg cursor-pointer bg-[var(--fox)] hover:bg-[var(--fox-dark)] hover:shadow-[0_4px_16px_var(--fox-glow-strong)] transition-all">
              点击重新进入全屏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
