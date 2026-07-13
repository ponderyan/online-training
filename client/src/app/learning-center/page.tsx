'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';

const TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };

export default function LearningCenterPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.videoCourses.getStudentVisible();
      setData(result);
    } catch (e: any) {
      setError(e.message || '加载视频课程失败');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const visibleVideos = data?.videos?.filter((v: any) => {
    if (filter === 'public' && v.type !== 'PUBLIC') return false;
    if (filter === 'specialized' && v.type !== 'SPECIALIZED') return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

      {/* 最近学习 — in-progress videos */}
      {data?.videos && !loading && (() => {
        const recent = data.videos
          .filter((v: any) => v.progress && !v.progress.completed && v.progress.progress > 0)
          .slice(0, 3);
        if (recent.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--ink-600)' }}>📖 最近学习</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((v: any) => {
                const pct = Math.min(100, Math.round(v.progress.progress || 0));
                return (
                  <div key={v.id} className="card p-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/learning-center/${v.id}/play`)}>
                    <div className="relative" style={{ paddingTop: '40%', background: 'linear-gradient(135deg, var(--fox), var(--gold))' }}>
                      {v.coverUrl ? (
                        <img src={v.coverUrl} alt={v.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-30">🎬</div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: 'var(--fox)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate">{v.name}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>{pct}%</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#e87a3018', color: '#e87a30' }}>
                          继续学习 →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-2">
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
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索视频名称…"
          className="input text-xs" style={{ width: 200, marginLeft: 'auto' }} />
      </div>

      {loading ? (
        <SkeletonCardGrid count={6} />
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : visibleVideos.length === 0 ? (
        <div className="card">
          <EmptyState icon="📺" title={search ? '没有匹配的视频' : '暂无视频课程'} description={search ? '试试调整搜索条件' : '报名培训班后可解锁更多课程'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleVideos.map((v: any) => {
            const pct = v.progress ? Math.min(100, Math.round(v.progress.progress || 0)) : 0;
            const completed = v.progress?.completed || false;
            return (
              <div key={v.id} className="card p-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/learning-center/${v.id}/play`)}>
                {/* Cover area */}
                <div className="relative" style={{ paddingTop: '56.25%', background: 'linear-gradient(135deg, var(--fox), var(--gold))' }}>
                  {v.coverUrl ? (
                    <img src={v.coverUrl} alt={v.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">🎬</div>
                  )}
                  {/* Type badge */}
                  <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: v.type === 'PUBLIC' ? 'rgba(0,137,123,0.8)' : 'rgba(21,101,192,0.8)',
                      color: '#fff',
                    }}>
                    {TYPE_NAMES[v.type] || v.type}
                  </span>
                  {v.isContinuingEducation && (
                    <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: 'rgba(123,31,162,0.8)', color: '#fff' }}>
                      计学时
                    </span>
                  )}
                  {/* Progress overlay */}
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <div className="h-full" style={{
                        width: `${completed ? 100 : pct}%`,
                        background: completed ? '#2e7d32' : 'var(--fox)',
                      }} />
                    </div>
                  )}
                </div>
                {/* Info area */}
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{v.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {v.instructorName || '—'}
                      {v.hours ? ` · ${v.hours}h` : ''}
                      {v.duration ? ` · ${formatDuration(v.duration)}` : ''}
                    </span>
                  </div>
                  {completed ? (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded" style={{ background: '#2e7d3218', color: '#2e7d32' }}>✅ 已完成</span>
                  ) : pct > 0 ? (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded" style={{ background: '#e87a3018', color: '#e87a30' }}>学习中 {pct}%</span>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded" style={{ background: '#00897b18', color: '#00897b' }}>开始学习</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
