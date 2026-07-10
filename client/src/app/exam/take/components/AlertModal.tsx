'use client';

import { useEffect, useRef } from 'react';

interface AlertModalProps {
  open: boolean;
  type: 'FORCE_END' | 'TAB_WARN' | 'TIME_REMINDER';
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  autoCloseMs?: number;
}

export default function AlertModal({
  open, type, message, onClose, onConfirm, autoCloseMs = 3000,
}: AlertModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && type !== 'FORCE_END') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, type, onClose]);

  useEffect(() => {
    if (!open || type !== 'TIME_REMINDER') return;
    timerRef.current = setTimeout(onClose, autoCloseMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open, type, autoCloseMs, onClose]);

  if (!open) return null;

  const isCritical = type === 'FORCE_END';
  const isReminder = type === 'TIME_REMINDER';
  const isWarn = type === 'TAB_WARN';

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === overlayRef.current && !isCritical) onClose(); }}>
      <div className="rounded-2xl w-full max-w-sm p-6 text-center" style={{ background: 'white', animation: 'fadeIn 0.2s ease-out' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{
          background: isCritical ? '#fef2f2' : isReminder ? '#fef3c7' : '#fef3e7',
        }}>
          <span className="text-2xl">{isCritical ? '🔒' : isReminder ? '⏰' : '⚠️'}</span>
        </div>

        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>
          {isCritical ? '考试已结束' : isReminder ? '时间提醒' : '切屏警告'}
        </h3>
        <p className="text-sm mb-6 leading-6" style={{ color: 'var(--ink-500)' }}>{message}</p>

        {isCritical && onConfirm && (
          <button onClick={onConfirm}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--fox)' }}>
            确定
          </button>
        )}
        {isWarn && (
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ background: '#fef3e7', color: 'var(--fox)' }}>
            知道了
          </button>
        )}
        {isReminder && (
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--fox)' }}>
            继续答题
          </button>
        )}
      </div>
    </div>
  );
}
