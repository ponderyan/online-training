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
}

export default function QuestionContent({ question, currentAnswer, onAnswer, isMarked, onToggleMark }: Props) {
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
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-base leading-8 transition-all duration-150 border-2 cursor-pointer ${
                sel ? 'border-orange-600 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 transition-all ${
                sel ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{opt.label}</span>
              <span className="flex-1">{opt.content}</span>
              {sel && <span className="text-orange-600 text-lg">✓</span>}
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
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 text-sm font-bold">
            {question.pqId}
          </span>
          <span className="text-sm font-medium text-gray-500">
            第 ? 题 · {question.score}分
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-medium">
            {question.type === 'SINGLE_CHOICE' ? '单选题' :
             question.type === 'MULTIPLE_CHOICE' ? '多选题' :
             question.type === 'TRUE_FALSE' ? '判断题' :
             question.type === 'FILL_BLANK' ? '填空题' :
             question.type === 'SHORT_ANSWER' ? '简答题' :
             question.type === 'CASE_STUDY' ? '案例题' : question.type}
          </span>
        </div>
        <button onClick={() => onToggleMark(question.questionId)}
          className={`text-xs px-3 py-1 rounded-md border cursor-pointer transition-colors ${
            isMarked ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
          }`}>
          {isMarked ? '⭐ 已标记' : '标记此题'}
        </button>
      </div>

      {/* 题干 — 20px 居中 */}
      <div className="text-xl leading-relaxed text-center mb-8 text-gray-800">
        {question.content}
      </div>

      {/* 选项/答案区域 */}
      {question.type === 'SINGLE_CHOICE' && renderOptions('SINGLE_CHOICE')}
      {question.type === 'MULTIPLE_CHOICE' && renderOptions('MULTIPLE_CHOICE')}

      {question.type === 'TRUE_FALSE' && (
        <div className="flex gap-4">
          {['对', '错'].map(val => (
            <button key={val} onClick={() => onAnswer(question.pqId, val)}
              className={`flex-1 py-8 rounded-xl text-lg font-medium transition-all border-2 cursor-pointer ${
                currentAnswer === val ? 'bg-orange-50 border-orange-600 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {val}
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
                  className="inline-block mx-1 px-2 border-b-2 text-center outline-none"
                  style={{ borderColor: '#ea580c', width: 120, background: 'transparent' }}
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
              <p className="text-sm font-medium mb-2 text-gray-600">
                ({i + 1}) {sq.content}
              </p>
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
