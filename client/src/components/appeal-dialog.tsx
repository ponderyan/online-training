'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface AppealDialogProps {
  examId: number;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function AppealDialog({ examId, isOpen, onClose, onSubmitted }: AppealDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (reason.trim().length < 3) { setError('请描述您的疑问（至少3个字）'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.exams.appeal.submit(examId, reason);
      setReason('');
      onSubmitted();
      onClose();
    } catch (e: any) {
      setError(e.message || '提交失败');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-md p-6" style={{ background: 'white' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-700)' }}>📝 分数申诉</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>请描述您对考试分数的疑问，我们会尽快处理</p>
        <textarea value={reason} onChange={e => { setReason(e.target.value); setError(''); }}
          rows={5} maxLength={500} placeholder="输入申诉理由…（至少3个字，最多500字）"
          className="input w-full" />
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-500)' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: submitting ? 'var(--ink-300)' : 'var(--fox)' }}>
            {submitting ? '提交中…' : '提交申诉'}
          </button>
        </div>
      </div>
    </div>
  );
}
