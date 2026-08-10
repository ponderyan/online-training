'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { TYPE_NAMES } from './components/video-course-constants';
import { VideoCourseTable } from './components/video-course-table';
import { VideoCourseEditModal } from './components/video-course-edit-modal';
import { VideoDetailModal, VideoPreviewModal, VideoLogModal } from './components/video-course-modals';

// ── 主页面（D 拆分后仅保留数据加载/筛选/操作与组合，区块见 components/）──
export default function VideoCoursesPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterCourses, setFilterCourses] = useState<any[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editVideo, setEditVideo] = useState<any>(null);
  const [modalCourses, setModalCourses] = useState<any[]>([]);

  // Detail modal
  const [detailVideo, setDetailVideo] = useState<any>(null);

  // Preview modal
  const [previewVideo, setPreviewVideo] = useState<any>(null);

  // Log modal
  const [logModal, setLogModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logVideoName, setLogVideoName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.videoCourses.list({ pageSize: 50, type: filterType || undefined, keyword: searchKeyword || undefined, status: filterStatus || undefined, courseId: filterCourse ? Number(filterCourse) : undefined });
      setVideos(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterType, filterStatus, filterCourse]);

  // 加载课程列表用于筛选
  useEffect(() => {
    api.courses.list({ pageSize: '200' }).then((data: any) => setFilterCourses(data.items || [])).catch(() => {});
  }, []);

  const doSearch = () => { load(); };

  const openNew = async () => {
    try {
      const data = await api.courses.list({ pageSize: '200' });
      setModalCourses(data.items || []);
    } catch {}
    setEditVideo(null);
    setModalOpen(true);
  };

  const openEdit = async (v: any) => {
    try {
      const data = await api.courses.list({ pageSize: '200' });
      setModalCourses(data.items || []);
    } catch {}
    setEditVideo(v);
    setModalOpen(true);
  };

  const openLogs = async (v: any) => {
    setLogVideoName(v.name);
    try { setLogs(await api.videoCourses.getLogs(v.id) || []); } catch { setLogs([]); }
    setLogModal(true);
  };

  const handlePublish = async (v: any) => {
    await fetch('/api/video-courses/' + v.id + '/publish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    load();
  };

  const handleUnpublish = async (v: any) => {
    if (!confirm('下架后学员端将无法观看此视频，确定下架吗？')) return;
    await fetch('/api/video-courses/' + v.id + '/unpublish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    load();
  };

  const handleDelete = async (v: any) => {
    if (v.status !== 'UNPUBLISHED') {
      if (!confirm('删除前需要先下架，确定下架并删除吗？')) return;
      await fetch('/api/video-courses/' + v.id + '/unpublish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).catch(() => {});
    }
    if (confirm('确定删除该视频课程吗？')) { await api.videoCourses.delete(v.id); load(); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">视频课程管理</h1>
          <p className="page-subtitle">独立管理所有视频课程 · 共 {total} 个</p>
        </div>
        <button onClick={openNew} className="btn btn-fox btn-sm">➕ 新建视频课程</button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-5">
        <div className="flex gap-2">
          <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="🔍 搜索名称…" className="input" style={{ maxWidth: 200 }} />
          <button onClick={doSearch} className="btn btn-outline btn-sm">搜索</button>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="input select" style={{ maxWidth: 110 }}>
          <option value="">全部类型</option>
          {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input select" style={{ maxWidth: 100 }}>
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已上架</option>
          <option value="UNPUBLISHED">已下架</option>
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
          className="input select" style={{ maxWidth: 160 }}>
          <option value="">全部课程</option>
          {filterCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <VideoCourseTable
        videos={videos}
        loading={loading}
        onPreview={setPreviewVideo}
        onDetail={setDetailVideo}
        onEdit={openEdit}
        onLogs={openLogs}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={handleDelete}
      />

      {/* Create/Edit Modal */}
      {modalOpen && (
        <VideoCourseEditModal
          initialVideo={editVideo}
          courses={modalCourses}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {/* Detail Modal */}
      {detailVideo && (
        <VideoDetailModal
          video={detailVideo}
          onClose={() => setDetailVideo(null)}
          onEdit={openEdit}
          onPreview={setPreviewVideo}
          onLogs={openLogs}
        />
      )}

      {/* Preview Modal */}
      {previewVideo && (
        <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}

      {/* Log Modal */}
      {logModal && (
        <VideoLogModal videoName={logVideoName} logs={logs} onClose={() => setLogModal(false)} />
      )}
    </AppLayout>
  );
}
