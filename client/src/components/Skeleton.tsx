'use client';

/**
 * 骨架屏组件集 —— 加载态占位，模仿最终内容形状的灰色脉冲块
 *
 * 组件：
 *   <SkeletonText lines={3} />           多行文本模拟
 *   <SkeletonCard />                      单张卡片模拟
 *   <SkeletonList count={5} />            列表行模拟（默认 5 行）
 *   <SkeletonTable rows={6} cols={4} />   表格模拟
 *   <SkeletonBar width="60%" />           单根脉冲条（原子组件）
 */

const SHIMMER =
  'background: linear-gradient(90deg, var(--color-paper-dark) 25%, var(--color-paper) 37%, var(--color-paper-dark) 63%); background-size: 400% 100%; animation: skeleton-shimmer 1.4s ease infinite;';

// 注入一次 keyframes
let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent =
    '@keyframes skeleton-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}';
  document.head.appendChild(style);
}

/** 原子：单根脉冲条 */
export function SkeletonBar({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  ensureKeyframes();
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      } as React.CSSProperties}
      data-skeleton
    >
      <style>{`.skeleton-fill{${SHIMMER}}`}</style>
      <div className="skeleton-fill" style={{ width: '100%', height: '100%', borderRadius: radius }} />
    </div>
  );
}

/** 多行文本骨架 */
export function SkeletonText({ lines = 3, lineH = 14, gap = 10 }: { lines?: number; lineH?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBar key={i} width={i === lines - 1 ? '60%' : '100%'} height={lineH} />
      ))}
    </div>
  );
}

/** 单张卡片骨架 */
export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <SkeletonBar width={40} height={40} radius={8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBar width="70%" height={14} />
          <SkeletonBar width="40%" height={11} />
        </div>
      </div>
      <SkeletonText lines={2} gap={8} lineH={11} />
    </div>
  );
}

/** 列表行骨架 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            padding: '14px 0',
            borderBottom: '1px solid var(--color-ink-100)',
          }}
        >
          <SkeletonBar width={36} height={36} radius={8} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBar width="45%" height={13} />
            <SkeletonBar width="25%" height={10} />
          </div>
          <SkeletonBar width={60} height={22} radius={4} />
        </div>
      ))}
    </div>
  );
}

/** 表格骨架 */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      {/* 表头 */}
      <div style={{ display: 'flex', gap: 0, padding: '10px 14px', borderBottom: '1px solid var(--color-ink-100)', background: 'var(--color-paper)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} style={{ flex: 1, padding: '0 8px' }}>
            <SkeletonBar width="60%" height={10} />
          </div>
        ))}
      </div>
      {/* 行 */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{ display: 'flex', gap: 0, padding: '14px', borderBottom: '1px solid var(--color-ink-100)' }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{ flex: 1, padding: '0 8px' }}>
              <SkeletonBar width={c === 0 ? '70%' : '50%'} height={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 卡片网格骨架（学习中心等用） */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
