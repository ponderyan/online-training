import { TYPE_LABELS } from './practice-constants';
import type { PracticeResult } from './practice-constants';

const fmtTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`;

export function PracticeSummary({ questions, results, questionTimes, onReview, onRestart }: {
  questions: any[];
  results: Record<number, PracticeResult>;
  questionTimes: Record<number, number>;
  onReview: (idx: number) => void;
  onRestart: () => void;
}) {
  const allResults = Object.values(results);
  const objectiveResults = allResults.filter(r => r && !r.subjective);
  const correctCount = objectiveResults.filter(r => r?.isCorrect).length;
  const wrongCount = objectiveResults.filter(r => r && !r.isCorrect).length;
  const subjectiveCount = allResults.filter(r => r?.subjective).length;
  const accuracy = objectiveResults.length > 0 ? Math.round((correctCount / objectiveResults.length) * 100) : 0;
  const totalTime = Object.values(questionTimes).reduce((a, b) => a + b, 0);
  const answeredCount = Object.keys(results).length;
  const avgTime = answeredCount > 0 ? Math.round(totalTime / answeredCount) : 0;
  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold mb-4">🎉 练习完成</h2>
        <p className="mb-2">共 <strong>{questions.length}</strong> 题 · 已答 <strong>{answeredCount}</strong> 题</p>
        <p className="text-sm text-[var(--ink-500)]">
          正确 <strong className="text-[var(--cyan)]">{correctCount}</strong> · 错误 <strong className="text-[var(--verm)]">{wrongCount}</strong>
          {subjectiveCount > 0 && <> · 自评 <strong className="text-[var(--gold)]">{subjectiveCount}</strong></>}
          {objectiveResults.length > 0 && <> · 客观题正确率 <strong>{accuracy}%</strong></>}
        </p>
        <p className="text-xs text-[var(--ink-400)] mt-2">
          总用时 {fmtTime(totalTime)} · 平均每题 {fmtTime(avgTime)}
        </p>
      </div>

      {/* 逐题回顾 */}
      <div className="card p-4 mb-6">
        <h3 className="text-sm font-bold mb-3 text-[var(--ink-600)]">📋 逐题回顾</h3>
        <div className="space-y-1.5">
          {questions.map((q: any, i: number) => {
            const r = results[q.id];
            const t = questionTimes[q.id] || 0;
            return (
              <button key={q.id} onClick={() => onReview(i)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-[var(--paper)] transition-colors border-none bg-transparent cursor-pointer">
                <span className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: !r ? 'var(--ink-200)' : r.subjective ? 'var(--warning)' : r.isCorrect ? 'var(--cyan)' : 'var(--verm)' }}>
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--ink-400)] w-14 flex-shrink-0">{TYPE_LABELS[q.type] || q.type}</span>
                <span className="flex-1 text-xs text-[var(--ink-500)] truncate">{q.content?.replace(/<[^>]*>/g, '').slice(0, 30)}</span>
                <span className="text-xs flex-shrink-0" style={{ color: !r ? 'var(--ink-300)' : r.subjective ? 'var(--warning)' : r.isCorrect ? 'var(--cyan)' : 'var(--verm)' }}>
                  {!r ? '未答' : r.subjective ? '自评' : r.isCorrect ? '✓' : '✗'}
                </span>
                <span className="text-[10px] text-[var(--ink-300)] w-12 text-right flex-shrink-0">{t > 0 ? fmtTime(t) : '-'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button onClick={onRestart} className="btn btn-fox">再练一次</button>
      </div>
    </div>
  );
}
