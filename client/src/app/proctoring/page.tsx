'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function ProctoringHome() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const load = useCallback(async () => {
    try {
      const data = await api.exams.list({ pageSize: '100' } as any);
      const filtered = (data.items || []).filter((e: any) => e.status !== 'DRAFT');
      setExams(filtered);
      setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    } catch {}
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const filtered = exams.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (keyword && !e.title?.includes(keyword) && !e.paper?.name?.includes(keyword)) return false;
    return true;
  });

  // Aggregate stats
  const stats = {
    all: exams.length,
    inProgress: exams.filter(e => e.status === 'IN_PROGRESS').length,
    active: exams.filter(e => e.status === 'PUBLISHED' || e.status === 'IN_PROGRESS').length,
    submitted: exams.reduce((s, e) => s + (e.submittedCount || 0), 0),
    totalStudents: exams.reduce((s, e) => s + (e._count?.sessions || 0), 0),
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🎥 监考中心</h1>
          <p className="page-subtitle">实时监控 · 异常干预 · 考试管理</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>🔄 {lastRefresh ? `刷新于 ${lastRefresh}` : '自动每30秒更新'}</span>
          <button onClick={load} className="btn btn-sm" style={{ border: '1px solid var(--ink-200)' }}>
            ⟳ 刷新
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: '考试总数', value: stats.all, icon: '📋', color: 'var(--ink-600)' },
          { label: '进行中', value: stats.inProgress, icon: '🟢', color: '#2e7d32', highlight: stats.inProgress > 0 },
          { label: '待开考', value: stats.active - stats.inProgress, icon: '📅', color: '#1565c0' },
          { label: '已交卷', value: stats.submitted, icon: '✅', color: '#888' },
          { label: '总考生', value: stats.totalStudents, icon: '👥', color: 'var(--fox)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center" style={s.highlight ? { border: '2px solid #2e7d32' } : {}}>
            <div className="text-sm mb-1">{s.icon}</div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert banner for active exams */}
      {stats.inProgress > 0 && (
        <div className="rounded-xl p-4 mb-5 flex items-center justify-between" style={{
          background: 'linear-gradient(135deg, #fef3e7, #ffe0b2)',
          border: '2px solid var(--fox)',
        }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>
                {stats.inProgress} 场考试正在进行
              </p>
              <p className="text-[10px]" style={{ color: 'var(--ink-400)' }}>
                共计 {stats.totalStudents} 名考生 · 需实时监考
              </p>
            </div>
          </div>
          <span className="text-xs animate-pulse" style={{ color: '#e53935' }}>● 实时</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { key: '', label: '全部' },
          { key: 'PUBLISHED', label: '待开考' },
          { key: 'IN_PROGRESS', label: '进行中' },
          { key: 'FINISHED', label: '已结束' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{
              background: statusFilter === f.key ? 'var(--fox)' : 'transparent',
              color: statusFilter === f.key ? 'white' : 'var(--ink-400)',
              border: statusFilter === f.key ? 'none' : '1px solid var(--ink-200)',
            }}>
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="🔍 搜索考试标题…"
          className="input text-xs" style={{ maxWidth: 220, height: 32 }} />
      </div>

      {/* Exam list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 animate-pulse">🎥</div>
          <p style={{ color: 'var(--ink-300)' }}>小狐狸正在加载…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-5xl mb-4">{keyword || statusFilter ? '🔍' : '🎥'}</p>
          <p style={{ color: 'var(--ink-400)' }}>{keyword || statusFilter ? '没有找到匹配的考试' : '暂无可监考的考试'}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>
            {keyword || statusFilter ? '试试调整搜索条件' : '创建并发布考试后，这里会显示监考入口'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exam: any) => {
            const total = exam._count?.sessions || 0;
            const submitted = exam.submittedCount || 0;
            const isLive = exam.status === 'IN_PROGRESS';
            const isPending = exam.status === 'PUBLISHED';
            const isDone = exam.status === 'FINISHED';

            return (
              <div key={exam.id} onClick={() => router.push(`/proctoring/${exam.id}`)}
                className="rounded-xl p-5 transition-all hover:shadow-md cursor-pointer group"
                style={{
                  background: isLive
                    ? 'linear-gradient(135deg, #fff8f0, #fff3e0)'
                    : isDone ? 'white' : 'white',
                  border: isLive
                    ? '2px solid var(--fox)'
                    : isPending
                      ? '2px dashed #1565c0'
                      : '1px solid var(--ink-100)',
                  opacity: isDone ? 0.8 : 1,
                }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                        background: isLive ? '#e87a3018' : isPending ? '#1565c018' : '#88888818',
                        color: isLive ? 'var(--fox)' : isPending ? '#1565c0' : '#888',
                      }}>
                        {isLive ? '🟢 进行中' : isPending ? '📅 待开考' : isDone ? '📋 已结束' : exam.status}
                      </span>
                    </div>

                    <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                      📄 {exam.paper?.name || '—'}
                    </p>

                    <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--ink-300)' }}>
                      <span>👥 考生 {total}人</span>
                      <span>✅ 已交卷 {submitted}人</span>
                      <span>⏱ {exam.durationMinutes || '—'}分钟</span>
                      {exam.startTime && (
                        <span>📅 {new Date(exam.startTime).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {total > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--ink-100)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (submitted / total) * 100)}%`,
                            background: submitted === total ? '#2e7d32' : 'var(--fox)',
                          }} />
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--ink-300)' }}>
                          {Math.round((submitted / total) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                    {exam.abnormalCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#ef444418', color: '#ef4444' }}>
                        ⚠️ {exam.abnormalCount} 异常
                      </span>
                    )}
                    <span className="text-xs font-medium mt-1 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--fox)' }}>
                      进入监考 →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
