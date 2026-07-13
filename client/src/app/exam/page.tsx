'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FoxLogo from '@/components/fox-logo';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonList } from '@/components/Skeleton';

interface ExamItem {
  id: number;
  title: string;
  paperName: string;
  totalScore: number;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  status: string;
  accessType: string;
  sessionStatus: string;
  remainingTime?: number;
  myScore: number | null;
  myFinalScore: number | null;
  isPassed: boolean | null;
  scoringStatus: string | null;
  submittedAt: string | null;
}

function formatRemainingTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatExamTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '已开始';
  if (diffDays === 1) return '明天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays <= 7) return `${diffDays}天后 ` + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '24px 16px 48px' } as const,
  section: { marginBottom: '40px' } as const,
  sectionTitle: { fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' } as const,
  emptyText: { fontSize: '14px', color: '#94a3b8', padding: '32px 0', textAlign: 'center' } as const,
};

export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    setError(null);
    fetch('/api/student/exams', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      if (!r.ok) throw new Error('加载失败');
      return r.json();
    }).then(data => {
      setExams(Array.isArray(data) ? data : []);
    }).catch(e => {
      setError(e.message || '加载考试列表失败');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activeExams = exams.filter(e => e.sessionStatus === 'ACTIVE');
  const pendingExams = exams.filter(e => !e.submittedAt && e.sessionStatus !== 'ACTIVE');
  const historyExams = exams.filter(e => e.submittedAt);

  const sortedActive = [...activeExams].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const sortedPending = [...pendingExams].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const sortedHistory = [...historyExams].sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div style={styles.container}>
        <div className="card" style={{ marginBottom: 40 }}><div className="card-body"><SkeletonList count={3} /></div></div>
        <div className="card"><div className="card-body"><SkeletonList count={4} /></div></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div style={styles.container}>
        <div className="card"><ErrorCard message={error} onRetry={load} /></div>
      </div>
    </div>
  );

  const hasCurrent = sortedActive.length > 0 || sortedPending.length > 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ background: 'rgba(246,241,232,0.92)', borderBottom: '1px solid var(--ink-100)' }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FoxLogo.Light size={32} />
            <span className="font-semibold" style={{ color: 'var(--ink-700)' }}>我的考试</span>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-xs px-3 py-1.5 rounded-md bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-400)' }}>← 返回</button>
        </div>
      </div>

      <div style={styles.container}>
        {/* 📝 当前考试 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📝 当前考试</h2>
          {!hasCurrent ? (
            <EmptyState icon="📝" title="暂无当前考试" description="有新的考试时会在这里提醒你" />
          ) : (
            <>
              {sortedActive.map(exam => (
                <div key={exam.id} style={{
                  background: 'white', borderRadius: '12px',
                  border: exam.accessType === 'UNIFIED' ? '1px solid #e87a30' : '2px solid #e87a30',
                  padding: '20px 24px', marginBottom: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: '#fef3e7', color: '#e87a30', fontWeight: 600 }}>📝 考试中</span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>{exam.title}</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      {exam.paperName}
                      {exam.accessType === 'UNIFIED'
                        ? ` · 📅 ${new Date(exam.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}-${new Date(exam.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                        : ` · ⏱ ${formatRemainingTime(exam.remainingTime)}`}
                    </p>
                  </div>
                  <Link href={`/exam/take/${exam.id}`} style={{
                    padding: '8px 20px', borderRadius: '8px', background: '#e87a30', color: 'white',
                    fontSize: '13px', fontWeight: 600, textDecoration: 'none', flexShrink: 0,
                  }}>{exam.accessType === 'UNIFIED' ? '返回考场 →' : '继续答题 →'}</Link>
                </div>
              ))}
              {sortedPending.map(exam => (
                <div key={exam.id} style={{
                  background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
                  padding: '20px 24px', marginBottom: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>{exam.title}</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 2px' }}>
                      ⏱ {exam.durationMinutes}分钟 · 📊 {exam.totalScore}分 · 📅 {formatExamTime(exam.startTime)}
                    </p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{exam.paperName}</p>
                  </div>
                  <Link href={`/exam/take/${exam.id}`} style={{
                    padding: '8px 20px', borderRadius: '8px', background: '#e87a30', color: 'white',
                    fontSize: '13px', fontWeight: 600, textDecoration: 'none', flexShrink: 0,
                  }}>进入考试 →</Link>
                </div>
              ))}
            </>
          )}
        </section>

        {/* 📋 历史记录 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📋 历史记录</h2>
          {sortedHistory.length === 0 ? (
            <EmptyState icon="📋" title="还没有参加过考试" description="完成考试后，历史记录会出现在这里" />
          ) : (
            sortedHistory.map(exam => {
              const isPublished = exam.scoringStatus === 'PUBLISHED' || exam.scoringStatus === 'ADJUSTED';
              const isPassed = exam.isPassed === true;
              const badge = !isPublished
                ? { text: '⏸️ 待公布', bg: '#f8fafc', color: '#94a3b8' }
                : isPassed
                ? { text: '✅ 通过', bg: '#f0fdf4', color: '#16a34a' }
                : { text: '❌ 未通过', bg: '#fef2f2', color: '#dc2626' };

              return (
                <div key={exam.id} onClick={() => isPublished ? router.push(`/exam/result/${exam.id}`) : undefined}
                  style={{
                    background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
                    padding: '16px 24px', marginBottom: '8px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: isPublished ? 'pointer' : 'default',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', background: badge.bg, color: badge.color, fontWeight: 600 }}>
                      {badge.text}
                    </span>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{exam.title}</span>
                      {isPublished && (
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#e87a30', marginLeft: '12px' }}>
                          {exam.myFinalScore || exam.myScore}分
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{formatDate(exam.submittedAt)}</span>
                    {isPublished && <span style={{ fontSize: '14px', color: '#94a3b8' }}>→</span>}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <p className="text-center text-xs py-6" style={{ color: 'var(--ink-200)' }}>FoxLearn · 跟着小狐狸，知识不迷路 🐾</p>
    </div>
  );
}
