'use client';

// ── 统计卡片组件 ──
export function StatCard({ icon, value, label, color, badge, urgent }: {
  icon: string; value: string | number; label: string;
  color: 'fox' | 'cyan' | 'sage' | 'gold';
  badge?: string; urgent?: boolean;
}) {
  const colorMap = {
    fox: { bar: 'bg-[var(--fox)]', value: 'text-[var(--fox)]' },
    cyan: { bar: 'bg-[var(--cyan)]', value: 'text-[var(--cyan)]' },
    sage: { bar: 'bg-[var(--sage)]', value: 'text-[var(--sage)]' },
    gold: { bar: 'bg-[var(--gold)]', value: 'text-[var(--gold-dark)]' },
  };
  const c = colorMap[color];
  return (
    <div className="relative overflow-hidden rounded-card border border-[var(--ink-100)] bg-[var(--paper-bright)] p-5 transition-all hover:shadow-md hover:border-[var(--fox)] hover:-translate-y-px">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${c.bar}`} />
      <span className="block mb-2 text-2xl">{icon}</span>
      <div className={`font-serif text-[1.9rem] font-bold leading-tight ${c.value}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--ink-400)]">{label}</div>
      {badge && (
        <span className={`absolute top-4 right-4 rounded border px-2 py-px text-[0.62rem] ${
          urgent ? 'border-[var(--verm)] text-[var(--verm)] bg-[var(--verm-glow)]' : 'border-[var(--ink-100)] text-[var(--ink-300)]'
        }`}>{badge}</span>
      )}
    </div>
  );
}

// ── 待办事项组件 ──
export function TodoItem({ dot, text, href, urgent, router }: {
  dot: 'fox' | 'verm' | 'cyan'; text: string; href: string; urgent?: boolean; router: any;
}) {
  const dotMap = { fox: 'bg-[var(--fox)]', verm: 'bg-[var(--verm)]', cyan: 'bg-[var(--cyan)]' };
  return (
    <div onClick={() => router.push(href)}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded cursor-pointer transition-colors mb-1.5 last:mb-0 ${
        urgent ? 'bg-[var(--verm-glow)] hover:bg-[rgba(217,54,74,0.14)]' : 'hover:bg-[var(--paper-dark)]'
      }`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[dot]}`} />
      <span className="flex-1 text-xs text-[var(--ink-600)]">{text}</span>
      <span className="text-xs text-[var(--ink-400)]">→</span>
    </div>
  );
}

// ── 快捷操作组件 ──
export function QuickAction({ icon, label, href, primary, router }: {
  icon: string; label: string; href: string; primary?: boolean; router: any;
}) {
  return (
    <button onClick={() => router.push(href)}
      className={`flex items-center gap-2.5 px-4 py-3.5 rounded text-xs font-medium transition-all ${
        primary
          ? 'bg-[var(--fox)] border border-[var(--fox)] text-white hover:bg-[var(--fox-dark)]'
          : 'bg-[var(--paper-bright)] border border-[var(--ink-100)] text-[var(--ink-700)] hover:border-[var(--fox)] hover:bg-[var(--fox-glow)] hover:text-[var(--fox-dark)] hover:-translate-y-px'
      }`}>
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

export const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
export const STATUS_COLORS: Record<string, string> = {
  PREPARING: 'var(--ink-300)', ENROLLING: 'var(--cyan)', IN_PROGRESS: 'var(--fox)',
  REVIEWING: 'var(--fox)', CERTIFYING: 'var(--gold)', COMPLETED: 'var(--sage)', CANCELLED: 'var(--ink-300)',
};
