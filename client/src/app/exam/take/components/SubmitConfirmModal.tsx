'use client';

import { useEffect, useRef } from 'react';

interface SubmitConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  answeredCount: number;
  totalCount: number;
  markedCount: number;
  unansweredIndices: number[];
  submitting?: boolean;
}

export default function SubmitConfirmModal({
  open, onClose, onConfirm,
  answeredCount, totalCount, markedCount,
  unansweredIndices, submitting,
}: SubmitConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const unanswered = totalCount - answeredCount;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="rounded-2xl w-full max-w-sm p-6" style={{ background: 'white' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--fox-glow)' }}>
          <span className="text-2xl">📋</span>
        </div>

        <h3 className="text-lg font-semibold text-center mb-2" style={{ color: 'var(--ink-700)' }}>
          确认交卷
        </h3>
        <p className="text-xs text-center mb-5" style={{ color: 'var(--ink-400)' }}>
          提交后无法修改答案，请确认答题情况
        </p>

        <div className="flex gap-3 mb-5">
          <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#fef3e7' }}>
            <p className="text-xl font-bold" style={{ color: 'var(--fox)' }}>{answeredCount}</p>
            <p className="text-[10px]" style={{ color: 'var(--ink-400)' }}>已作答</p>
          </div>
          <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#faf8f5' }}>
            <p className="text-xl font-bold" style={{ color: unanswered > 0 ? '#ef4444' : '#22c55e' }}>{unanswered}</p>
            <p className="text-[10px]" style={{ color: 'var(--ink-400)' }}>未作答</p>
          </div>
          <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#fefce8' }}>
            <p className="text-xl font-bold" style={{ color: '#ca8a04' }}>{markedCount}</p>
            <p className="text-[10px]" style={{ color: 'var(--ink-400)' }}>已标记</p>
          </div>
        </div>

        {/* 已答率进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--ink-400)' }}>
            <span>已答率</span>
            <span>{totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
              background: answeredCount === totalCount ? 'var(--cyan)' : 'var(--fox)',
            }} />
          </div>
        </div>

        {unanswered > 0 && unanswered <= 10 && unansweredIndices.length > 0 && (
          <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>
            未答题目：第{' '}
            {unansweredIndices.map((i, idx) => (
              <span key={i} className="font-medium" style={{ color: 'var(--ink-600)' }}>
                {idx > 0 && '、'}{i + 1}
              </span>
            ))}{' '}题
          </p>
        )}
        {unanswered > 10 && (
          <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>
            共有 {unanswered} 道题目未作答
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-500)' }}>
            继续答题
          </button>
          <button onClick={onConfirm} disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: submitting ? 'var(--ink-300)' : 'var(--fox)' }}>
            {submitting ? '提交中…' : '确认交卷'}
          </button>
        </div>
      </div>
    </div>
  );
}
