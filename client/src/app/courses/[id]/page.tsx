'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { STANDARD: '标准课', CUSTOM: '定制课' };
const TYPE_COLORS: Record<string, string> = { STANDARD: '#00897b', CUSTOM: '#1565c0' };

const VC_TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };
const VC_TYPE_COLORS: Record<string, string> = { PUBLIC: '#7b1fa2', SPECIALIZED: '#e87a30' };

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const courseData = await api.courses.get(Number(params.id));
      setCourse(courseData);
    } catch { router.push('/courses'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const videoLinks = course?.videoCourseLinks || [];

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
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-200)' }}>
          <h3 className="font-semibold text-sm">关联视频课程（{videoLinks.length}）</h3>
        </div>
        {videoLinks.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>
            暂无关联视频课程
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {videoLinks.map((link: any, i: number) => {
              const vc = link.videoCourse;
              return (
                <div key={link.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{vc?.name || '未命名视频'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                      {vc?.duration ? formatDuration(vc.duration) : '—'}
                      {vc?.hours ? ` · ${vc.hours} 学时` : ''}
                      {vc?.type && (
                        <span className="ml-2 tag" style={{ background: `${VC_TYPE_COLORS[vc.type] || '#888'}18`, color: VC_TYPE_COLORS[vc.type] || '#888', fontSize: '10px' }}>
                          {VC_TYPE_NAMES[vc.type] || vc.type}
                        </span>
                      )}
                    </p>
                  </div>
                  {vc?.url && (
                    <span className="text-xs" style={{ color: 'var(--ink-300)' }}>已上传</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
