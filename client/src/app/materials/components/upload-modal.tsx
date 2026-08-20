'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function UploadModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [materialName, setMaterialName] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !!(e.target as HTMLElement)?.isContentEditable;
        if (!isEditable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async () => {
    if (!file || !subjectId) return;
    if (!batchNote.trim()) { toast.warning('请填写出题要求，说明题型、数量和难度分布'); return; }
    setUploading(true);
    setProgress('上传中…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', materialName || file.name.replace(/\.(pdf|pptx|docx|png|jpg|jpeg)$/i, ''));
      formData.append('subjectId', String(subjectId));
      formData.append('batchNote', batchNote);
      // P1-1: createdBy 由后端从认证token取，不再前端传入
      const result = await api.materials.upload(formData);
      setProgress('✅ 上传成功！小狐狸马上开始处理');
      setTimeout(() => { onClose(); router.push(`/materials/${result.id}`); }, 1500);
    } catch (e: any) { setProgress('❌ ' + e.message); }
    setUploading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="modal-card max-w-[480px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📖 上传教材</h3>
          <button onClick={onClose} disabled={uploading}
            className="text-[var(--ink-300)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">教材名称</label>
            <input value={materialName} onChange={e => setMaterialName(e.target.value)}
              placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">
              出题要求 <span className="text-[var(--verm)]">*必填</span>
            </label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'补充特殊要求（可选），如：侧重第三章、减少概念定义题、60%书上原话…'}
              className="input textarea" rows={5} />
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">教材文件（PDF / PPTX / DOCX / 图片PNG·JPG）</label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center transition-all"
              style={{ borderColor: file ? 'var(--fox)' : 'var(--ink-100)', background: file ? 'var(--fox-pale)' : 'var(--paper)' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && (f.type === 'application/pdf' || f.name.endsWith('.pptx') || f.name.endsWith('.docx')
                  || f.type.startsWith('image/'))) setFile(f);
              }}>
              {file ? (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-[var(--ink-700)] text-sm font-medium">{file.name}</p>
                  <p className="text-[var(--ink-400)] text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button onClick={() => setFile(null)} className="btn btn-ghost btn-xs mt-2">重新选择</button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="text-3xl mb-2">📂</div>
                  <p className="text-[var(--ink-500)] text-sm">拖拽或点击上传</p>
                  <input type="file" accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                </label>
              )}
            </div>
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={uploading} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!file || !subjectId || uploading}
            className="btn btn-fox btn-sm">{uploading ? '上传中…' : '上传并开始处理'}</button>
        </div>
      </div>
    </div>
  );
}
