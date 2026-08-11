'use client';

// 动态题型编辑区：选择/判断/填空/简答/论文（含评分标准）/案例 各自的录入表单
export default function QuestionBodyEditor({
  type, options, setOptions, correctAnswer, setCorrectAnswer, correctAnswers, setCorrectAnswers,
  blanks, setBlanks, analysis, setAnalysis, minAnswerWords, setMinAnswerWords,
  rubricItems, setRubricItems, subQuestions, setSubQuestions,
}: {
  type: string;
  options: string[];
  setOptions: React.Dispatch<React.SetStateAction<string[]>>;
  correctAnswer: string;
  setCorrectAnswer: (v: string) => void;
  correctAnswers: string[];
  setCorrectAnswers: React.Dispatch<React.SetStateAction<string[]>>;
  blanks: string[];
  setBlanks: React.Dispatch<React.SetStateAction<string[]>>;
  analysis: string;
  setAnalysis: (v: string) => void;
  minAnswerWords: string;
  setMinAnswerWords: (v: string) => void;
  rubricItems: { description: string; points: number; type: 'add' | 'deduct' }[];
  setRubricItems: React.Dispatch<React.SetStateAction<{ description: string; points: number; type: 'add' | 'deduct' }[]>>;
  subQuestions: { content: string; answer: string }[];
  setSubQuestions: React.Dispatch<React.SetStateAction<{ content: string; answer: string }[]>>;
}) {
  return (
    <>
      {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            {options.map((o, i) => (
              <div key={i}>
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">选项 {String.fromCharCode(65 + i)}</label>
                <input value={o} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                  className="input" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">正确答案</label>
            {type === 'SINGLE_CHOICE' ? (
              <select value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} className="input select" style={{ width: '120px' }}>
                {options.map((_, i) => <option key={i} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)}</option>)}
              </select>
            ) : (
              <div className="flex gap-4">
                {options.map((_, i) => (
                  <label key={i} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={correctAnswers.includes(String.fromCharCode(65 + i))}
                      onChange={e => {
                        const c = String.fromCharCode(65 + i);
                        setCorrectAnswers(e.target.checked ? [...correctAnswers, c] : correctAnswers.filter(x => x !== c));
                      }} />
                    {String.fromCharCode(65 + i)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {type === 'TRUE_FALSE' && (
        <div className="mb-4">
          <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">正确答案</label>
          <select value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} className="input select" style={{ width: '140px' }}>
            <option value="true">✓ 正确</option>
            <option value="false">✗ 错误</option>
          </select>
        </div>
      )}

      {type === 'FILL_BLANK' && (
        <div className="space-y-2 mb-4">
          {blanks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="text-[var(--ink-500)] text-xs font-medium whitespace-nowrap">填空 {i + 1}</label>
              <input value={b} onChange={e => { const n = [...blanks]; n[i] = e.target.value; setBlanks(n); }}
                className="input" />
              <button onClick={() => setBlanks(blanks.filter((_, j) => j !== i))}
                className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>✕</button>
            </div>
          ))}
          <button onClick={() => setBlanks([...blanks, ''])}
            className="text-xs text-[var(--ink-300)]" 
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>+ 添加填空位</button>
        </div>
      )}

      {(type === 'SHORT_ANSWER' || type === 'ESSAY') && (
        <div className="mb-4">
          <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">参考答案</label>
          <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} rows={type === 'ESSAY' ? 6 : 3}
            placeholder={type === 'ESSAY' ? '论文题建议填写评分要点（论点、论据、结构等采分维度）' : undefined}
            className="input textarea" />
        </div>
      )}

      {type === 'ESSAY' && (
        <div className="mb-4 p-4 border rounded border-[var(--ink-100)] bg-[var(--paper-50)]">
          <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">作答要求</label>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[var(--ink-500)]">最低字数</span>
            <input type="number" min={0} max={20000} value={minAnswerWords}
              onChange={e => setMinAnswerWords(e.target.value)} placeholder="如 800"
              className="input w-40" />
            <span className="text-xs text-[var(--ink-300)]">交卷时硬校验，留空不限制</span>
          </div>
          <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">
            评分标准 <span className="text-[var(--ink-300)]">（可选，定稿时随卷快照，阅卷时可调整）</span>
          </label>
          <div className="space-y-2">
            {rubricItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={item.type} onChange={e => { const n = [...rubricItems]; n[i] = { ...n[i], type: e.target.value as 'add' | 'deduct' }; setRubricItems(n); }} className="input select w-20">
                  <option value="add">加分</option>
                  <option value="deduct">扣分</option>
                </select>
                <input type="number" min={1} max={100} value={item.points}
                  onChange={e => { const n = [...rubricItems]; n[i] = { ...n[i], points: parseInt(e.target.value) || 0 }; setRubricItems(n); }}
                  className="input w-20" title="分值" />
                <input placeholder="采分点描述，如：论点明确、结构完整" value={item.description}
                  onChange={e => { const n = [...rubricItems]; n[i] = { ...n[i], description: e.target.value }; setRubricItems(n); }}
                  className="input flex-1" />
                <button onClick={() => setRubricItems(rubricItems.filter((_, j) => j !== i))}
                  className="btn btn-ghost btn-xs text-[var(--ink-300)]">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => setRubricItems([...rubricItems, { description: '', points: 5, type: 'add' }])}
            className="text-xs text-[var(--ink-300)] mt-2">+ 添加采分点</button>
        </div>
      )}

      {type === 'CASE_STUDY' && (
        <div className="space-y-3 mb-4">
          {subQuestions.map((sq, i) => (
            <div key={i} className="p-4 border rounded border-[var(--ink-100)]" style={{  background: 'rgba(239, 233, 220, 0.4)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--ink-500)] text-xs font-medium">子问题 {i + 1}</span>
                {subQuestions.length > 1 && (
                  <button onClick={() => setSubQuestions(subQuestions.filter((_, j) => j !== i))}
                    className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                )}
              </div>
              <input placeholder="问题内容" value={sq.content} onChange={e => {
                const n = [...subQuestions]; n[i] = { ...n[i], content: e.target.value }; setSubQuestions(n);
              }} className="input mb-2" />
              <textarea placeholder="答案要点" value={sq.answer} onChange={e => {
                const n = [...subQuestions]; n[i] = { ...n[i], answer: e.target.value }; setSubQuestions(n);
              }} rows={2} className="input textarea" />
            </div>
          ))}
          <button onClick={() => setSubQuestions([...subQuestions, { content: '', answer: '' }])}
            className="text-xs text-[var(--ink-300)]" 
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>+ 添加子问题</button>
        </div>
      )}

      {type !== 'SHORT_ANSWER' && type !== 'ESSAY' && (
        <div className="mb-1">
          <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">
            参考解析 <span className="text-[var(--ink-300)]">（可选）</span>
          </label>
          <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} rows={2}
            className="input textarea" />
        </div>
      )}
    </>
  );
}
