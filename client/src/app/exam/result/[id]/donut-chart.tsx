export function DonutChart({ correct, wrong, pending }: { correct: number; wrong: number; pending: number }) {
  const total = correct + wrong + pending;
  if (total === 0) return null;
  const c = (correct / total) * 100;
  const w = (wrong / total) * 100;
  const p = (pending / total) * 100;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        {/* Background */}
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--ink-50)" strokeWidth="2.5" />
        {/* Correct */}
        {correct > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--sage)" strokeWidth="2.5"
            strokeDasharray={`${c} ${100 - c}`}
            strokeDashoffset="0"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {/* Wrong */}
        {wrong > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--verm)" strokeWidth="2.5"
            strokeDasharray={`${w} ${100 - w}`}
            strokeDashoffset={String(-c)}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--ink-700)]">{total}</span>
        <span className="text-[9px] text-[var(--ink-300)]">总题数</span>
      </div>
    </div>
  );
}
