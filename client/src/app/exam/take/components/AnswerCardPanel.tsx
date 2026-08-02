'use client';

interface AnswerCardPanelProps {
  questions: { pqId: number; questionId: number; type: string }[];
  answers: Record<number, any>;
  markedQuestions: Set<number>;
  currentQ: number;
  cardFilter: 'all' | 'unanswered' | 'marked';
  onFilterChange: (f: 'all' | 'unanswered' | 'marked') => void;
  onGoToQuestion: (index: number) => void;
  typeNames: Record<string, string>;
}

/**
 * 答题卡面板 — 按题型分组 + 筛选 + 进度统计
 */
export default function AnswerCardPanel({
  questions, answers, markedQuestions, currentQ,
  cardFilter, onFilterChange, onGoToQuestion, typeNames,
}: AnswerCardPanelProps) {
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const markedCount = markedQuestions.size;

  const questionTypeSummary = (() => {
    const map: Record<string, { type: string; label: string; count: number }> = {};
    questions.forEach((q) => {
      const label = typeNames[q.type] || q.type;
      if (!map[q.type]) map[q.type] = { type: q.type, label, count: 0 };
      map[q.type].count++;
    });
    return Object.values(map);
  })();

  return (
    <div className="w-[230px] flex-shrink-0 overflow-y-auto">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold font-serif text-[var(--ink-700)]">答题卡</p>
          <span className="text-[11px] text-[var(--ink-400)] tabular-nums">
            <span className="text-[var(--fox)] font-semibold">{answeredCount}</span>/{totalQuestions}
          </span>
        </div>
        {/* 筛选标签 */}
        <div className="flex gap-1 mb-3">
          {([['all', '全部'], ['unanswered', '未答'], ['marked', '标记']] as const).map(([key, label]) => (
            <button key={key} onClick={() => onFilterChange(key)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                cardFilter === key
                  ? 'bg-[var(--fox)] text-white border-[var(--fox)]'
                  : 'bg-transparent text-[var(--ink-400)] border-[var(--ink-100)] hover:border-[var(--fox)] hover:text-[var(--fox)]'
              }`}>
              {label}{key === 'unanswered' ? `${totalQuestions - answeredCount > 0 ? `(${totalQuestions - answeredCount})` : ''}` : ''}{key === 'marked' ? `${markedCount > 0 ? `(${markedCount})` : ''}` : ''}
            </button>
          ))}
        </div>
        {questionTypeSummary.map(section => {
          const sectionQuestions = questions.filter((q) => {
            if (q.type !== section.type) return false;
            if (cardFilter === 'unanswered') {
              const a = answers[q.pqId];
              return a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
            }
            if (cardFilter === 'marked') return markedQuestions.has(q.questionId);
            return true;
          });
          if (sectionQuestions.length === 0) return null;
          return (
            <div key={section.type} className="mb-4.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-[var(--ink-400)] mb-2 pb-1.5 border-b border-[var(--ink-100)]">
                <span>{section.label}</span>
                <span className="text-[var(--ink-300)]">{section.count}题</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {sectionQuestions.map((q) => {
                  const qIndex = questions.indexOf(q);
                  const isAnswered = answers[q.pqId] !== undefined && answers[q.pqId] !== '' &&
                    !(Array.isArray(answers[q.pqId]) && answers[q.pqId].length === 0);
                  const isMarked = markedQuestions.has(q.questionId);
                  const isCurrent = qIndex === currentQ;
                  return (
                    <button key={q.pqId} onClick={() => onGoToQuestion(qIndex)}
                      className={`w-8 h-8 rounded-md text-[12px] font-semibold flex items-center justify-center cursor-pointer border-[1.5px] transition-all relative ${
                        isCurrent
                          ? 'bg-[var(--fox)] border-[var(--fox)] text-white shadow-[0_2px_8px_var(--fox-glow-strong)] scale-110'
                          : isMarked && isAnswered
                            ? 'bg-[var(--sage-glow)] border-[var(--gold)] text-[var(--sage)]'
                            : isMarked
                              ? 'bg-[var(--gold-glow)] border-[var(--gold)] text-[var(--gold-dark)]'
                              : isAnswered
                                ? 'bg-[var(--sage-glow)] border-[var(--sage)] text-[var(--sage)]'
                                : 'bg-[var(--paper-bright)] border-[var(--ink-100)] text-[var(--ink-400)] hover:border-[var(--fox)] hover:text-[var(--fox)]'
                      }`}
                      title={`第${qIndex + 1}题${isAnswered ? '（已答）' : '（未答）'}${isMarked ? ' ⭐' : ''}`}>
                      {qIndex + 1}
                      {isMarked && !isCurrent && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="mt-3.5 pt-3 border-t border-[var(--ink-100)]">
          {/* 答题进度统计 */}
          <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
            <div className="py-1.5 rounded-md bg-[var(--sage-glow)]">
              <p className="text-sm font-bold font-serif text-[var(--sage)] tabular-nums leading-none">{answeredCount}</p>
              <p className="text-[9px] text-[var(--ink-400)] mt-0.5">已答</p>
            </div>
            <div className="py-1.5 rounded-md bg-[var(--paper-dark)]">
              <p className="text-sm font-bold font-serif text-[var(--ink-500)] tabular-nums leading-none">{totalQuestions - answeredCount}</p>
              <p className="text-[9px] text-[var(--ink-400)] mt-0.5">未答</p>
            </div>
            <div className="py-1.5 rounded-md bg-[var(--gold-glow)]">
              <p className="text-sm font-bold font-serif text-[var(--gold-dark)] tabular-nums leading-none">{markedCount}</p>
              <p className="text-[9px] text-[var(--ink-400)] mt-0.5">标记</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 gap-x-3 text-[10px] text-[var(--ink-400)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--fox)] border-[var(--fox)]" /> 当前
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--sage-glow)] border-[var(--sage)]" /> 已答
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--gold-glow)] border-[var(--gold)]" /> 标记
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border-[1.5px] bg-[var(--paper-bright)] border-[var(--ink-100)]" /> 未答
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
