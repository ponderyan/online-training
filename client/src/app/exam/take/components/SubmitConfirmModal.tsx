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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,23,18,0.5)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="rounded-2xl w-full max-w-sm p-7 bg-[var(--paper-bright)] border border-[var(--ink-100)] shadow-lg animate-[fadeIn_0.2s_ease]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--fox-glow)]">
          <span className="text-2xl">📋</span>
        </div>

        <h3 className="text-lg font-semibold text-center mb-2 text-[var(--ink-700)] font-serif">
          确认交卷
        </h3>
        <p className="text-xs text-center mb-5 text-[var(--ink-400)]">
          提交后无法修改答案，请确认答题情况
        </p>

        <div className="flex gap-3 mb-5">
          <div className="flex-1 p-3 rounded-lg text-center bg-[var(--fox-glow)]">
            <p className="text-xl font-bold font-serif text-[var(--fox)]">{answeredCount}</p>
            <p className="text-[10px] text-[var(--ink-400)]">已作答</p>
          </div>
          <div className="flex-1 p-3 rounded-lg text-center bg-[var(--paper)]">
            <p className="text-xl font-bold font-serif text-[var(--ink-400)]">{unanswered}</p>
            <p className="text-[10px] text-[var(--ink-400)]">未作答</p>
          </div>
          <div className="flex-1 p-3 rounded-lg text-center bg-[var(--gold-glow)]">
            <p className="text-xl font-bold font-serif text-[var(--gold-dark)]">{markedCount}</p>
            <p className="text-[10px] text-[var(--ink-400)]">已标记</p>
          </div>
        </div>

        {/* 已答率进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1 text-[var(--ink-400)]">
            <span>已答率</span>
            <span>{totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--ink-100)]">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
                background: answeredCount === totalCount ? 'var(--cyan)' : 'var(--fox)',
              }} />
          </div>
        </div>

        {unanswered > 0 && unanswered <= 10 && unansweredIndices.length > 0 && (
          <p className="text-xs mb-4 text-[var(--ink-400)]">
            未答题目：第{' '}
            {unansweredIndices.map((i, idx) => (
              <span key={i} className="font-medium text-[var(--ink-600)]">
                {idx > 0 && '、'}{i + 1}
              </span>
            ))}{' '}题
          </p>
        )}
        {unanswered > 10 && (
          <p className="text-xs mb-4 text-[var(--ink-400)]">
            共有 {unanswered} 道题目未作答
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border-[1.5px] border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-500)] hover:border-[var(--ink-300)] transition-all">
            继续答题
          </button>
          <button onClick={onConfirm} disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--fox)] hover:bg-[var(--fox-dark)] transition-all disabled:opacity-50">
            {submitting ? '提交中…' : '确认交卷'}
          </button>
        </div>
      </div>
    </div>
  );
}
