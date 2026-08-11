'use client';

/**
 * 智能组卷 · 题型选择与参数配置区块（自 generate/page.tsx 拆分，2026-08-11）
 */

interface Props {
  allTypes: string[];
  typeNames: Record<string, string>;
  enabledTypes: string[];
  typeConfigs: Record<string, { count: number; score: number; blanksPerQ?: number }>;
  lockedTypes: string[];
  lockedCounts: Record<string, number>;
  totalScore: number;
  totalFromTypes: number;
  onToggle: (t: string) => void;
  onConfigChange: (t: string, field: string, value: number) => void;
  subtotal: (t: string) => number;
}

export default function TypeConfigSection({ allTypes, typeNames, enabledTypes, typeConfigs, lockedTypes, lockedCounts, totalScore, totalFromTypes, onToggle, onConfigChange, subtotal }: Props) {
  const scoreValid = totalFromTypes === totalScore;
  return (
    <>
      {/* 题型选择 */}
      <div className="section-title mt-6">选择考试题型</div>
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {allTypes.map(t => {
          const checked = enabledTypes.includes(t);
          return (
            <div key={t} onClick={() => onToggle(t)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-lg text-sm transition-all ${lockedTypes.includes(t) ? '' : 'cursor-pointer'}`}
              style={{ borderColor: checked ? 'var(--fox)' : 'var(--ink-100)', background: checked ? 'var(--fox-glow)' : 'transparent', opacity: lockedTypes.includes(t) ? 1 : undefined }}>
              <span className="w-4 h-4 rounded border flex items-center justify-center text-[7px] transition-all flex-shrink-0"
                style={{ borderColor: checked ? 'var(--fox)' : 'var(--ink-100)', background: checked ? 'var(--fox)' : 'transparent', color: checked ? '#fff' : 'transparent' }}>✓</span>
              <span>{typeNames[t]}</span>
              {lockedTypes.includes(t) && (
                <span className="text-[var(--fox)] text-[10px] ml-auto whitespace-nowrap flex-shrink-0">📌 含必选题</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 题型参数 */}
      {enabledTypes.map(t => (
        <div key={t} className="border border-[var(--ink-100)] rounded-lg mb-2 overflow-hidden">
          <div className="bg-[var(--paper)] flex items-center justify-between px-4 py-2.5">
            <span className="text-[var(--ink-700)] text-sm font-medium">{typeNames[t]}</span>
            <span className="text-[var(--ink-400)] text-xs">小计 {subtotal(t)} 分</span>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_60px] gap-3 p-4 border-t border-[var(--ink-100)]">
            <div>
              <label className="text-[var(--ink-400)] block text-xs mb-0.5">
                题数
                {lockedCounts[t] > 0 && <span className="text-[var(--fox)] ml-1 text-[10px]">（最低 {lockedCounts[t]} 题）</span>}
              </label>
              <input value={String(typeConfigs[t]?.count ?? 0)}
                onChange={e => onConfigChange(t, 'count', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                className="input" inputMode="numeric"
                style={lockedCounts[t] > 0 && (typeConfigs[t]?.count || 0) < lockedCounts[t] ? { borderColor: 'var(--verm)' } : {}} />
            </div>
            <div>
              <label className="text-[var(--ink-400)] block text-xs mb-0.5">{t === 'FILL_BLANK' ? '每空分值' : '每题分值'}</label>
              <input value={String(typeConfigs[t]?.score ?? 0)}
                onChange={e => onConfigChange(t, 'score', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)} className="input" inputMode="numeric" />
            </div>
            {t === 'FILL_BLANK' && (
              <div>
                <label className="text-[var(--ink-400)] block text-xs mb-0.5">每空数</label>
                <input value={String(typeConfigs[t]?.blanksPerQ ?? 1)}
                  onChange={e => onConfigChange(t, 'blanksPerQ', parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)} className="input" inputMode="numeric" />
              </div>
            )}
            <div className="flex items-end pb-1.5">
              <span className="text-[var(--ink-300)] text-xs">{t === 'FILL_BLANK' ? '题×空×分' : '题×分'}</span>
            </div>
          </div>
        </div>
      ))}

      {/* 分值校验 */}
      <div className="mb-4">
        {!scoreValid ? (
          <div className="px-4 py-2.5 rounded-lg text-sm bg-[var(--verm-glow)] text-[var(--verm)]">
            ⚠ 题型总分 {totalFromTypes} 分 ≠ 试卷总分 {totalScore} 分
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-lg text-sm bg-[var(--cyan-glow)] text-[var(--cyan)]">
            ✓ 题型总分 {totalFromTypes} 分 = 试卷总分 {totalScore} 分
          </div>
        )}
      </div>
    </>
  );
}
