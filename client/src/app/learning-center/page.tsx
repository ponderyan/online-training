'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };

export default function LearningCenterPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | public | specialized

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.videoCourses.getStudentVisible();
      setData(result);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const visibleVideos = data?.videos?.filter((v: any) => {
    if (filter === 'all') return true;
    if (filter === 'public') return v.type === 'PUBLIC';
    if (filter === 'specialized') return v.type === 'SPECIALIZED';
    return true;
  }) || [];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📺 学习中心</h1>
        <p className="page-subtitle">观看视频课程 · 累计学时</p>
      </div>

      {/* Stats */}
      {data?.stats && !loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{data.stats.totalVideos}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>视频课程</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#00897b' }}>{data.stats.completedVideos}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>已完成</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#1565c0' }}>{data.stats.totalHours}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>累计学时（小时）</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'all', label: '全部' },
          { key: 'public', label: '公共课' },
          { key: 'specialized', label: '专项课' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{
              background: filter === f.key ? 'var(--fox)' : 'var(--paper-dark)',
              color: filter === f.key ? '#fff' : 'var(--ink-400)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : visibleVideos.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📺</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无视频课程</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleVideos.map((v: any) => {
            const pct = v.progress ? Math.min(100, Math.round(v.progress.progress || 0)) : 0;
            const completed = v.progress?.completed || false;
            return (
              <div key={v.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/learning-center/${v.id}/play`)}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: 'var(--fox)', color: '#fff' }}>
                    ▶
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{v.name}</h3>
                      <span className="tag" style={{
                        background: v.type === 'PUBLIC' ? '#00897b18' : '#1565c018',
                        color: v.type === 'PUBLIC' ? '#00897b' : '#1565c0',
                        fontSize: '9px',
                      }}>{TYPE_NAMES[v.type] || v.type}</span>
                      {v.isContinuingEducation && (
                        <span className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '9px' }}>计学时</span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--ink-400)' }}>
                      {v.instructorName ? `${v.instructorName}${v.instructorLevel ? ` (${v.instructorLevel})` : ''}` : ''}
                      {v.hours ? ` · ${v.hours} 课时` : ''}
                      {v.duration ? ` · ${formatDuration(v.duration)}` : ''}
                    </p>
                    {v.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-300)' }}>{v.description}</p>
                    )}
                    {v.type === 'SPECIALIZED' && v.courseLinks?.length > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>
                        📎 课程：{v.courseLinks.map((cl: any) => cl.course?.name).join('、')}
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--ink-100)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${completed ? 100 : pct}%`,
                          background: completed ? '#2e7d32' : 'var(--fox)',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: completed ? '#2e7d32' : 'var(--ink-400)' }}>
                        {completed ? '✅ 已完成' : `${pct}%`}
                      </span>
                    </div>
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
