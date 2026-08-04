'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function ManualEntryModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !subjectId || !content.trim()) { toast.warning('请填写教材名称和正文内容'); return; }
    setSubmitting(true);
    setProgress('提交中…');
    try {
      const result = await api.materials.create({ name: name.trim(), subjectId: Number(subjectId), content: content.trim(), batchNote: batchNote.trim() || undefined });
      setProgress('✅ 创建成功！');
      setTimeout(() => { onClose(); router.push(`/materials/${result.id}`); }, 1500);
    } catch (e: any) { setProgress('❌ ' + e.message); }
    setSubmitting(false);
  };

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

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="modal-card max-w-[560px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📝 录入正文</h3>
          <button onClick={onClose} disabled={submitting} className="text-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)' }}>✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>正文内容 <span style={{ color: 'var(--verm)' }}>*必填</span></label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={'请粘贴教材正文内容…'} className="input textarea" rows={12} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>出题要求 <span className="text-xs" style={{ color: 'var(--ink-400)' }}>（可选）</span></label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'补充特殊要求（可选），如：侧重第三章、减少概念定义题…'} className="input textarea" rows={3} />
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={submitting} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !subjectId || !content.trim() || submitting}
            className="btn btn-fox btn-sm">{submitting ? '提交中…' : '创建教材'}</button>
        </div>
      </div>
    </div>
  );
}
