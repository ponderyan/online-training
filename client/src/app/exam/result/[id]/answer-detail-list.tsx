'use client';

import { useState } from 'react';
import type { AnswerDetail, KpInfo } from './result-constants';
import { TYPE_NAMES, formatAnswer, formatCorrect } from './result-constants';

export function AnswerDetailList({ answers, questionKps }: {
  answers: AnswerDetail[];
  questionKps?: Record<number, KpInfo[]>;
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden card">
      <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--ink-100)]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-[var(--ink-700)]">逐题解析</span>
          <div className="flex gap-1">
            {answers.map((a, i) => (
              <span key={i} className="w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-medium" style={{
                background: a.isCorrect === true ? 'var(--sage-glow)' : a.isCorrect === false ? 'var(--verm-glow)' : 'var(--gold-glow)',
                color: a.isCorrect === true ? 'var(--sage)' : a.isCorrect === false ? 'var(--verm)' : 'var(--gold)',
              }}>{i + 1}</span>
            ))}
          </div>
        </div>
        <button onClick={() => setShowAll(!showAll)}
          className="text-xs px-3 py-1.5 rounded-md border-none cursor-pointer font-medium bg-[var(--paper-dark)] text-[var(--ink-500)]">
          {showAll ? '收起部分' : '展开全部'}
        </button>
      </div>

      <div className="divide-y border-[var(--ink-100)]">
        {answers.map((a, i) => {
          const visible = showAll || a.isCorrect === false || a.isCorrect === null;
          if (!visible) return null;

          return (
            <div key={a.questionId} className="p-6">
              <div className="flex items-start gap-4">
                {/* Status badge */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{
                  background: a.isCorrect === true ? 'var(--sage-glow)' : a.isCorrect === false ? 'var(--verm-glow)' : 'var(--gold-glow)',
                }}>
                  {a.isCorrect === true ? '✅' : a.isCorrect === false ? '❌' : '⏳'}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Question header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-500)]" >
                      #{i + 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--fox-glow)] text-[var(--fox)]" >
                      {TYPE_NAMES[a.questionType] || a.questionType}
                    </span>
                    {questionKps?.[a.questionId]?.map(kp => (
                      <span key={kp.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--fox-glow)] text-[var(--fox-dark)]"
                        >
                        {kp.code || kp.name}
                      </span>
                    ))}
                    {a.score !== null && (
                      <span className="text-[10px] text-[var(--ink-300)]">
                        得分：{a.score}
                      </span>
                    )}
                  </div>

                  {/* Question content */}
                  <p className="text-sm mb-4 leading-relaxed text-[var(--ink-700)]">{a.questionContent}</p>

                  {/* Options display */}
                  {a.options?.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {a.options.map((o: any) => {
                        const isUserAnswer = String(a.yourAnswer) === o.label ||
                          (Array.isArray(a.yourAnswer) && a.yourAnswer.includes(o.label));
                        const isCorrectOption = String(a.correctAnswer) === o.label ||
                          (Array.isArray(a.correctAnswer) && a.correctAnswer.includes(o.label));
                        let bg = 'transparent';
                        let border = '1px solid transparent';
                        if (isUserAnswer && isCorrectOption && a.isCorrect === true) { bg = 'var(--sage-glow)'; border = '1px solid var(--green)'; }
                        else if (isUserAnswer && !isCorrectOption) { bg = 'var(--verm-glow)'; border = '1px solid var(--verm)'; }
                        else if (!isUserAnswer && isCorrectOption && a.isCorrect === false) { bg = 'var(--sage-glow)'; border = '1px solid var(--green)'; }

                        return (
                          <div key={o.label} className="p-2.5 rounded-lg text-xs flex items-center gap-2"
                            style={{ background: bg, border }}>
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-medium flex-shrink-0 text-[10px]"
                              style={{ background: isUserAnswer ? 'var(--fox)' : 'var(--ink-50)', color: isUserAnswer ? 'white' : 'var(--ink-400)' }}>
                              {o.label}
                            </span>
                            <span style={{ color: isUserAnswer ? 'var(--ink-700)' : 'var(--ink-500)' }}>{o.content}</span>
                            {isUserAnswer && <span className="text-[9px] text-[var(--ink-300)]">你的选择</span>}
                            {!isUserAnswer && isCorrectOption && a.isCorrect === false && (
                              <span className="text-[var(--sage)] text-[9px]">正确答案</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Answers */}
                  <div className="text-xs space-y-1 mb-3 text-[var(--ink-500)]">
                    {a.yourAnswer !== null && (
                      <p>
                        <span className="font-medium">你的答案：</span>
                        <span style={{ color: a.isCorrect === true ? 'var(--sage)' : a.isCorrect === false ? 'var(--verm)' : 'var(--ink-500)' }}>
                          {formatAnswer(a)}
                        </span>
                      </p>
                    )}
                    {a.correctAnswer && a.isCorrect === false && (
                      <p>
                        <span className="font-medium">正确答案：</span>
                        <span className="text-[var(--sage)]">{formatCorrect(a)}</span>
                      </p>
                    )}
                    {a.graderNote && (
                      <p className="bg-[var(--paper)] mt-1 p-2 rounded">
                        <span className="font-medium">评语：</span>{a.graderNote}
                      </p>
                    )}
                  </div>

                  {/* Analysis */}
                  {a.analysis && (
                    <details className="group">
                      <summary className="text-[var(--fox)] text-xs cursor-pointer inline-flex items-center gap-1 font-medium">
                        <span className="transition-transform group-open:rotate-90">▶</span> 查看解析
                      </summary>
                      <div className="mt-2 p-3 rounded-lg text-xs bg-[var(--paper-alt)] text-[var(--ink-500)]" style={{  border: '1px solid var(--ink-100)',  }}>
                        {a.analysis}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
