'use client';

/**
 * 轻量 Toast 通知系统（无第三方依赖）
 *
 * 用法（顶层需挂载 <ToastProvider>）：
 *   const toast = useToast();
 *   toast.success('保存成功');
 *   toast.error('提交失败：' + e.message);
 *   toast.warning('请先选择学员');
 *   toast.info('已生成 12 道试题');
 *
 * 迁移 alert() 时：
 *   alert('✅ 保存成功')            → toast.success('保存成功')
 *   alert('保存失败：' + e.message) → toast.error('保存失败：' + e.message)
 *   alert('请填写xxx'); return;     → toast.warning('请填写xxx'); return;
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '💡',
};

const STYLES: Record<ToastType, { border: string; color: string; bg: string }> = {
  success: { border: 'var(--color-sage)', color: 'var(--color-sage)', bg: 'var(--sage-glow)' },
  error: { border: 'var(--color-verm)', color: 'var(--color-verm)', bg: 'var(--verm-glow)' },
  warning: { border: 'var(--color-gold)', color: 'var(--color-gold-dark)', bg: 'var(--gold-glow)' },
  info: { border: 'var(--color-cyan)', color: 'var(--color-cyan)', bg: 'var(--cyan-glow)' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = ++idRef.current;
      const auto = duration ?? (type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000);
      setToasts(prev => [...prev, { id, type, message, duration: auto }]);
      if (auto > 0) {
        setTimeout(() => remove(id), auto);
      }
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d),
    warning: (m, d) => push('warning', m, d),
    info: (m, d) => push('info', m, d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast 容器 —— 右上角堆叠 */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 'min(380px, calc(100vw - 32px))',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className="animate-slideDown"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--color-paper-bright)',
                borderLeft: `4px solid ${s.border}`,
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-lg)',
                border: `1px solid var(--color-ink-100)`,
                borderLeftWidth: 4,
                borderLeftColor: s.border,
                cursor: 'default',
              }}
              role="alert"
            >
              <span style={{ fontSize: '1rem', lineHeight: 1.4, flexShrink: 0 }} aria-hidden>
                {ICONS[t.type]}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  color: 'var(--color-ink-800)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {t.message}
              </span>
              <button
                onClick={() => remove(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-ink-300)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 未挂载 Provider 时降级为 console，避免页面崩溃
    return {
      success: m => console.info('[toast.success]', m),
      error: m => console.error('[toast.error]', m),
      warning: m => console.warn('[toast.warning]', m),
      info: m => console.info('[toast.info]', m),
    };
  }
  return ctx;
}
