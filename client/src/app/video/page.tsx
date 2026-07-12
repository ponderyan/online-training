'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const mediaURL = (path: string) =>
  process.env.NODE_ENV === 'production' ? path : `http://localhost:3001${path}`;

const fmtDuration = (sec: number) => {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export default function VideoListPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PUBLIC' | 'SPECIALIZED'>('ALL');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.videoCourses.getStudentVisible();
        setVideos(data.videos || []);
        setStats(data.stats || null);
      } catch (e: any) {
        if (e.message?.includes('401')) { router.push('/login'); return; }
        setError(e.message || '加载视频失败');
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = videos;
    if (filter !== 'ALL') list = list.filter(v => v.type === filter);
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter(v =>
        v.name?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.courseLinks?.some((cl: any) => cl.course?.name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [videos, filter, keyword]);

  if (loading) {
    return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载视频课程… 🦊</div></AppLayout>;
  }
  if (error) {
    return <AppLayout><div className="text-center py-16" style={{ color: 'var(--verm)' }}>{error}</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5 pb-6">
        {/* 标题 + 统计 */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title">🎬 视频课程</h1>
            <p className="page-subtitle">公共课 + 已报名专项课 · 在线学习累计学时</p>
          </div>
          {stats && (
            <div className="flex gap-3">
              <div className="card px-4 py-3 text-center">
                <div className="text-xl font-bold" style={{ color: 'var(--fox-dark)' }}>{stats.totalVideos ?? videos.length}</div>
                <div className="text-[10px]" style={{ color: 'var(--ink-400)' }}>可学课程</div>
              </div>
              <div className="card px-4 py-3 text-center">
                <div className="text-xl font-bold" style={{ color: '#2e7d32' }}>{stats.completedVideos ?? 0}</div>
                <div className="text-[10px]" style={{ color: 'var(--ink-400)' }}>已完成</div>
              </div>
              <div className="card px-4 py-3 text-center">
                <div className="text-xl font-bold" style={{ color: 'var(--ink-700)' }}>{stats.totalHours ?? 0}<span className="text-xs font-normal">h</span></div>
                <div className="text-[10px]" style={{ color: 'var(--ink-400)' }}>累计学时</div>
              </div>
            </div>
          )}
        </div>

        {/* 筛选 + 搜索 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {[['ALL', '全部'], ['PUBLIC', '公共课'], ['SPECIALIZED', '专项课']].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k as any)}
                className="btn btn-xs"
                style={{
                  background: filter === k ? 'var(--fox)' : 'var(--paper)',
                  color: filter === k ? '#fff' : 'var(--ink-500)',
                  border: `1px solid ${filter === k ? 'var(--fox)' : 'var(--ink-100)'}`,
                }}>
                {label}
              </button>
            ))}
          </div>
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="🔍 搜索课程名称…" className="input text-xs" style={{ width: 240, height: 32 }} />
        </div>

        {/* 视频卡片网格 */}
        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-5xl mb-4">🎬</p>
            <p style={{ color: 'var(--ink-400)' }}>{keyword || filter !== 'ALL' ? '没有匹配的视频课程' : '暂无可学习的视频课程'}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>报名培训班后可解锁更多专项课程</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(v => {
              const isPublic = v.type === 'PUBLIC';
              const isCompleted = v.progress?.completed;
              const pct = v.progress ? Math.round((v.progress.progress || 0) * 100) : 0;
              return (
                <Link key={v.id} href={`/video/${v.id}`}
                  className="card overflow-hidden transition-all hover:shadow-md group"
                  style={{ padding: 0, textDecoration: 'none' }}>
                  {/* 封面 */}
                  <div className="relative" style={{ paddingTop: '56.25%', background: 'var(--ink-100)' }}>
                    {v.coverUrl ? (
                      <img src={mediaURL(v.coverUrl)} alt={v.name}
                        className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
                    )}
                    {/* 类型标签 */}
                    <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded"
                      style={{
                        background: isPublic ? 'rgba(0,137,123,0.9)' : 'rgba(21,101,192,0.9)',
                        color: '#fff',
                      }}>
                      {isPublic ? '公共课' : '专项课'}
                    </span>
                    {/* 完成标签 */}
                    {isCompleted && (
                      <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded"
                        style={{ background: 'rgba(46,125,50,0.9)', color: '#fff' }}>✓ 已完成</span>
                    )}
                    {/* 时长 */}
                    {v.duration && (
                      <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>{fmtDuration(v.duration)}</span>
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold mb-1 truncate group-hover:text-[var(--fox)]"
                      style={{ color: 'var(--ink-700)' }}>{v.name}</h3>
                    <div className="text-xs space-y-1" style={{ color: 'var(--ink-400)' }}>
                      {v.instructorName && <div>👤 {v.instructorName}</div>}
                      {v.hours && <div>⏱ {v.hours} 课时</div>}
                      {v.courseLinks?.length > 0 && (
                        <div className="truncate">📚 {v.courseLinks.map((cl: any) => cl.course?.name).filter(Boolean).join('、')}</div>
                      )}
                    </div>
                    {/* 进度条 */}
                    {v.progress && !isCompleted && pct > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--fox)' }} />
                        </div>
                        <div className="text-[10px] mt-0.5 text-right" style={{ color: 'var(--ink-300)' }}>已学 {pct}%</div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
