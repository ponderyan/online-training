'use client';

import { useState, useEffect } from 'react';

interface ReasonConfirmModalProps {
  open: boolean;
  title: string;
  /** 提示文案，描述这次操作的内容 */
  message?: string;
  /** 强制模式：textarea 为空时确认按钮置灰；可选模式：不填可跳过 */
  required?: boolean;
  /** 预设原因快捷选项（点击填入 textarea） */
  presetReasons?: string[];
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  onCancel: () => void;
  /** 确认回调，传入用户填写的原因（可能为空字符串） */
  onConfirm: (reason: string) => void;
}

/**
 * 操作原因弹窗。
 * - 强制模式（required=true）：成绩调分/证书吊销/删除/权限变更/强制交卷等，原因为空时确认置灰。
 * - 可选模式（required=false）：编辑题目/编辑试卷/取消发布等，有文本框但不填可跳过。
 */
export default function ReasonConfirmModal({
  open, title, message, required = false, presetReasons = [],
  confirmText = '确认', cancelText = '取消', onCancel, onConfirm,
}: ReasonConfirmModalProps) {
  const [reason, setReason] = useState('');

  // 每次打开时清空
  useEffect(() => { if (open) setReason(''); }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canConfirm = required ? trimmed.length > 0 : true;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper-bright, #fff)', borderRadius: 14, padding: 28,
        maxWidth: 460, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 className="text-base font-bold m-0 mb-2" style={{ color: 'var(--ink-700, #333)' }}>{title}</h3>
        {message && <p className="text-xs mb-3" style={{ color: 'var(--ink-400, #888)' }}>{message}</p>}

        {/* 预设原因快捷标签 */}
        {presetReasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presetReasons.map(preset => (
              <button key={preset} onClick={() => setReason(preset)}
                className="px-2 py-1 rounded-md text-[11px] border-none cursor-pointer transition-all"
                style={{
                  background: trimmed === preset ? 'var(--fox, #e87a30)' : 'var(--fox-glow, #fdf0e6)',
                  color: trimmed === preset ? '#fff' : 'var(--fox, #e87a30)',
                }}>
                {preset}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={required ? '请输入变更原因（必填）…' : '变更原因（可选）…'}
          className="input w-full"
          style={{ fontSize: 13, resize: 'vertical' }}
        />
        {required && (
          <p className="text-[10px] mt-1" style={{ color: trimmed ? 'var(--ink-300, #bbb)' : 'var(--verm, #d23847)' }}>
            {trimmed ? `${trimmed.length}/500 字` : '※ 此操作必须填写变更原因'}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all"
            style={{ background: 'var(--paper-dark, #f5f0eb)', color: 'var(--ink-500, #666)' }}>
            {cancelText}
          </button>
          <button
            onClick={() => canConfirm && onConfirm(trimmed)}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-all"
            style={{
              background: canConfirm ? 'var(--fox, #e87a30)' : 'var(--ink-100, #e0d8cf)',
              color: canConfirm ? '#fff' : 'var(--ink-300, #bbb)',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
