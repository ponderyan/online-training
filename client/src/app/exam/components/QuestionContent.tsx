'use client';

import RichAnswerEditor from './RichAnswerEditor';

interface QuestionData {
  pqId: number;
  questionId: number;
  type: string;
  content: string;
  score: number;
  options: { id: number; label: string; content: string }[];
  blanks: { id: number; blankIndex: number; answer: string }[];
  subQuestions: { id: number; content: string; score: number | null }[];
  yourAnswer: any;
}

interface Props {
  question: QuestionData;
  currentAnswer: any;
  onAnswer: (pqId: number, value: any) => void;
  isMarked: boolean;
  onToggleMark: (questionId: number) => void;
  questionNumber: number;
}

export default function QuestionContent({ question, currentAnswer, onAnswer, isMarked, onToggleMark, questionNumber }: Props) {
  const renderOptions = (type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE') => {
    const selected: string[] = type === 'MULTIPLE_CHOICE' ? (currentAnswer || []) : [];
    const isSelected = (label: string) => type === 'SINGLE_CHOICE' ? currentAnswer === label : selected.includes(label);

    return (
      <div className="flex flex-col gap-2 mt-3">
        {question.options?.map(opt => {
          const sel = isSelected(opt.label);
          return (
            <button key={opt.id} onClick={() => {
              if (type === 'SINGLE_CHOICE') onAnswer(question.pqId, opt.label);
              else {
                const newSel = sel ? selected.filter((s: string) => s !== opt.label) : [...selected, opt.label];
                onAnswer(question.pqId, newSel);
              }
            }}
              className={`flex items-center gap-3.5 w-full px-4 py-3.5 rounded-lg text-left text-[15px] leading-relaxed transition-all duration-150 border-2 cursor-pointer ${
                sel
                  ? 'border-[var(--fox)] bg-[var(--fox-glow)] text-[var(--ink-800)]'
                  : 'border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-700)] hover:border-[var(--fox-light)] hover:bg-[var(--fox-glow)]'
              }`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[13px] flex-shrink-0 transition-all ${
                sel ? 'bg-[var(--fox)] text-white' : 'bg-[var(--paper-dark)] text-[var(--ink-400)]'
              }`}>{opt.label}</span>
              <span className="flex-1">{opt.content}</span>
              {sel && <span className="text-[var(--fox)] text-lg font-bold">✓</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {/* 题目标题行 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold font-serif text-white bg-[var(--fox)] shadow-[0_2px_8px_var(--fox-glow-strong)]">
            {questionNumber}
          </span>
          <span className="text-sm text-[var(--ink-500)]">
            第 {questionNumber} 题 · <span className="font-semibold text-[var(--ink-700)]">{question.score}分</span>
          </span>
          <span className="text-xs px-2.5 py-1 rounded font-medium bg-[var(--fox-glow)] text-[var(--fox-dark)]">
            {question.type === 'SINGLE_CHOICE' ? '单选题' :
             question.type === 'MULTIPLE_CHOICE' ? '多选题' :
             question.type === 'TRUE_FALSE' ? '判断题' :
             question.type === 'FILL_BLANK' ? '填空题' :
             question.type === 'SHORT_ANSWER' ? '简答题' :
             question.type === 'CASE_STUDY' ? '案例题' : question.type}
          </span>
        </div>
        <button onClick={() => onToggleMark(question.questionId)}
          className={`text-xs px-3 py-1.5 rounded-md border-[1.5px] cursor-pointer transition-all font-medium ${
            isMarked
              ? 'bg-[var(--gold-glow)] border-[var(--gold)] text-[var(--gold-dark)]'
              : 'bg-[var(--paper-bright)] border-[var(--ink-100)] text-[var(--ink-400)] hover:border-[var(--gold)] hover:text-[var(--gold-dark)]'
          }`}>
          {isMarked ? '⭐ 已标记' : '标记此题'}
        </button>
      </div>

      {/* 题干 — 居中 */}
      <div className="text-lg leading-[1.9] text-center mb-7 text-[var(--ink-800)]">
        {question.content}
      </div>

      {/* 选项/答案区域 */}
      {question.type === 'SINGLE_CHOICE' && renderOptions('SINGLE_CHOICE')}
      {question.type === 'MULTIPLE_CHOICE' && renderOptions('MULTIPLE_CHOICE')}

      {question.type === 'TRUE_FALSE' && question.options && question.options.length >= 2 && (
        <div className="flex gap-4">
          {question.options.map(opt => (
            <button key={opt.id} onClick={() => onAnswer(question.pqId, opt.label)}
              className={`flex-1 py-7 rounded-lg text-base font-medium transition-all border-2 cursor-pointer ${
                currentAnswer === opt.label
                  ? 'border-[var(--fox)] bg-[var(--fox-glow)] text-[var(--fox-dark)]'
                  : 'border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-500)] hover:border-[var(--fox-light)] hover:bg-[var(--fox-glow)]'
              }`}>
              {opt.content}
            </button>
          ))}
        </div>
      )}

      {question.type === 'FILL_BLANK' && (
        <div className="text-base leading-8">
          {question.content.split(/\{\{_\}\}/).map((part, i) => (
            <span key={i}>
              {part}
              {i < question.content.split(/\{\{_\}\}/).length - 1 && (
                <input type="text"
                  value={(currentAnswer || [])[i] || ''}
                  onChange={e => {
                    const newBlanks = [...(currentAnswer || [])];
                    newBlanks[i] = e.target.value;
                    onAnswer(question.pqId, newBlanks);
                  }}
                  className="inline-block mx-1 px-2 py-1 text-center text-[15px] text-[var(--ink-800)] bg-[var(--paper-bright)] border-b-2 border-[var(--fox)] outline-none w-[140px] transition-all focus:border-[var(--fox-dark)] focus:border-b-[3px]"
                />
              )}
            </span>
          ))}
        </div>
      )}

      {question.type === 'SHORT_ANSWER' && (
        <RichAnswerEditor
          value={currentAnswer || ''}
          onChange={(html) => onAnswer(question.pqId, html)}
          maxChars={2000}
          placeholder="请输入你的答案…"
        />
      )}

      {question.type === 'CASE_STUDY' && (
        <div className="space-y-4">
          {question.subQuestions?.map((sq, i) => (
            <div key={sq.id}>
              <div className="text-sm font-medium mb-2 pl-3 border-l-[3px] border-[var(--fox)] text-[var(--ink-600)]">
                ({i + 1}) {sq.content}
              </div>
              <RichAnswerEditor
                value={(currentAnswer || [])[i] || ''}
                onChange={(html) => {
                  const arr = currentAnswer || [];
                  arr[i] = html;
                  onAnswer(question.pqId, [...arr]);
                }}
                maxChars={2000}
                placeholder="请输入答案…"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
