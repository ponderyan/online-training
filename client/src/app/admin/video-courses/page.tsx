'use client';

import { useEffect, useState, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };
const TYPE_COLORS: Record<string, string> = { PUBLIC: '#00897b', SPECIALIZED: '#1565c0' };
const STATUS_NAMES: Record<string, string> = { DRAFT: '草稿', PUBLISHED: '已发布', UNPUBLISHED: '已下架' };
const STATUS_COLORS: Record<string, string> = { DRAFT: '#8b8174', PUBLISHED: '#2e7d32', UNPUBLISHED: '#e53935' };

const assetUrl = (path: string) =>
  process.env.NODE_ENV === 'production' ? path : `http://localhost:3001${path}`;

const parseDuration = (val: string) => {
  if (/^\d+:\d+:\d+$/.test(val)) { const [h, m, s] = val.split(':').map(Number); return h * 3600 + m * 60 + s; }
  if (/^\d+:\d+$/.test(val)) { const [m, s] = val.split(':').map(Number); return m * 60 + s; }
  return parseInt(val) || 0;
};

const fmtDuration = (sec: number) => {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};

export default function VideoCoursesPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    name: '', description: '', instructorName: '', instructorLevel: '',
    hours: '', url: '', coverUrl: '', duration: '', type: 'PUBLIC',
    isContinuingEducation: false, courseIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

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
      const data = await api.videoCourses.list({ pageSize: 50, type: filterType || undefined, keyword: searchKeyword || undefined, status: filterStatus || undefined });
      setVideos(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterType, filterStatus]);

  const doSearch = () => { load(); };

  const openNew = async () => {
    try {
      const data = await api.courses.list({ pageSize: '200' });
      setCourses(data.items || []);
    } catch {}
    setEditId(null);
    setForm({ name: '', description: '', instructorName: '', instructorLevel: '', hours: '', url: '', coverUrl: '', duration: '', type: 'PUBLIC', isContinuingEducation: false, courseIds: [] });
    setUploadFile(null);
    setVideoUrlInput(''); setShowVideoUrlInput(false);
    setCoverUrlInput(''); setShowCoverUrlInput(false);
    setModalOpen(true);
  };

  const openEdit = async (v: any) => {
    try {
      const data = await api.courses.list({ pageSize: '200' });
      setCourses(data.items || []);
    } catch {}
    setEditId(v.id);
    setForm({
      name: v.name, description: v.description || '', instructorName: v.instructorName || '',
      instructorLevel: v.instructorLevel || '', hours: v.hours?.toString() || '', status: v.status || 'DRAFT',
      url: v.url || '', coverUrl: v.coverUrl || '', duration: fmtDuration(v.duration) || '',
      type: v.type, isContinuingEducation: v.isContinuingEducation || false,
      courseIds: v.courseLinks?.map((cl: any) => cl.courseId) || [],
    });
    setModalOpen(true);
  };

  const openLogs = async (v: any) => {
    setLogVideoName(v.name);
    try { setLogs(await api.videoCourses.getLogs(v.id) || []); } catch { setLogs([]); }
    setLogModal(true);
  };

  const toggleCourseId = (courseId: number) => {
    setForm((prev: any) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id: number) => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  };

  const handleSave = async () => {
    if (!form.name) { alert('请输入视频课程名称'); return; }
    setSaving(true);
    try {
      // Upload file first if selected
      let url = form.url || undefined;
      let originalFileName: string | undefined;
      if (uploadFile) {
        setUploadingVideo(true);
        const fd = new FormData();
        fd.append('file', uploadFile);
        const uploadUrl = process.env.NODE_ENV === 'production'
          ? '/api/video-courses/upload'
          : 'http://localhost:3001/api/video-courses/upload';
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || '上传失败');
        url = data.url;
        originalFileName = data.originalFileName;
        setUploadingVideo(false);
      }

      const payload: Record<string, any> = {
        name: form.name, description: form.description || undefined,
        instructorName: form.instructorName || undefined, instructorLevel: form.instructorLevel || undefined,
        hours: form.hours ? parseFloat(form.hours) : undefined,
        url, coverUrl: form.coverUrl || undefined, duration: form.duration ? parseDuration(form.duration) : undefined,
        originalFileName,
        type: form.type, isContinuingEducation: form.isContinuingEducation,
        courseIds: form.type === 'SPECIALIZED' ? form.courseIds : [],
      };
      if (editId) {
        await api.videoCourses.update(editId, payload);
      } else {
        await api.videoCourses.create(payload);
      }
      setModalOpen(false);
      setUploadFile(null);
      setVideoUrlInput('');
      setShowVideoUrlInput(false);
      setCoverUrlInput('');
      setShowCoverUrlInput(false);
      load();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该视频课程吗？')) return;
    try { await api.videoCourses.delete(id); load(); } catch (e: any) { alert('删除失败：' + e.message); }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🎬 视频课程管理</h1>
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
          <option value="PUBLISHED">已发布</option>
          <option value="UNPUBLISHED">已下架</option>
        </select>
      </div>

      <p className="text-[10px] mb-2" style={{ color: 'var(--ink-300)' }}>💡 双击视频行可快速预览</p>
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : videos.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-4">🎬</p><p style={{ color: 'var(--ink-300)' }}>暂无视频课程</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead><tr>
              <th>视频</th><th>类型</th><th>讲师</th><th>时长</th><th>发布状态</th><th>视频状态</th><th>关联课程</th><th>操作</th>
            </tr></thead>
            <tbody>
              {videos.map((v: any) => (
                <tr key={v.id} onDoubleClick={() => setPreviewVideo(v)} className="group cursor-pointer">
                  <td>
                    <div className="flex items-center gap-2">
                      {v.coverUrl ? (
                        <img src={assetUrl(v.coverUrl)} alt="" className="rounded flex-shrink-0" style={{ width: 40, height: 27, objectFit: 'cover' }} />
                      ) : (
                        <div className="rounded flex-shrink-0 flex items-center justify-center text-xs" style={{ width: 40, height: 27, background: 'var(--ink-100)' }}>🎬</div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{v.name}</div>
                        {v.hours ? <div className="text-xs" style={{ color: 'var(--ink-300)' }}>{v.hours}h {v.duration ? `· ${fmtDuration(v.duration)}` : ''}</div> : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[v.type] || '#888'}18`, color: TYPE_COLORS[v.type] || '#888' }}>{TYPE_NAMES[v.type] || v.type}</span>
                      {v.isContinuingEducation && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#2e7d3218', color: '#2e7d32' }}>继续教育</span>}
                    </div>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{v.instructorName || '—'}{v.instructorLevel ? ` (${v.instructorLevel})` : ''}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{v.duration ? fmtDuration(v.duration) : '—'}</td>
                  <td>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (STATUS_COLORS[v.status] || '#888') + '18', color: STATUS_COLORS[v.status] || '#888' }}>
                      {STATUS_NAMES[v.status] || v.status || 'DRAFT'}
                    </span>
                  </td>
                  <td>
                    {v.url ? (
                      v.url.startsWith('http') ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1565c018', color: '#1565c0' }}>🔗 外部链接</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#2e7d3218', color: '#2e7d32' }}>✅ 已上传</span>
                      )
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#8b817418', color: '#8b8174' }}>⏳ 待上传</span>
                    )}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                    {v.courseLinks?.length > 0
                      ? `${v.courseLinks.slice(0, 2).map((cl: any) => cl.course?.name).join('、')}${v.courseLinks.length > 2 ? `…(+${v.courseLinks.length - 2})` : ''}`
                      : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => setDetailVideo(v)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>详情</button>
                      <button onClick={() => setPreviewVideo(v)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>预览</button>
                      {v.status === 'DRAFT' && (
                        <button onClick={async () => {
                          await fetch('/api/video-courses/' + v.id + '/publish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
                          load();
                        }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#2e7d32' }}>发布</button>
                      )}
                      {v.status === 'PUBLISHED' && (
                        <button onClick={async () => {
                          if (!confirm('下架后学员端将无法观看此视频，确定下架吗？')) return;
                          await fetch('/api/video-courses/' + v.id + '/unpublish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
                          load();
                        }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>下架</button>
                      )}
                      {v.status === 'UNPUBLISHED' && (
                        <button onClick={async () => {
                          await fetch('/api/video-courses/' + v.id + '/publish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
                          load();
                        }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#2e7d32' }}>重新发布</button>
                      )}
                      <button onClick={() => openEdit(v)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-500)' }}>修改</button>
                      <button onClick={() => openLogs(v)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>日志</button>
                      <button onClick={async () => {
                        if (v.status !== 'UNPUBLISHED') {
                          if (!confirm('删除前需要先下架，确定下架并删除吗？')) return;
                          await fetch('/api/video-courses/' + v.id + '/unpublish', { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).catch(() => {});
                        }
                        if (confirm('确定删除该视频课程吗？')) { await api.videoCourses.delete(v.id); load(); }
                      }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                      <span className="text-[10px] ml-1 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" style={{ color: 'var(--ink-300)' }}>双击预览</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8"
          onClick={() => !saving && setModalOpen(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">{editId ? '编辑视频课程' : '新建视频课程'}</h3>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>视频课程名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="例如：数字化转型概论" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>内容简介</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" rows={2} placeholder="视频课程内容简介" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>讲师姓名</label>
                  <input value={form.instructorName} onChange={e => setForm({ ...form, instructorName: e.target.value })} className="input w-full" placeholder="自由填写" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>讲师级别</label>
                  <input value={form.instructorLevel} onChange={e => setForm({ ...form, instructorLevel: e.target.value })} className="input w-full" placeholder="例如：高级讲师 / 专家" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课时数（小时）</label>
                  <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input w-full" type="number" step="0.5" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>视频时长</label>
                  <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="input w-full" placeholder="HH:MM:SS 或 MM:SS" />
                </div>
              </div>
              {/* 视频文件 — 渐进式交互 */}
              <div>
                <label className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--ink-400)' }}>
                  视频文件 <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>（MP4/AVI/MKV 等，最大 500MB）</span>
                </label>
                <input ref={videoFileRef} type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={e => { setUploadFile(e.target.files?.[0] || null); setForm((prev: any) => ({ ...prev, url: '' })); }} />
                {uploadingVideo ? (
                  <p className="text-xs" style={{ color: 'var(--fox)' }}>正在上传视频…</p>
                ) : uploadFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                    <span className="text-base">📹</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate font-medium">{uploadFile.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => setUploadFile(null)} className="text-xs bg-transparent border-none cursor-pointer flex-shrink-0" style={{ color: 'var(--verm)' }}>✕</button>
                  </div>
                ) : form.url ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                    <span className="text-base">🔗</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate font-medium">{form.url}</p>
                    </div>
                    <button onClick={() => { setForm((prev: any) => ({ ...prev, url: '' })); setShowVideoUrlInput(false); }} className="text-xs bg-transparent border-none cursor-pointer flex-shrink-0" style={{ color: 'var(--verm)' }}>✕</button>
                  </div>
                ) : showVideoUrlInput ? (
                  <div className="flex items-center gap-2">
                    <input value={videoUrlInput} onChange={e => setVideoUrlInput(e.target.value)}
                      className="input flex-1 text-xs" placeholder="https://example.com/video.mp4" />
                    <button onClick={() => {
                      if (videoUrlInput) { setForm((prev: any) => ({ ...prev, url: videoUrlInput })); setUploadFile(null); setShowVideoUrlInput(false); }
                    }} className="btn btn-fox btn-xs">确定</button>
                    <button onClick={() => { setShowVideoUrlInput(false); setVideoUrlInput(''); }} className="btn btn-ink btn-xs">取消</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => videoFileRef.current?.click()} className="btn btn-outline btn-xs">📁 选择视频文件</button>
                    <button onClick={() => setShowVideoUrlInput(true)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}>🔗 或粘贴链接</button>
                  </div>
                )}
              </div>

              {/* 视频封面 — 渐进式交互 */}
              <div>
                <label className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--ink-400)' }}>
                  视频封面 <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>（JPG/PNG，最大 5MB）</span>
                </label>
                <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingCover(true);
                    try {
                      const formData = new FormData();
                      formData.append('cover', file);
                      const res = await fetch('/api/video-courses/upload-cover', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: formData,
                      });
                      const data = await res.json();
                      setForm((prev: any) => ({ ...prev, coverUrl: data.url }));
                    } catch {}
                    setUploadingCover(false);
                  }} />
                {uploadingCover ? (
                  <p className="text-xs" style={{ color: 'var(--fox)' }}>正在上传封面…</p>
                ) : showCoverUrlInput ? (
                  <div className="flex items-center gap-2">
                    <input value={coverUrlInput} onChange={e => setCoverUrlInput(e.target.value)}
                      className="input flex-1 text-xs" placeholder="https://example.com/cover.jpg" />
                    <button onClick={() => {
                      if (coverUrlInput) { setForm((prev: any) => ({ ...prev, coverUrl: coverUrlInput })); setShowCoverUrlInput(false); }
                    }} className="btn btn-fox btn-xs">确定</button>
                    <button onClick={() => { setShowCoverUrlInput(false); setCoverUrlInput(''); }} className="btn btn-ink btn-xs">取消</button>
                  </div>
                ) : form.coverUrl ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <img src={assetUrl(form.coverUrl)} alt="封面预览" className="rounded" style={{ width: 100, height: 56, objectFit: 'cover', border: '1px solid var(--ink-100)' }} />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => coverFileRef.current?.click()} className="btn btn-outline btn-xs">更换图片</button>
                        <button onClick={() => setForm((prev: any) => ({ ...prev, coverUrl: '' }))} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>✕ 移除</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div onClick={() => coverFileRef.current?.click()} className="flex items-center justify-center rounded-lg cursor-pointer mb-2"
                      style={{ width: 100, height: 56, border: '2px dashed var(--ink-200)', borderRadius: 8 }}>
                      <span className="text-lg opacity-50">📷</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => coverFileRef.current?.click()} className="btn btn-outline btn-xs">选择图片</button>
                      <button onClick={() => setShowCoverUrlInput(true)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}>或粘贴链接 ›</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>类型</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, courseIds: [] })} className="input select w-full">
                    <option value="PUBLIC">公共课（所有学员可见）</option>
                    <option value="SPECIALIZED">专项课（需关联课程）</option>
                  </select>
                  {form.type === 'PUBLIC' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>公共课默认对所有学员开放，不绑定特定课程</p>
                  )}
                  {form.type === 'SPECIALIZED' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>专项课必须关联 ≥1 门课程，仅对应课程范围内的学员可见</p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer" style={{ marginTop: 32 }}>
                    <input type="checkbox" checked={form.isContinuingEducation}
                      onChange={e => setForm({ ...form, isContinuingEducation: e.target.checked })} className="w-4 h-4 accent-[#e87a30]" />
                    <span className="text-sm">计入继续教育学时</span>
                  </label>
                </div>
              </div>

              {form.type === 'SPECIALIZED' && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>关联课程（可多选）</label>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto" style={{ borderColor: 'var(--ink-200)' }}>
                    {courses.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无课程数据</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {courses.map((c: any) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                            <input type="checkbox" checked={form.courseIds.includes(c.id)}
                              onChange={() => toggleCourseId(c.id)} className="w-3.5 h-3.5" />
                            <span className="truncate">{c.name}</span>
                            <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                              ({c.type === 'STANDARD' ? '标准' : '定制'})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
                <button onClick={() => setModalOpen(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailVideo(null)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base">📋 {detailVideo.name}</h3>
              <button onClick={() => setDetailVideo(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>类型</span>
                  <span className="tag mt-1" style={{
                    background: detailVideo.type === 'PUBLIC' ? '#00897b18' : '#1565c018',
                    color: detailVideo.type === 'PUBLIC' ? '#00897b' : '#1565c0',
                    fontSize: '10px',
                  }}>{detailVideo.type === 'PUBLIC' ? '公共课' : '专项课'}</span>
                </div>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>继续教育学时</span>
                  <span className="tag mt-1" style={{
                    background: detailVideo.isContinuingEducation ? '#2e7d3218' : '#8b817418',
                    color: detailVideo.isContinuingEducation ? '#2e7d32' : '#8b8174',
                    fontSize: '10px',
                  }}>{detailVideo.isContinuingEducation ? '是' : '否'}</span>
                </div>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>讲师</span>
                  <p className="mt-0.5">{detailVideo.instructorName || '—'}{detailVideo.instructorLevel ? ` (${detailVideo.instructorLevel})` : ''}</p>
                </div>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>课时 / 时长</span>
                  <p className="mt-0.5">{detailVideo.hours ? `${detailVideo.hours}h` : '—'} · {detailVideo.duration ? `${detailVideo.duration}秒` : '—'}</p>
                </div>
              </div>
              {detailVideo.description && (
                <div>
                  <span className="text-xs block mb-1" style={{ color: 'var(--ink-300)' }}>简介</span>
                  <p className="text-sm" style={{ color: 'var(--ink-600)' }}>{detailVideo.description}</p>
                </div>
              )}
              {detailVideo.courseLinks?.length > 0 && (
                <div>
                  <span className="text-xs block mb-1" style={{ color: 'var(--ink-300)' }}>关联课程</span>
                  <div className="flex flex-wrap gap-1">
                    {detailVideo.courseLinks.map((cl: any) => (
                      <span key={cl.id} className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '10px' }}>
                        {cl.course?.name || '课程#' + cl.courseId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>创建时间</span>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--ink-400)' }}>
                    {new Date(detailVideo.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>最后修改</span>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--ink-400)' }}>
                    {new Date(detailVideo.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                {detailVideo.url && (
                  <div className="col-span-2">
                    <span className="text-xs block" style={{ color: 'var(--ink-300)' }}>视频文件</span>
                    <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--ink-400)' }}>{detailVideo.url}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5 pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <button onClick={() => { setDetailVideo(null); openEdit(detailVideo); }} className="btn btn-fox btn-sm">修改</button>
              <button onClick={() => { setDetailVideo(null); setPreviewVideo(detailVideo); }} className="btn btn-outline btn-sm">▶ 播放</button>
              <button onClick={() => { setDetailVideo(null); openLogs(detailVideo); }} className="btn btn-outline btn-sm">日志</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreviewVideo(null)}>
          <div className="rounded-xl overflow-hidden w-full max-w-3xl" style={{ background: '#000' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ background: '#111' }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white truncate block">{previewVideo.name}</span>
                {previewVideo.description && (
                  <span className="text-xs mt-0.5 block" style={{ color: '#aaa' }}>{previewVideo.description}</span>
                )}
              </div>
              <button onClick={() => setPreviewVideo(null)} className="text-white/60 hover:text-white bg-transparent border-none cursor-pointer text-lg ml-3 flex-shrink-0">✕</button>
            </div>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <video controls autoPlay style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                <source src={`${window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''}/api/video-courses/${previewVideo.id}/stream?token=${encodeURIComponent(localStorage.getItem('token') || '')}`} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLogModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base">📋 操作日志 — {logVideoName}</h3>
              <button onClick={() => setLogModal(false)} className="text-sm bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            {logs.length === 0 ? (
              <p className="py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无操作记录</p>
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5" style={{ background: 'var(--ink-200)' }} />
                {logs.map((log: any) => (
                  <div key={log.id} className="relative pb-5">
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                      style={{ background: 'var(--paper)', borderColor: 'var(--fox)' }} />
                    <div className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </div>
                    <div className="text-sm mt-0.5">{log.action}</div>
                    {log.operator && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>操作人：{log.operator.displayName}</div>
                    )}
                    {log.detail && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{log.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
