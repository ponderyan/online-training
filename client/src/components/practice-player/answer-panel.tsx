import type { PracticeResult } from './practice-constants';

export function AnswerPanel({ questions, results, currentIdx, onJump }: {
  questions: any[];
  results: Record<number, PracticeResult>;
  currentIdx: number;
  onJump: (idx: number) => void;
}) {
  return (
    <aside className="w-[180px] flex-shrink-0 hidden lg:block">
      <div className="sticky top-24 bg-[var(--paper-bright)] rounded-xl border border-[var(--ink-100)] p-4">
        <div className="text-xs font-medium mb-3 text-[var(--ink-500)]">答题卡</div>
        <div className="grid grid-cols-6 gap-1.5 mb-2">
          {questions.map((q: any, i: number) => {
            const isCurrent = i === currentIdx;
            const isShown = results[q.id] !== undefined;
            const isCorrect = results[q.id]?.isCorrect;
            const isSubjective = results[q.id]?.subjective;
            return (
              <button key={q.id} onClick={() => onJump(i)}
                className={`
                  w-6 h-6 rounded text-[11px] font-medium border-none cursor-pointer
                  ${isCurrent ? 'bg-[var(--fox)] text-white' : ''}
                  ${!isCurrent && isShown && isSubjective ? 'bg-[var(--gold)] text-white' : ''}
                  ${!isCurrent && isShown && !isSubjective && isCorrect ? 'bg-[var(--cyan)] text-white' : ''}
                  ${!isCurrent && isShown && !isSubjective && !isCorrect ? 'bg-[var(--verm)] text-white' : ''}
                  ${!isCurrent && !isShown ? 'bg-[var(--paper)] text-[var(--ink-300)]' : ''}
                `}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] space-y-0.5 text-[var(--ink-400)]">
          <div>✓ 正确：{Object.values(results).filter(r => r && !r.subjective && r.isCorrect).length}</div>
          <div>✗ 错误：{Object.values(results).filter(r => r && !r.subjective && !r.isCorrect).length}</div>
          <div>✎ 自评：{Object.values(results).filter(r => r?.subjective).length}</div>
          <div>— 未答：{questions.length - Object.keys(results).length}</div>
          <div className="mt-2 pt-1 border-t border-[var(--ink-100)]">共 {questions.length} 题</div>
        </div>
      </div>
    </aside>
  );
}
