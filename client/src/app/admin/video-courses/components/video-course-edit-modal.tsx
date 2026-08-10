// 视频课程新建/编辑弹窗（自 page.tsx 迁出，纯重构零行为变化）
// 按 initialVideo 回填表单（courses 由父级打开前预加载，保持原时序；父级条件渲染保证每次打开全新挂载）
'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { assetUrl, parseDuration, fmtDuration } from './video-course-constants';

const EMPTY_FORM = {
  name: '', description: '', instructorName: '', instructorLevel: '',
  hours: '', url: '', coverUrl: '', duration: '', type: 'PUBLIC',
  isContinuingEducation: false, requiredPct: '80', courseIds: [] as number[],
};

export function VideoCourseEditModal({ initialVideo, courses, onClose, onSaved }: {
  initialVideo: any | null;
  courses: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editId = initialVideo?.id ?? null;
  const [form, setForm] = useState<any>(() => initialVideo ? {
    name: initialVideo.name, description: initialVideo.description || '', instructorName: initialVideo.instructorName || '',
    instructorLevel: initialVideo.instructorLevel || '', hours: initialVideo.hours?.toString() || '', status: initialVideo.status || 'DRAFT',
    url: initialVideo.url || '', coverUrl: initialVideo.coverUrl || '', duration: fmtDuration(initialVideo.duration) || '',
    type: initialVideo.type, isContinuingEducation: initialVideo.isContinuingEducation || false, requiredPct: (initialVideo.requiredPct || 80).toString(),
    courseIds: initialVideo.courseLinks?.map((cl: any) => cl.courseId) || [],
  } : { ...EMPTY_FORM });
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

  const toggleCourseId = (courseId: number) => {
    setForm((prev: any) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id: number) => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  };

  const handleSave = async (publishNow = false) => {
    if (!form.name) { toast.warning('请输入视频课程名称'); return; }
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
        requiredPct: form.requiredPct ? parseFloat(form.requiredPct) : 80,
        url, coverUrl: form.coverUrl || undefined, duration: form.duration ? parseDuration(form.duration) : undefined,
        originalFileName,
        type: form.type, isContinuingEducation: form.isContinuingEducation,
        courseIds: form.type === 'SPECIALIZED' ? form.courseIds : [],
      };
      let savedId = editId;
      if (editId) {
        await api.videoCourses.update(editId, payload);
      } else {
        const created = await api.videoCourses.create(payload);
        savedId = created.id;
      }
      // 保存并上架
      if (publishNow && savedId) {
        await fetch(`/api/video-courses/${savedId}/publish`, { method: 'PUT', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      }
      onSaved();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8"
      onClick={() => !saving && onClose()}>
      <div className="rounded-xl p-6 w-full max-w-2xl bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-base mb-4">{editId ? '编辑视频课程' : '新建视频课程'}</h3>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="text-[var(--ink-400)] text-xs mb-1 block">视频课程名称 *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="例如：数字化转型概论" />
          </div>
          <div>
            <label className="text-[var(--ink-400)] text-xs mb-1 block">内容简介</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" rows={2} placeholder="视频课程内容简介" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">讲师姓名</label>
              <input value={form.instructorName} onChange={e => setForm({ ...form, instructorName: e.target.value })} className="input w-full" placeholder="自由填写" />
            </div>
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">职称</label>
              <select value={form.instructorLevel} onChange={e => setForm({ ...form, instructorLevel: e.target.value })} className="input select w-full">
                <option value="">请选择</option>
                <option value="初级工程师">初级工程师</option>
                <option value="中级工程师">中级工程师</option>
                <option value="副高级工程师">副高级工程师</option>
                <option value="正高级工程师">正高级工程师</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">课时数（小时）</label>
              <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input w-full" type="number" step="0.5" />
            </div>
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">视频时长</label>
              <input value={form.duration} readOnly className="input w-full bg-[var(--paper)]" style={{  color: form.duration ? 'var(--ink-600)' : 'var(--ink-300)' }} placeholder="上传视频后自动提取" />
            </div>
          </div>
          {/* 视频文件 — 渐进式交互 */}
          <div>
            <label className="text-[var(--ink-400)] text-xs mb-1 flex items-center gap-1">
              视频文件 <span className="text-[var(--ink-300)] text-[10px]">（MP4/AVI/MKV 等，最大 500MB）</span>
            </label>
            <input ref={videoFileRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0] || null;
                setUploadFile(file);
                setForm((prev: any) => ({ ...prev, url: '' }));
                // 自动提取视频时长
                if (file) {
                  const tmpVideo = document.createElement('video');
                  tmpVideo.preload = 'metadata';
                  tmpVideo.onloadedmetadata = () => {
                    const sec = Math.round(tmpVideo.duration);
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    const s = sec % 60;
                    const formatted = h > 0
                      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                      : `${m}:${String(s).padStart(2,'0')}`;
                    setForm((prev: any) => ({ ...prev, duration: formatted }));
                    URL.revokeObjectURL(tmpVideo.src);
                  };
                  tmpVideo.src = URL.createObjectURL(file);
                }
              }} />
            {uploadingVideo ? (
              <p className="text-[var(--fox)] text-xs">正在上传视频…</p>
            ) : uploadFile ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
                <span className="text-base">��</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-medium">{uploadFile.name}</p>
                  <p className="text-[var(--ink-300)] text-[10px]">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setUploadFile(null)} className="text-xs bg-transparent border-none cursor-pointer flex-shrink-0 text-[var(--verm)]" >✕</button>
              </div>
            ) : form.url ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
                <span className="text-base">🔗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-medium">{form.url}</p>
                </div>
                <button onClick={() => { setForm((prev: any) => ({ ...prev, url: '' })); setShowVideoUrlInput(false); }} className="text-xs bg-transparent border-none cursor-pointer flex-shrink-0 text-[var(--verm)]" >✕</button>
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
                <button onClick={() => setShowVideoUrlInput(true)} className="btn btn-ghost btn-xs text-[var(--ink-300)]" >🔗 或粘贴链接</button>
              </div>
            )}
          </div>

          {/* 视频封面 — 渐进式交互 */}
          <div>
            <label className="text-[var(--ink-400)] text-xs mb-1 flex items-center gap-1">
              视频封面 <span className="text-[var(--ink-300)] text-[10px]">（JPG/PNG，最大 5MB）</span>
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
              <p className="text-[var(--fox)] text-xs">正在上传封面…</p>
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
                    <button onClick={() => setForm((prev: any) => ({ ...prev, coverUrl: '' }))} className="btn btn-ghost btn-xs text-[var(--verm)]" >✕ 移除</button>
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
                  <button onClick={() => setShowCoverUrlInput(true)} className="btn btn-ghost btn-xs text-[var(--ink-300)]" >或粘贴链接 ›</button>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">类型</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, courseIds: [] })} className="input select w-full">
                <option value="PUBLIC">公共课（所有学员可见）</option>
                <option value="SPECIALIZED">专项课（需关联课程）</option>
              </select>
              {form.type === 'PUBLIC' && (
                <p className="text-[var(--ink-300)] text-xs mt-1">公共课默认对所有学员开放，不绑定特定课程</p>
              )}
              {form.type === 'SPECIALIZED' && (
                <p className="text-[var(--ink-300)] text-xs mt-1">专项课必须关联 ≥1 门课程，仅对应课程范围内的学员可见</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer" style={{ marginTop: 32 }}>
                <input type="checkbox" checked={form.isContinuingEducation}
                  onChange={e => setForm({ ...form, isContinuingEducation: e.target.checked })} className="w-4 h-4 accent-[var(--fox)]" />
                <span className="text-sm">计入继续教育学时</span>
              </label>
            </div>
          </div>

          {form.type === 'SPECIALIZED' && (
            <div>
              <label className="text-[var(--ink-400)] text-xs mb-1 block">关联课程（可多选）</label>
              <div className="border-[var(--ink-200)] border rounded-lg p-3 max-h-40 overflow-y-auto">
                {courses.length === 0 ? (
                  <p className="text-[var(--ink-300)] text-xs">暂无课程数据</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {courses.map((c: any) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                        <input type="checkbox" checked={form.courseIds.includes(c.id)}
                          onChange={() => toggleCourseId(c.id)} className="w-3.5 h-3.5" />
                        <span className="truncate">{c.name}</span>
                        <span className="text-[var(--ink-300)] text-xs">
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
            <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-outline btn-sm">{saving ? '保存中…' : '保存草稿'}</button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存并上架'}</button>
            <button onClick={onClose} className="btn btn-outline btn-sm">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
