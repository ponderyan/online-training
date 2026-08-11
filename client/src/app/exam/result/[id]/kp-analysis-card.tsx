import type { KpAnalysisData } from './result-constants';
import { LEVEL_COLORS } from './result-constants';

export function KpAnalysisCard({ kpAnalysis, sectionRef }: {
  kpAnalysis: KpAnalysisData;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={sectionRef} className="rounded-xl p-6 mb-8 card">
      <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">📊 我的考点画像</h3>

      {/* Overall rate */}
      <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--ink-100)' }}>
        <span className="text-xs text-[var(--ink-400)]">综合掌握率</span>
        <div className="flex-1 h-2.5 rounded-full bg-[var(--ink-100)]">
          <div className="h-full rounded-full transition-all" style={{
            width: `${kpAnalysis.overallRate}%`,
            background: kpAnalysis.overallRate >= 80 ? 'var(--sage)' : kpAnalysis.overallRate >= 60 ? 'var(--gold)' : 'var(--verm)',
          }} />
        </div>
        <span className="text-sm font-bold text-[var(--ink-600)]">{kpAnalysis.overallRate}%</span>
      </div>

      {/* Individual KP bars */}
      {kpAnalysis.kpResults.map(kp => (
        <div key={kp.kpId} className="flex items-center gap-3 mb-2.5">
          <div className="w-28 text-xs font-medium truncate flex-shrink-0 text-[var(--ink-600)]"
            title={kp.kpName}>
            {kp.kpCode || kp.kpName}
          </div>
          <div className="flex-1 h-2 rounded-full bg-[var(--ink-100)]">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${kp.rate}%`,
              background: LEVEL_COLORS[kp.level] || 'var(--gold)',
            }} />
          </div>
          <div className="w-9 text-right text-xs font-medium text-[var(--ink-500)]">
            {kp.rate}%
          </div>
          <div className="w-12 text-right">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap" style={{
              background: `color-mix(in srgb, ${(LEVEL_COLORS[kp.level] || 'var(--gold)')} 10%, transparent)`,
              color: LEVEL_COLORS[kp.level] || 'var(--gold)',
            }}>
              {kp.level}
            </span>
          </div>
        </div>
      ))}

      {/* Strongest / Weakest hints */}
      <div className="mt-4 pt-3 flex items-center gap-6 text-xs" style={{ borderTop: '1px solid var(--ink-100)' }}>
        {kpAnalysis.strongest && (
          <div>
            <span className="text-[var(--ink-400)]">💪 最强：</span>
            <span className="text-[var(--sage)]" style={{  fontWeight: 600 }}>
              {kpAnalysis.strongest.kpName}
            </span>
            <span className="text-[var(--ink-300)]"> — 继续保持</span>
          </div>
        )}
        {kpAnalysis.weakest && (
          <div>
            <span className="text-[var(--ink-400)]">⚠️ 最弱：</span>
            <span className="text-[var(--verm)]" style={{  fontWeight: 600 }}>
              {kpAnalysis.weakest.kpName}
            </span>
            <span className="text-[var(--ink-300)]"> — 建议回看相关课程</span>
          </div>
        )}
      </div>
    </div>
  );
}
