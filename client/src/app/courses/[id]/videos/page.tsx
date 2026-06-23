'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function CourseVideosPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDuration, setUploadDuration] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRequiredPct, setEditRequiredPct] = useState('80');
  const [editIsPublic, setEditIsPublic] = useState(false);

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

  const handleUpload = async () => {
    if (!uploadFile) { alert('请选择视频文件'); return; }
    if (!uploadTitle) { alert('请输入视频标题'); return; }
    setUploading(true);
    try {
      await api.courseVideos.upload(Number(params.id), uploadFile, uploadTitle, parseInt(uploadDuration) || 0);
      setShowUpload(false);
      setUploadTitle('');
      setUploadFile(null);
      setUploadDuration('');
      load();
    } catch (e: any) { alert('上传失败：' + e.message); }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该视频吗？')) return;
    try { await api.courseVideos.delete(Number(params.id), id); load(); }
    catch (e: any) { alert('删除失败：' + e.message); }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = videos.map(v => v.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    try { await api.courseVideos.reorder(Number(params.id), ids); load(); }
    catch (e: any) { alert('排序失败：' + e.message); }
  };

  const handleMoveDown = async (index: number) => {
    if (index === videos.length - 1) return;
    const ids = videos.map(v => v.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try { await api.courseVideos.reorder(Number(params.id), ids); load(); }
    catch (e: any) { alert('排序失败：' + e.message); }
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setEditTitle(v.title);
    setEditRequiredPct(v.requiredPct?.toString() || '80');
    setEditIsPublic(v.isPublic || false);
  };

  const saveEdit = async (id: number) => {
    try {
      await api.courseVideos.update(Number(params.id), id, {
        title: editTitle,
        requiredPct: parseFloat(editRequiredPct),
        isPublic: editIsPublic,
      });
      setEditingId(null);
      load();
    } catch (e: any) { alert('保存失败：' + e.message); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push(`/courses/${params.id}`)} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回课程详情</button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🎬 视频管理</h1>
          <p className="page-subtitle">{course?.name || '加载中…'} · 共 {videos.length} 个视频</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn btn-fox btn-sm">➕ 上传视频</button>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !uploading && setShowUpload(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">上传视频</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>视频标题 *</label>
                <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="input w-full" placeholder="例如：第一章 数字化转型概述" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>视频文件 *</label>
                <input type="file" accept="video/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="input w-full" />
                {uploadFile && <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>时长（秒，可选）</label>
                <input value={uploadDuration} onChange={e => setUploadDuration(e.target.value)} className="input w-full" type="number" placeholder="例如：3600" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpload} disabled={uploading} className="btn btn-fox btn-sm">
                  {uploading ? '上传中…' : '上传'}
                </button>
                <button onClick={() => setShowUpload(false)} disabled={uploading} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="card p-0 overflow-hidden">
        {videos.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--ink-300)' }}>
            <p className="text-4xl mb-4">🎬</p>
            <p>暂无视频</p>
            <button onClick={() => setShowUpload(true)} className="btn btn-fox btn-sm mt-4">上传第一个视频</button>
          </div>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>标题</th>
                <th>时长</th>
                <th>完成条件</th>
                <th>类型</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v: any, i: number) => (
                <tr key={v.id}>
                  {editingId === v.id ? (
                    <>
                      <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</td>
                      <td>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input w-full" />
                      </td>
                      <td style={{ color: 'var(--ink-400)' }} className="text-xs">{formatDuration(v.duration)}</td>
                      <td>
                        <input value={editRequiredPct} onChange={e => setEditRequiredPct(e.target.value)} className="input" style={{ width: 70 }} type="number" />%
                      </td>
                      <td>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={editIsPublic} onChange={e => setEditIsPublic(e.target.checked)} className="w-3.5 h-3.5" />
                          <span className="text-xs">公共课</span>
                        </label>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(v.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--sage)' }}>保存</button>
                          <button onClick={() => setEditingId(null)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>取消</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</td>
                      <td className="font-medium">{v.title}</td>
                      <td style={{ color: 'var(--ink-400)' }} className="text-xs">{formatDuration(v.duration)}</td>
                      <td className="text-xs">{v.requiredPct}%</td>
                      <td>{v.isPublic ? <span className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '10px' }}>公共课</span> : <span className="tag" style={{ background: '#8b817418', color: '#8b8174', fontSize: '10px' }}>专项课</span>}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(v)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>编辑</button>
                          <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: i === 0 ? 'var(--ink-200)' : 'var(--ink-400)' }}>↑</button>
                          <button onClick={() => handleMoveDown(i)} disabled={i === videos.length - 1} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: i === videos.length - 1 ? 'var(--ink-200)' : 'var(--ink-400)' }}>↓</button>
                          <button onClick={() => handleDelete(v.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
