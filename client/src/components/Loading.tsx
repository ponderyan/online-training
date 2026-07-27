'use client';

/**
 * 加载指示组件 —— 用于详情页 / 弹窗 / 按钮内等非列表场景
 * 列表页加载态请使用 Skeleton 组件
 *
 * 用法：
 *   <Loading />                          居中旋转 + 默认文案
 *   <Loading text="正在加载考试…" />      自定义文案
 *   <Loading inline />                   行内小尺寸（不居中、无文案）
 */
export default function Loading({
  text = '小狐狸正在加载…',
  inline = false,
  full = false,
}: {
  text?: string;
  inline?: boolean;
  full?: boolean;
}) {
  const spinner = (
    <span
      className="fox-spin"
      style={{
        display: 'inline-block',
        width: inline ? 14 : 22,
        height: inline ? 14 : 22,
        border: `${inline ? 2 : 3}px solid var(--color-ink-100)`,
        borderTopColor: 'var(--color-fox)',
        borderRadius: '50%',
        animation: 'fox-spin 0.7s linear infinite',
      }}
      aria-hidden
    />
  );
  // 注入一次 keyframes
  if (typeof document !== 'undefined' && !(document as any).__foxSpinInjected) {
    (document as any).__foxSpinInjected = true;
    const s = document.createElement('style');
    s.textContent = '@keyframes fox-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  if (inline) return spinner;

  const wrapStyle: React.CSSProperties = full
    ? {
        position: 'fixed',
        inset: 0,
        background: 'rgba(239,233,220,0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 40,
      }
    : {};

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ padding: full ? 0 : '40px 0', gap: 12, ...wrapStyle }}
      role="status"
      aria-live="polite"
    >
      {spinner}
      {!full && <span style={{ color: 'var(--ink-300)', fontSize: '0.8rem' }}>{text}</span>}
    </div>
  );
}
