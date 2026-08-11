'use client';

/**
 * 智能组卷 · 难度比例配置区块（自 generate/page.tsx 拆分，2026-08-11）
 */

export const DIFFS = ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'] as const;
export const DIFF_LABELS = ['易', '较易', '较难', '难'];
export const DIFF_COLORS = ['var(--info)', 'var(--warning)', 'var(--ink-500)', 'var(--error)'];

const DIFF_PRESETS = [
  { label: '均匀', value: { EASY: 25, MEDIUM_EASY: 25, MEDIUM_HARD: 25, HARD: 25 } },
  { label: '偏易', value: { EASY: 40, MEDIUM_EASY: 30, MEDIUM_HARD: 20, HARD: 10 } },
  { label: '偏难', value: { EASY: 10, MEDIUM_EASY: 20, MEDIUM_HARD: 30, HARD: 40 } },
];

interface Props {
  difficulty: Record<string, number>;
  onChange: (d: Record<string, number>) => void;
  onValueChange: (key: string, val: number) => void;
}

export default function DifficultyConfig({ difficulty, onChange, onValueChange }: Props) {
  const difficultyTotal = Object.values(difficulty).reduce((s, v) => s + v, 0);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[var(--ink-500)] block text-xs font-medium">难度比例配置</label>
        <div className="flex gap-1.5">
          {DIFF_PRESETS.map(p => (
            <button key={p.label} onClick={() => onChange(p.value)}
              className="text-xs px-2 py-0.5 rounded border border-solid cursor-pointer hover:opacity-70 transition-opacity border-[var(--ink-200)] text-[var(--ink-500)] bg-[var(--paper)]">{p.label}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 h-9 mb-2">
        {DIFFS.map((d, i) => (
          <div key={d} className="flex items-center justify-center text-white text-xs font-semibold rounded transition-all"
            style={{ flex: Math.max(difficulty[d], 1), backgroundColor: DIFF_COLORS[i], height: 22 + difficulty[d] * 0.3, minWidth: '36px', opacity: difficulty[d] === 0 ? 0.35 : 1 }}>
            {DIFF_LABELS[i]} {difficulty[d]}%
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {DIFFS.map((d, i) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ backgroundColor: DIFF_COLORS[i] }} />
            <span className="text-[var(--ink-500)] text-xs">{DIFF_LABELS[i]}</span>
            <input type="number" min={0} max={100} value={difficulty[d]} onChange={e => onValueChange(d, Number(e.target.value))}
              className="w-14 text-xs text-center rounded border border-solid py-0.5 border-[var(--ink-200)] text-[var(--ink-700)] bg-[var(--paper)]" />
            <span className="text-[var(--ink-400)] text-xs">%</span>
          </div>
        ))}
        <span className="text-xs font-semibold ml-1" style={{ color: difficultyTotal === 100 ? 'var(--cyan)' : 'var(--verm)' }}>
          合计 {difficultyTotal}%{difficultyTotal !== 100 && '（须=100%）'}
        </span>
      </div>
    </div>
  );
}
