// 学习报告页共享常量与工具（自 page.tsx 迁出，纯重构零行为变化）

export const LEVEL_COLORS: Record<string, string> = {
  '优秀': 'var(--sage)',
  '良好': 'var(--sage)',
  '一般': 'var(--warning)',
  '薄弱': 'var(--error)',
  '危险': 'var(--error)',
};

export const PIE_COLORS = ['var(--fox)', 'var(--sage)', 'var(--info)', 'var(--warning)', 'var(--ink-300)', 'var(--warning)'];

export const chartTooltipStyle = {
  background: 'var(--paper-dark)',
  border: '1px solid var(--ink-200)',
  borderRadius: '8px',
  fontSize: '12px',
  padding: '8px 12px',
};

// ── 各等级进度条颜色 ──
export function masteryBarColor(level: string): string {
  return LEVEL_COLORS[level] || 'var(--ink-300)';
}
