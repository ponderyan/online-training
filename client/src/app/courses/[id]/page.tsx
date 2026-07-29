'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { STANDARD: '标准课', CUSTOM: '定制课' };
const TYPE_COLORS: Record<string, string> = { STANDARD: '#00897b', CUSTOM: '#1565c0' };

const VC_TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };
const VC_TYPE_COLORS: Record<string, string> = { PUBLIC: '#7b1fa2', SPECIALIZED: '#e87a30' };

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 管理关联视频弹窗
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

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

  const openLinkModal = async () => {
    // 加载所有已发布视频课程
    try {
      const data = await api.videoCourses.list({ pageSize: '200', status: 'PUBLISHED' });
      setAllVideos(data.items || []);
    } catch { setAllVideos([]); }
    // 当前已关联的
    const currentIds = (course?.videoCourseLinks || []).map((l: any) => l.videoCourseId);
    setSelectedVideoIds(currentIds);
    setLinkModalOpen(true);
  };

  const toggleVideo = (videoId: number) => {
    setSelectedVideoIds(prev =>
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
  };

  const saveLinks = async () => {
    setSaving(true);
    try {
      await api.courses.syncVideoLinks(Number(params.id), selectedVideoIds);
      toast.success('关联视频已更新');
      setLinkModalOpen(false);
      load(); // 刷新详情
    } catch (e: any) {
      toast.error('保存失败：' + (e.message || '未知错误'));
    }
    setSaving(false);
  };

  const videoLinks = course?.videoCourseLinks || [];

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!course) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/courses')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回课程列表</button>

      <div className="mb-6">
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
      </div>

      {course.description && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-semibold mb-2">课程简介</h3>
          <p className="text-sm" style={{ color: 'var(--ink-400)' }}>{course.description}</p>
        </div>
      )}

      {/* 关联视频课程 */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--ink-200)' }}>
          <h3 className="font-semibold text-sm">关联视频课程（{videoLinks.length}）</h3>
          <button onClick={openLinkModal} className="text-xs px-3 py-1 rounded-md border cursor-pointer" style={{ borderColor: 'var(--fox)', color: 'var(--fox)', background: 'transparent' }}>
            管理关联
          </button>
        </div>
        {videoLinks.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>
            暂无关联视频课程，点击「管理关联」添加
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
                  {vc?.url && <span className="text-xs" style={{ color: 'var(--ink-300)' }}>已上传</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: vc?.status === 'PUBLISHED' ? '#2e7d3218' : '#e5393518', color: vc?.status === 'PUBLISHED' ? '#2e7d32' : '#e53935' }}>
                    {vc?.status === 'PUBLISHED' ? '已上架' : '已下架'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 管理关联视频弹窗 */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--ink-200)' }}>
              <h3 className="font-semibold text-sm">管理关联视频课程</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>勾选要关联到「{course.name}」的视频课程</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {allVideos.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无已上架的视频课程</p>
              ) : (
                <div className="space-y-1">
                  {allVideos.map((v: any) => (
                    <label key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.includes(v.id)}
                        onChange={() => toggleVideo(v.id)}
                        className="w-4 h-4 accent-[var(--fox)]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{v.name}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                          {v.duration ? formatDuration(v.duration) : '—'}
                          {v.hours ? ` · ${v.hours}学时` : ''}
                          <span className="ml-2" style={{ color: VC_TYPE_COLORS[v.type] || '#888' }}>
                            {VC_TYPE_NAMES[v.type] || v.type}
                          </span>
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--ink-200)' }}>
              <button onClick={() => setLinkModalOpen(false)} className="px-4 py-1.5 text-xs rounded-md border cursor-pointer" style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-400)', background: 'white' }}>
                取消
              </button>
              <button onClick={saveLinks} disabled={saving} className="px-4 py-1.5 text-xs rounded-md border-none cursor-pointer text-white" style={{ background: 'var(--fox)', opacity: saving ? 0.6 : 1 }}>
                {saving ? '保存中…' : `保存（已选${selectedVideoIds.length}个）`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
