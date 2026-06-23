'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { STANDARD: '标准课', CUSTOM: '定制课' };
const TYPE_COLORS: Record<string, string> = { STANDARD: '#00897b', CUSTOM: '#1565c0' };

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [courseData, videosData] = await Promise.all([
        api.courses.get(Number(params.id)),
        api.courseVideos.list(Number(params.id)).catch(() => []),
      ]);
      setCourse(courseData);
      setVideos(videosData || []);
    } catch { router.push('/courses'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!course) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/courses')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回课程列表</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="page-title mb-0">{course.name}</h1>
            <span className="tag" style={{ background: `${TYPE_COLORS[course.type] || '#888'}18`, color: TYPE_COLORS[course.type] || '#888', fontSize: '11px' }}>
              {TYPE_NAMES[course.type] || course.type}
            </span>
          </div>
          <p className="page-subtitle">
            {course.code && <span className="font-mono mr-4">{course.code}</span>}
            学时：{course.hours ? `${course.hours} 小时` : '未设置'}
            {course.parentCourse && <span className="ml-4">基于：{course.parentCourse.name}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/courses/${params.id}/videos`)} className="btn btn-fox btn-sm">🎬 视频管理</button>
          <button onClick={() => router.push(`/courses/${params.id}/edit`)} className="btn btn-outline btn-sm">编辑信息</button>
        </div>
      </div>

      {course.description && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-semibold mb-2">课程简介</h3>
          <p className="text-sm" style={{ color: 'var(--ink-400)' }}>{course.description}</p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--ink-200)' }}>
          <h3 className="font-semibold text-sm">课程视频（{videos.length}）</h3>
          <button onClick={() => router.push(`/courses/${params.id}/videos`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>管理 →</button>
        </div>
        {videos.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>
            暂无视频，<button onClick={() => router.push(`/courses/${params.id}/videos`)} className="bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>去添加</button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {videos.map((v: any, i: number) => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                    {formatDuration(v.duration)} · 完成条件：{v.requiredPct}%
                    {v.isPublic && <span className="ml-2 tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '10px' }}>公共课</span>}
                  </p>
                </div>
                <button onClick={() => router.push(`/courses/${params.id}/videos/${v.id}/play`)} className="btn btn-outline btn-sm text-xs">▶ 播放</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
