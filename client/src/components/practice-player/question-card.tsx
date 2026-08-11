'use client';

import RichAnswerEditor from '@/components/RichAnswerEditor';
import { TYPE_LABELS, DIFF_LABELS } from './practice-constants';
import type { PracticeResult } from './practice-constants';

export function QuestionCard({ current, mode, submitted, result, submitting, answers, setAnswers, isFavorite, isFirst, isLast, onToggleFavorite, onSelect, onSubmit, onPrev, onNext, onSkip }: {
  current: any;
  mode: 'practice' | 'browse';
  submitted: boolean;
  result: PracticeResult | undefined;
  submitting: boolean;
  answers: Record<number, any>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, any>>>;
  isFavorite: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleFavorite: (questionId: number) => void;
  onSelect: (questionId: number, value: any) => void;
  onSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="tag tag-fox text-xs">{TYPE_LABELS[current.type] || current.type}</span>
        {current.difficulty && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-400)]">
            {DIFF_LABELS[current.difficulty] || current.difficulty}
          </span>
        )}
        <span className="text-xs flex-1 text-[var(--ink-300)]">
          {current.subject?.name || ''}{current.chapter?.name ? ` · ${current.chapter.name}` : ''}
        </span>
        <button onClick={() => onToggleFavorite(current.id)}
          className="text-lg bg-transparent border-none cursor-pointer transition-transform hover:scale-110"
          title={isFavorite ? '取消收藏' : '收藏本题'}>
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      {current.type !== 'FILL_BLANK' && (
        <div className="text-sm leading-relaxed mb-5 text-[var(--ink-800)]">
          {current.content}
        </div>
      )}

      {/* Single Choice & True/False */}
      {(current.type === 'SINGLE_CHOICE' || current.type === 'TRUE_FALSE') && current.options?.map((o: any) => {
        const isSelected = answers[current.id] === o.label;
        const showResult = mode === 'browse' || submitted;
        return (
          <label key={o.id}
            className={`
              flex items-center gap-3 p-3 rounded-lg mb-2 transition-all
              ${showResult ? '' : 'cursor-pointer'}
              ${isSelected && mode === 'practice' ? 'bg-[var(--fox-glow)] border border-[var(--fox)]' : 'bg-[var(--paper)] border border-transparent'}
              ${showResult && o.isCorrect ? 'bg-[var(--cyan-glow)] border border-[var(--cyan)] ring-1 ring-[var(--cyan)]' : ''}
            `}
            onClick={() => mode === 'practice' && !submitted && onSelect(current.id, o.label)}>
            <input type="radio" name={`q-${current.id}`} checked={isSelected}
              onChange={() => mode === 'practice' && !submitted && onSelect(current.id, o.label)}
              disabled={showResult} className="accent-[var(--fox)]" />
            <span className="text-sm"><b>{o.label}.</b> {o.content}</span>
            {showResult && o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--cyan)]">✓ 正确答案</span>}
            {showResult && isSelected && !o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--verm)]">✗</span>}
          </label>
        );
      })}

      {/* Multiple Choice */}
      {current.type === 'MULTIPLE_CHOICE' && current.options?.map((o: any) => {
        const selected: string[] = answers[current.id] || [];
        const checked = selected.includes(o.label);
        const showResult = mode === 'browse' || submitted;
        return (
          <label key={o.id}
            className={`
              flex items-center gap-3 p-3 rounded-lg mb-2 transition-all
              ${showResult ? '' : 'cursor-pointer'}
              ${checked && mode === 'practice' ? 'bg-[var(--fox-glow)] border border-[var(--fox)]' : 'bg-[var(--paper)] border border-transparent'}
              ${showResult && o.isCorrect ? 'bg-[var(--cyan-glow)] border border-[var(--cyan)] ring-1 ring-[var(--cyan)]' : ''}
            `}>
            <input type="checkbox" checked={checked}
              onChange={() => {
                if (showResult || mode !== 'practice') return;
                const newSel = checked ? selected.filter((s: string) => s !== o.label) : [...selected, o.label];
                setAnswers(prev => ({ ...prev, [current.id]: newSel }));
              }}
              disabled={showResult} className="accent-[var(--fox)]" />
            <span className="text-sm"><b>{o.label}.</b> {o.content}</span>
            {showResult && o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--cyan)]">✓</span>}
            {showResult && checked && !o.isCorrect && <span className="ml-auto text-xs font-bold text-[var(--verm)]">✗</span>}
          </label>
        );
      })}

      {/* Multi-choice confirm button */}
      {current.type === 'MULTIPLE_CHOICE' && mode === 'practice' && !submitted && (
        <div className="flex justify-end mt-3">
          <button onClick={onSubmit} disabled={!answers[current.id]?.length || submitting}
            className="btn btn-fox btn-xs">
            {submitting ? '提交中…' : '确定作答'}
          </button>
        </div>
      )}

      {/* FILL_BLANK — 题干内嵌逐空输入框 */}
      {current.type === 'FILL_BLANK' && (
        <div className="text-sm leading-9 text-[var(--ink-800)] mb-2">
          {current.content.split(/\{\{_\}\}/).map((part: string, i: number, arr: string[]) => {
            const blankAns = (answers[current.id] || [])[i] || '';
            const blankCorrect = submitted && current.blanks?.[i] != null &&
              String(blankAns).trim().toLowerCase() === String(current.blanks[i].answer || '').trim().toLowerCase();
            const blankWrong = submitted && !blankCorrect;
            return (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <input
                    type="text"
                    value={blankAns}
                    onChange={e => {
                      const blanks = [...(answers[current.id] || [])];
                      blanks[i] = e.target.value;
                      setAnswers(prev => ({ ...prev, [current.id]: blanks }));
                    }}
                    disabled={submitted || mode !== 'practice'}
                    className={`inline-block mx-1 px-2 py-0.5 text-center text-sm border-b-2 outline-none w-[130px] transition-colors ${
                      blankCorrect ? 'border-[var(--sage)] bg-[var(--sage-glow)] text-[var(--sage)] font-medium'
                        : blankWrong ? 'border-[var(--verm)] bg-[var(--verm-glow)] text-[var(--verm)]'
                        : 'border-[var(--fox)] bg-[var(--paper-bright)] focus:border-[var(--fox-dark)]'
                    }`}
                    placeholder={`第${i + 1}空`}
                  />
                )}
              </span>
            );
          })}
          {!submitted && mode === 'practice' && (
            <div className="flex justify-end mt-3">
              <button onClick={onSubmit}
                disabled={!(answers[current.id] || []).some((a: string) => a && a.trim()) || submitting}
                className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
            </div>
          )}
        </div>
      )}

      {/* SHORT_ANSWER — 富文本编辑器 */}
      {(current.type === 'SHORT_ANSWER' || current.type === 'ESSAY') && !submitted && mode === 'practice' && (
        <div>
          <RichAnswerEditor
            value={answers[current.id] || ''}
            onChange={html => setAnswers(prev => ({ ...prev, [current.id]: html }))}
            maxChars={2000}
            placeholder="请输入你的答案…"
          />
          <div className="flex justify-end mt-3">
            <button onClick={onSubmit}
              disabled={!answers[current.id] || !String(answers[current.id]).replace(/<[^>]*>/g, '').trim() || submitting}
              className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
          </div>
        </div>
      )}

      {/* CASE_STUDY — 按子问题逐题作答 */}
      {current.type === 'CASE_STUDY' && !submitted && mode === 'practice' && (
        <div className="space-y-4">
          {(current.subQuestions?.length ? current.subQuestions : [null]).map((sq: any, i: number) => (
            <div key={sq?.id ?? i}>
              {sq && (
                <div className="text-sm font-medium mb-2 pl-3 border-l-[3px] border-[var(--fox)] text-[var(--ink-600)]">
                  ({i + 1}) {sq.content}
                </div>
              )}
              <RichAnswerEditor
                value={(answers[current.id] || [])[i] || ''}
                onChange={html => {
                  const arr = [...(answers[current.id] || [])];
                  arr[i] = html;
                  setAnswers(prev => ({ ...prev, [current.id]: arr }));
                }}
                maxChars={2000}
                placeholder="请输入答案…"
              />
            </div>
          ))}
          <div className="flex justify-end mt-3">
            <button onClick={onSubmit}
              disabled={!(answers[current.id] || []).some((a: string) => a && String(a).replace(/<[^>]*>/g, '').trim()) || submitting}
              className="btn btn-fox btn-xs">{submitting ? '提交中…' : '提交答案'}</button>
          </div>
        </div>
      )}

      {/* Browse mode - show answer */}
      {mode === 'browse' && (
        <div className="mt-4 p-4 rounded-lg text-sm bg-[var(--fox-glow)] border border-[var(--ink-100)]">
          <p className="font-bold mb-1 text-[var(--fox-dark)]">📖 背题模式</p>
          {/* 选择题：显示正确选项 */}
          {current.options?.filter((o: any) => o.isCorrect).length > 0 && (
            current.options.filter((o: any) => o.isCorrect).map((o: any) => (
              <p key={o.id} className="text-sm text-[var(--ink-600)]">
                正确答案：<strong className="text-[var(--cyan)]">{o.label}. {o.content}</strong>
              </p>
            ))
          )}
          {/* 非选择题：显示参考答案（支持富文本） */}
          {(!current.options || current.options.filter((o: any) => o.isCorrect).length === 0) && current.correctAnswer && (
            <div className="text-sm text-[var(--ink-600)]">
              <span className="font-medium">参考答案：</span>
              <div className="mt-1 text-[var(--cyan)] leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                dangerouslySetInnerHTML={{ __html: String(current.correctAnswer).startsWith('<') ? current.correctAnswer : `<p>${current.correctAnswer}</p>` }} />
            </div>
          )}
          {current.analysis && (
            <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
              <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
              <p className="text-xs text-[var(--ink-600)]">{current.analysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Result feedback — 客观题 */}
      {submitted && result && !result.subjective && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${result.isCorrect ? 'bg-[var(--sage-glow)] border border-[var(--sage)]' : 'bg-[var(--verm-glow)] border border-[var(--verm)]'}`}>
          <p className={`font-bold mb-2 ${result.isCorrect ? 'text-[var(--sage)]' : 'text-red-700'}`}>
            {result.isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
          </p>
          {!result.isCorrect && (
            <p className="mb-1 text-[var(--ink-600)]">
              正确答案：<strong className="text-[var(--cyan)]">{result.correctAnswer}</strong>
            </p>
          )}
          {result.analysis && (
            <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
              <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
              <p className="text-xs text-[var(--ink-600)]">{result.analysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Result feedback — 主观题(自评模式：展示参考答案，不判对错) */}
      {submitted && result && result.subjective && (
        <div className="mt-4 p-4 rounded-lg text-sm bg-[var(--fox-glow)] border border-[var(--fox)]">
          <p className="font-bold mb-2 text-[var(--fox-dark)]">📝 参考答案（请自行对照评判）</p>
          {result.correctAnswer && (
            <div className="mb-2 text-[var(--ink-700)] leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
              dangerouslySetInnerHTML={{ __html: typeof result.correctAnswer === 'string' && result.correctAnswer.startsWith('<') ? result.correctAnswer : `<p>${typeof result.correctAnswer === 'string' ? result.correctAnswer : JSON.stringify(result.correctAnswer, null, 2)}</p>` }} />
          )}
          {result.analysis && (
            <div className="mt-2 pt-2 border-t border-dashed border-[var(--ink-100)]">
              <p className="text-xs font-medium mb-1 text-[var(--ink-500)]">解析：</p>
              <p className="text-xs text-[var(--ink-600)]">{result.analysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-[var(--ink-100)]">
        <button onClick={onPrev}
          disabled={isFirst}
          className="btn text-sm px-4 py-2 border border-[var(--ink-200)] disabled:opacity-40">
          ← 上一题
        </button>
        {submitted || mode === 'browse' ? (
          <button onClick={onNext} className="btn btn-fox text-sm px-4 py-2">
            {isLast ? '查看结果' : '下一题 →'}
          </button>
        ) : (
          <button onClick={onSkip}
            className="text-xs bg-transparent border-none cursor-pointer text-[var(--ink-300)]">
            跳过本题 →
          </button>
        )}
      </div>
    </div>
  );
}
