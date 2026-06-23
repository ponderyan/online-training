'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';

interface ExamItem {
  id: number;
  title: string;
  paperName: string;
  totalScore: number;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  accessType: string;
  sessionStatus: string;
  myScore: number | null;
  myFinalScore: number | null;
  isPassed: boolean | null;
  submittedAt: string | null;
}

type TabKey = 'pending' | 'active' | 'completed';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'pending', label: '待考', icon: '⏳' },
  { key: 'active', label: '考试中', icon: '📝' },
  { key: 'completed', label: '已完成', icon: '✅' },
];

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '已开始';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}天${h % 24}小时后`;
  if (h > 0) return `${h}小时${m}分后`;
  return `${m}分钟后`;
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  }
  return `${minutes}分钟`;
}

export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [now, setNow] = useState(new Date());

  // Tick every 10s for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/student/exams', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      const list: ExamItem[] = Array.isArray(data) ? data : [];
      setExams(list);
      // Auto-switch to active tab if there are active exams
      const active = list.filter(e => e.sessionStatus === 'ACTIVE');
      if (active.length > 0) setActiveTab('active');
    }).finally(() => setLoading(false));
  }, [router]);

  const categorized = useCallback(() => {
    const pending: ExamItem[] = [];
    const active: ExamItem[] = [];
    const completed: ExamItem[] = [];

    exams.forEach(e => {
      if (e.submittedAt || e.myFinalScore !== null || e.isPassed !== null) {
        completed.push(e);
      } else if (e.sessionStatus === 'ACTIVE') {
        active.push(e);
      } else {
        pending.push(e);
      }
    });

    // Sort: pending by startTime asc, completed by submittedAt desc
    pending.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    completed.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

    return { pending, active, completed };
  }, [exams]);

  const { pending, active, completed } = categorized();
  const tabCounts = { pending: pending.length, active: active.length, completed: completed.length };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-4xl mb-4 animate-pulse">🦊</div>
      <p style={{ color: 'var(--ink-300)' }}>小狐狸正在加载…</p>
    </div>
  );

  const renderExamCard = (exam: ExamItem, variant: 'pending' | 'active' | 'completed') => {
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);
    const isAvailable = startTime <= now && !exam.submittedAt;

    if (variant === 'active') {
      return (
        <div
          key={exam.id}
          onClick={() => router.push(`/exam/take/${exam.id}`)}
          className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
          style={{
            background: 'white',
            border: '2px solid var(--fox)',
            boxShadow: '0 4px 20px rgba(232,122,48,0.12)',
          }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{exam.paperName}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold flex-shrink-0" style={{
              background: '#e87a3018',
              color: 'var(--fox)',
            }}>
              📝 考试中
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
            <span>⏱ {formatDuration(exam.durationMinutes)}</span>
            <span>📊 {exam.totalScore}分</span>
            {exam.endTime && (
              <span style={{ color: new Date(exam.endTime) < now ? '#ef4444' : 'var(--ink-400)' }}>
                ⏰ 截止 {new Date(exam.endTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="w-full h-2 rounded-full" style={{ background: 'var(--ink-100)' }}>
              <div className="h-full rounded-full bg-[var(--fox)]" style={{
                width: '35%',
                transition: 'width 0.3s',
              }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'var(--fox)' }}>答题进度</span>
              <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>继续答题 →</span>
            </div>
          </div>
        </div>
      );
    }

    if (variant === 'completed') {
      const passed = exam.isPassed === true;
      return (
        <div
          key={exam.id}
          onClick={() => router.push(`/exam/result/${exam.id}`)}
          className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-md"
          style={{
            background: 'white',
            border: `1px solid ${passed ? 'var(--sage)' : 'var(--ink-100)'}`,
            opacity: 0.85,
          }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
                {passed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#2e7d3218', color: '#2e7d32' }}>✅ 通过</span>
                ) : exam.isPassed === false ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#ef444418', color: '#ef4444' }}>❌ 未通过</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>⏳ 待阅卷</span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--ink-400)' }}>{exam.paperName}</p>
              <div className="flex gap-3 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
                <span>⏱ {formatDuration(exam.durationMinutes)}</span>
                <span>📊 {exam.totalScore}分</span>
                {exam.myFinalScore !== null && (
                  <span className="font-semibold" style={{ color: passed ? '#2e7d32' : '#ef4444' }}>
                    🏆 得分：{exam.myFinalScore}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <div className="text-2xl">{passed ? '🎉' : exam.isPassed === false ? '😅' : '⏳'}</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>
                {exam.submittedAt ? new Date(exam.submittedAt).toLocaleDateString('zh-CN') : ''}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Pending
    const canStart = isAvailable;
    return (
      <div
        key={exam.id}
        className="rounded-xl p-5 transition-all hover:shadow-md"
        style={{
          background: 'white',
          border: '1px solid var(--ink-100)',
        }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{exam.paperName}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
              <span>⏱ {formatDuration(exam.durationMinutes)}</span>
              <span>📊 {exam.totalScore}分</span>
              <span>📅 {startTime.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
              {startTime > now && (
                <span className="font-medium" style={{ color: 'var(--fox)' }}>
                  ⏰ {formatCountdown(startTime)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-4 self-start">
            {canStart ? (
              <button
                onClick={() => router.push(`/exam/take/${exam.id}`)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all hover:brightness-110 active:scale-95"
                style={{ background: 'var(--fox)', color: '#fff' }}>
                进入考试
              </button>
            ) : (
              <div className="text-right">
                <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                  {startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 开放
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentList = activeTab === 'active' ? active : activeTab === 'completed' ? completed : pending;

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ background: 'rgba(246,241,232,0.92)', borderBottom: '1px solid var(--ink-100)' }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FoxLogo.Light size={32} />
            <span className="font-semibold" style={{ color: 'var(--ink-700)' }}>我的考试</span>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-xs px-3 py-1.5 rounded-md bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-400)' }}>
            ← 返回
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-none cursor-pointer"
              style={{
                background: activeTab === tab.key ? 'white' : 'transparent',
                color: activeTab === tab.key ? 'var(--ink-700)' : 'var(--ink-400)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                  background: activeTab === tab.key ? 'var(--fox-glow)' : 'var(--ink-100)',
                  color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-400)',
                }}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {currentList.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">
              {activeTab === 'pending' ? '📋' : activeTab === 'active' ? '📝' : '🎉'}
            </div>
            <p className="text-base font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
              {activeTab === 'pending' ? '暂无待考考试' : activeTab === 'active' ? '没有正在进行的考试' : '还没有完成过考试'}
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
              {activeTab === 'pending' ? '当有考试安排时会显示在这里' : activeTab === 'active' ? '开始考试后，这里会显示答题进度' : '完成考试后，成绩会显示在这里'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map(exam => renderExamCard(exam, activeTab))}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs py-6" style={{ color: 'var(--ink-200)' }}>
        FoxLearn · 跟着小狐狸，知识不迷路 🐾
      </p>
    </div>
  );
}
