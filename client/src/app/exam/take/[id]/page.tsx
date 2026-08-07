'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';

import SubmitConfirmModal from '../components/SubmitConfirmModal';
import AlertModal from '../components/AlertModal';
import ExamPreCheck from '../components/ExamPreCheck';
import AnswerCardPanel from '../components/AnswerCardPanel';
import NetworkErrorScreen from '../components/NetworkErrorScreen';
import ExamInfoBar from '../../components/ExamInfoBar';
import SaveIndicator from '../../components/SaveIndicator';
import QuestionContent from '../../components/QuestionContent';
import { useToast } from '@/components/Toast';
import { useExamTimer } from '../hooks/use-exam-timer';
import { useTabSwitch } from '../hooks/use-tab-switch';
import { useAutoSave } from '../hooks/use-auto-save';
import { useFullscreenGuard } from '../hooks/use-fullscreen-guard';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useInactiveDetection } from '../hooks/use-inactive-detection';
import { useNavigationGuard } from '../hooks/use-navigation-guard';
import { useCopyProtection } from '../hooks/use-copy-protection';

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
  tabSwitchLimit?: number;
  rules?: { lateEntryMinutes: number; earlyExitMinutes: number; countdownWarningMinutes: number };
  startedAt?: string;
  studentInfo?: { displayName: string; studentNumber: string | null; avatar: string | null; gender: string | null };
}

export default function ExamTake() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  // === Core state ===
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [examReady, setExamReady] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAnswerCard, setShowAnswerCard] = useState(false); // 移动端答题卡抽屉

  const [alertModal, setAlertModal] = useState<{type: 'FORCE_END'|'TAB_WARN'|'TIME_REMINDER'; message: string} | null>(null);
  const alertConfirmRef = useRef<(() => void) | null>(null);
  const [cardFilter, setCardFilter] = useState<'all' | 'unanswered' | 'marked'>('all');
  const [networkError, setNetworkError] = useState(false);
  const [proctorMessages, setProctorMessages] = useState<any[]>([]);
  const dismissedMessagesRef = useRef<Set<number>>(new Set());
  const heartbeatRef = useRef<any>(null);
  const heartbeatFailCount = useRef(0);

  const TAB_SWITCH_MAX = exam?.tabSwitchLimit || 5;
  const examActive = !loading && !submitted && !!exam && examReady;

  // === Data fetch ===
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const savedAutoAdvance = localStorage.getItem('exam-auto-advance');
    if (savedAutoAdvance !== null) setAutoAdvance(savedAutoAdvance === 'true');

    fetch(`/api/student/exams/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('考试不可用'); return r.json(); })
      .then(data => {
        setExam(data);
        const ans: Record<number, any> = {};
        const marked = new Set<number>();
        for (const q of data.questions) {
          if (q.yourAnswer !== null) ans[q.pqId] = q.yourAnswer;
          if (q.isMarked) marked.add(q.questionId);
        }
        try {
          const saved = localStorage.getItem(`exam_${params.id}_answers`);
          if (saved) {
            const parsed = JSON.parse(saved);
            for (const [k, v] of Object.entries(parsed)) {
              const pk = parseInt(k);
              if (ans[pk] === undefined || ans[pk] === null) ans[pk] = v;
            }
          }
        } catch {}
        setAnswers(ans);
        setMarkedQuestions(marked);
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setAlertModal({ type: 'TIME_REMINDER', message: `无法进入考试：${err.message || '未知错误'}` });
        setLoading(false);
      });
  }, [params.id, router]);

  // 选项随机排序
  useEffect(() => {
    if (!exam || !exam.shuffleOptions) return;
    const seed = `${exam.examId}-${localStorage.getItem('userId') || '0'}`;
    let seedIdx = 0;
    const seededRandom = () => {
      seedIdx++;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash) + seed.charCodeAt(i) + seedIdx; hash |= 0; }
      return Math.abs(hash % 10000) / 10000;
    };
    const shuffled = exam.questions.map(q => {
      if (!q.options || q.options.length <= 1) return q;
      const opts = [...q.options];
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(seededRandom() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      return { ...q, options: opts };
    });
    setExam(prev => prev ? { ...prev, questions: shuffled } : prev);
  }, [exam?.examId, exam?.shuffleOptions]);

  // === Answer handling ===
  const handleAnswer = useCallback((pqId: number, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [pqId]: value };
      try { localStorage.setItem(`exam_${params.id}_answers`, JSON.stringify(next)); } catch {}
      return next;
    });
    if (autoAdvance && exam) {
      const q = exam.questions.find(qx => qx.pqId === pqId);
      if (q && (q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE')) {
        const idx = exam.questions.findIndex(qx => qx.pqId === pqId);
        if (idx !== -1 && idx < exam.questions.length - 1) setTimeout(() => setCurrentQ(idx + 1), 200);
      }
    }
  }, [autoAdvance, exam, params.id]);

  // === Submit ===
  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');
    const answerArray = Object.entries(answers)
      .map(([pqId, answer]) => {
        const qObj = exam!.questions.find(q => q.pqId === parseInt(pqId));
        if (!qObj) return null;
        return { paperQuestionId: parseInt(pqId), questionId: qObj.questionId, answer };
      })
      .filter(Boolean) as { paperQuestionId: number; questionId: number; answer: any }[];
    try {
      const res = await fetch(`/api/student/exams/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: answerArray, tabSwitchLog: getTabSwitchLog() }),
      });
      if (!res.ok) {
        let msg = `交卷失败（HTTP ${res.status}）`;
        try { const err = await res.json(); if (err?.message) msg = `交卷失败：${err.message}`; } catch {}
        toast.error(msg + '，请检查网络后重试');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      stopTimer();
      localStorage.removeItem(`exam_${params.id}_answers`);
      router.push(`/exam/result/${params.id}`);
    } catch {
      let retried = false;
      for (let i = 1; i <= 3; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryRes = await fetch(`/api/student/exams/${params.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ answers: answerArray, tabSwitchLog: getTabSwitchLog() }),
          });
          if (retryRes.ok) {
            setSubmitted(true);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            stopTimer();
            localStorage.removeItem(`exam_${params.id}_answers`);
            router.push(`/exam/result/${params.id}`);
            retried = true;
            break;
          }
        } catch {}
      }
      if (!retried) { toast.error('网络异常，交卷未成功，请检查网络后重试'); setSubmitting(false); }
    }
  };

  // === Hooks ===
  const submitRef = useRef<() => Promise<void>>(async () => {});
  submitRef.current = handleSubmit;

  const { timeLeft, setTimeLeft: syncServerTime, stop: stopTimer } = useExamTimer({
    initialSeconds: exam?.remainingTime ?? (exam?.durationMinutes ?? 0) * 60,
    active: examActive,
    onTimeUp: () => submitRef.current(),
    onReminder: (sec) => {
      setAlertModal({ type: 'TIME_REMINDER', message: sec === 300 ? '⏰ 距离考试结束还有 5 分钟，请注意把握时间' : '⏰ 距离考试结束仅剩 1 分钟！' });
    },
  });

  const { tabSwitchCount, getLog: getTabSwitchLog, addManualLog } = useTabSwitch({
    active: examActive,
    maxSwitches: TAB_SWITCH_MAX,
    onWarn: (count, max) => setAlertModal({ type: 'TAB_WARN', message: `⚠️ 检测到切屏操作（${count}/${max}次），再次切屏将被强制交卷` }),
    onExceed: () => submitRef.current(),
  });

  const { saveStatus, lastSavedRef, saveCurrentAnswer } = useAutoSave({
    exam, currentQ, answers, submitted,
    onError: (msg) => toast.error(msg),
  });

  const { fullscreenOverlay, reenterFullscreen } = useFullscreenGuard({
    active: !loading && !submitted,
    onExit: () => { addManualLog('FULLSCREEN_EXIT'); setAlertModal({ type: 'TAB_WARN', message: '⚠️ 检测到全屏退出，请重新进入全屏模式' }); },
  });

  const goToQuestion = useCallback(async (index: number) => {
    await saveCurrentAnswer();
    setCurrentQ(index);
  }, [saveCurrentAnswer]);

  useKeyboardShortcuts({
    active: !!exam && !submitted,
    exam,
    currentQ,
    onNavigate: goToQuestion,
    onAnswer: handleAnswer,
    onSubmit: () => setShowSubmitModal(true),
    onEscape: () => setAlertModal({ type: 'TAB_WARN', message: '考试期间请保持全屏模式' }),
  });

  useInactiveDetection({
    active: examActive,
    onWarn: () => setAlertModal({ type: 'TIME_REMINDER', message: '⚠️ 检测到长时间无操作，2分钟后系统将自动交卷。如需继续答题，请操作页面。' }),
    onSubmit: () => submitRef.current(),
  });

  useNavigationGuard({
    active: !loading && !submitted,
    timeMode: exam?.timeMode,
    onBeforeUnload: () => {
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
    },
    onFixedBlock: () => setAlertModal({ type: 'TAB_WARN', message: '统一开考模式下不允许离开考试页面' }),
    onManualLeave: () => addManualLog('MANUAL_LEAVE'),
  });

  useCopyProtection(!loading && !submitted);

  // === Heartbeat (30s) ===
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
          if (data.sessionStatus && data.sessionStatus !== 'ACTIVE') {
            alertConfirmRef.current = () => { setSubmitted(true); stopTimer(); router.push('/exam'); };
            setAlertModal({ type: 'FORCE_END', message: '考试已被监考员结束，系统将退出答题页面。' });
            return;
          }
          if (typeof data.remainingTime === 'number') syncServerTime(data.remainingTime);
          if (data.messages?.length > 0) {
            const newMessages = data.messages.filter((m: any) => !dismissedMessagesRef.current.has(m.id));
            if (newMessages.length > 0) {
              setProctorMessages(prev => {
                const existing = new Set(prev.map((m: any) => m.id));
                return [...prev, ...newMessages.filter((m: any) => !existing.has(m.id))];
              });
              for (const m of newMessages) {
                if (m.messageType === 'AUTO_REMINDER') {
                  setAlertModal({ type: 'TIME_REMINDER', message: m.content.replace(/ @threshold:\d+$/, '') });
                }
                if (m.messageType !== 'WARN') {
                  const msgId = m.id;
                  setTimeout(async () => {
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
        } else { heartbeatFailCount.current++; }
      } catch {
        heartbeatFailCount.current++;
        if (heartbeatFailCount.current >= 3) setNetworkError(true);
      }
    }, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [loading, submitted, params.id]);

  // 网络错误自动重连
  useEffect(() => {
    if (!networkError) return;
    const timer = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/student/exams/${params.id}/heartbeat`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { setNetworkError(false); heartbeatFailCount.current = 0; }
      } catch {}
    }, 10000);
    return () => clearInterval(timer);
  }, [networkError, params.id]);

  // === Early returns ===
  if (networkError) return (
    <NetworkErrorScreen onRetry={async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/student/exams/${params.id}/heartbeat`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { setNetworkError(false); heartbeatFailCount.current = 0; toast.success('网络已恢复'); }
        else toast.error('仍无法连接，请稍后再试');
      } catch { toast.error('仍无法连接，请检查网络'); }
    }} />
  );

  if (loading) return <div className="min-h-dvh-fb flex items-center justify-center bg-[var(--paper)]"><p>加载中…</p></div>;
  if (!exam) return null;
  if (!exam.questions || exam.questions.length === 0) return <div className="min-h-dvh-fb flex items-center justify-center bg-[var(--paper)]"><p className="text-[var(--ink-400)]">该考试暂无题目</p></div>;
  if (!examReady) return <ExamPreCheck exam={exam} onStart={() => setExamReady(true)} />;

  const q = exam.questions[currentQ];
  if (!q) return <div className="min-h-dvh-fb flex items-center justify-center bg-[var(--paper)]"><p className="text-[var(--ink-400)]">题目加载异常，请刷新页面</p></div>;

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;
  const totalSeconds = exam.durationMinutes * 60;

  // === Main render ===
  return (
    <div className="h-dvh-fb flex flex-col bg-[var(--paper)] overflow-hidden">
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* 监考消息 */}
      {proctorMessages.map(msg => (
        <div key={msg.id} className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4" style={{ animation: 'slideDown 0.3s ease-out' }}>
          <div className={`rounded-xl p-4 shadow-lg backdrop-blur-md ${
            msg.messageType === 'WARN' ? 'bg-[rgba(217,54,74,0.12)] border border-[rgba(217,54,74,0.25)]'
            : msg.messageType === 'AUTO_REMINDER' ? 'bg-[rgba(201,160,58,0.12)] border border-[rgba(201,160,58,0.25)]'
            : 'bg-[rgba(0,137,123,0.10)] border border-[rgba(0,137,123,0.2)]'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">{msg.messageType === 'WARN' ? '⚠️' : msg.messageType === 'AUTO_REMINDER' ? '⏰' : 'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink-700)]">{msg.messageType === 'WARN' ? '监考员警告' : msg.messageType === 'AUTO_REMINDER' ? '⏰ 时间提醒' : '监考员消息'}</p>
                <p className="text-sm mt-1 text-[var(--ink-600)]">{msg.content}</p>
                <p className="text-[10px] mt-1 text-[var(--ink-400)]">{msg.senderName} · {new Date(msg.sentAt).toLocaleTimeString('zh-CN')}</p>
              </div>
              <button onClick={async () => {
                const token = localStorage.getItem('token');
                await fetch(`/api/student/exams/${params.id}/messages/${msg.id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                dismissedMessagesRef.current.add(msg.id);
                setProctorMessages(prev => prev.filter(m => m.id !== msg.id));
              }} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none font-medium bg-[var(--paper-bright)]/80 text-[var(--ink-500)]">我知道了</button>
            </div>
          </div>
        </div>
      ))}

      <ExamInfoBar
        examTitle={exam.title} isOpenBook={exam.isOpenBook} openBookRules={exam.openBookRules}
        studentDisplayName={exam.studentInfo?.displayName || '考生'} studentNumber={exam.studentInfo?.studentNumber || null}
        avatar={exam.studentInfo?.avatar || null} timeLeft={timeLeft} totalDuration={totalSeconds}
        currentQuestion={currentQ + 1} totalQuestions={totalQuestions}
        currentQuestionType={q?.type} currentQuestionScore={q?.score}
        timeMode={exam.timeMode} countdownWarningMinutes={exam.rules?.countdownWarningMinutes ?? 5}
        earlyExitMinutes={exam.rules?.earlyExitMinutes ?? 0} startedAt={exam.startedAt}
        onShowSubmitModal={() => setShowSubmitModal(true)}
      />

      {/* 答题进度条 */}
      <div className="w-full h-1.5 bg-[var(--paper-dark)]">
        <div className="h-full transition-all duration-300 rounded-r bg-gradient-to-r from-[var(--fox)] to-[var(--fox-light)]"
          style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-[1100px] mx-auto w-full px-3 sm:px-6 py-3 sm:py-5 gap-3 sm:gap-5 overflow-hidden">
        {/* 桌面答题卡（移动端收入底部抽屉，见下） */}
        <div className="hidden lg:block">
          <AnswerCardPanel
            questions={exam.questions} answers={answers} markedQuestions={markedQuestions}
            currentQ={currentQ} cardFilter={cardFilter} onFilterChange={setCardFilter}
            onGoToQuestion={goToQuestion} typeNames={TYPE_NAMES}
          />
        </div>
        {showAnswerCard && (
          <div className="lg:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-[rgba(26,23,18,0.45)]" onClick={() => setShowAnswerCard(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-[var(--paper-bright)] rounded-t-2xl border-t border-[var(--ink-100)] p-4 overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold font-serif text-[var(--ink-700)]">答题卡</span>
                <button onClick={() => setShowAnswerCard(false)} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer bg-[var(--paper-dark)] text-[var(--ink-500)] border-none">收起</button>
              </div>
              <AnswerCardPanel
                questions={exam.questions} answers={answers} markedQuestions={markedQuestions}
                currentQ={currentQ} cardFilter={cardFilter} onFilterChange={setCardFilter}
                onGoToQuestion={(i) => { goToQuestion(i); setShowAnswerCard(false); }} typeNames={TYPE_NAMES}
              />
            </div>
          </div>
        )}
        {/* 移动端浮动答题卡按钮 */}
        <button
          onClick={() => setShowAnswerCard(true)}
          className="lg:hidden fixed right-4 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--ink-900)] text-white text-sm shadow-lg cursor-pointer border-none"
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <LayoutGrid size={16} />
          <span className="tabular-nums">{answeredCount}/{totalQuestions}</span>
        </button>

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
            <div key={currentQ} className="animate-fadeInScale">
              <QuestionContent
                question={q} questionNumber={currentQ + 1} currentAnswer={answers[q.pqId]}
                onAnswer={handleAnswer} isMarked={markedQuestions.has(q.questionId)}
                onToggleMark={(qId) => {
                  const isCurrentlyMarked = markedQuestions.has(qId);
                  setMarkedQuestions(prev => { const next = new Set(prev); isCurrentlyMarked ? next.delete(qId) : next.add(qId); return next; });
                  fetch(`/api/student/exams/${exam.examId}/${isCurrentlyMarked ? 'unmark' : 'mark'}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ questionId: qId }),
                  }).catch(() => {});
                }}
              />
            </div>
            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-[var(--ink-100)]">
              <button onClick={() => goToQuestion(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border-[1.5px] border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-500)] hover:border-[var(--ink-300)] hover:text-[var(--ink-700)] disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                ← 上一题
              </button>
              {currentQ < totalQuestions - 1 ? (
                <button onClick={() => goToQuestion(currentQ + 1)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--fox)] text-white hover:bg-[var(--fox-dark)] hover:shadow-[0_2px_8px_var(--fox-glow)] transition-all">
                  下一题 →
                </button>
              ) : (
                <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--verm)] text-white hover:bg-[#b82d3f] hover:shadow-[0_2px_8px_var(--verm-glow)] transition-all">
                  {submitting ? '提交中…' : '交 卷'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shortcut hint */}
      <div className="hidden [@media(pointer:fine)]:block fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="px-4 py-2 rounded-full text-[10px] backdrop-blur-md select-none bg-[rgba(26,23,18,0.65)] text-white/60">
          ← → 切换题目 · A~D 快速选择 · Ctrl+Enter 交卷
        </div>
      </div>

      <SubmitConfirmModal
        open={showSubmitModal} onClose={() => setShowSubmitModal(false)} onConfirm={handleSubmit}
        answeredCount={answeredCount} totalCount={totalQuestions} markedCount={markedQuestions.size}
        unansweredIndices={exam.questions.map((q, i) => ({ q, i })).filter(({ q }) => {
          const a = answers[q.pqId]; return a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
        }).map(({ i }) => i)}
        submitting={submitting}
      />
      <AlertModal
        open={alertModal !== null} type={alertModal?.type || 'TAB_WARN'} message={alertModal?.message || ''}
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
            <button onClick={() => reenterFullscreen().catch(() => toast.error('全屏被阻止，请按 F11 或浏览器全屏按钮'))}
              className="px-8 py-3 text-base font-medium text-white border-none rounded-lg cursor-pointer bg-[var(--fox)] hover:bg-[var(--fox-dark)] hover:shadow-[0_4px_16px_var(--fox-glow-strong)] transition-all">
              点击重新进入全屏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
