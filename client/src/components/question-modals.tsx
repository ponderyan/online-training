'use client';

import { useState, useEffect } from 'react';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFF_NAMES: Record<string, string> = {
  EASY: '易', MEDIUM_EASY: '较易', MEDIUM_HARD: '较难', HARD: '难',
};

export function AddQuestionModal({ open, onClose, subjects, editQuestion }: { open: boolean; onClose: () => void; subjects: any[]; editQuestion?: any | null }) {
  const [type, setType] = useState('SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState('EASY');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || 1);
  const [chapterId, setChapterId] = useState(0);
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [blanks, setBlanks] = useState<string[]>(['']);
  const [subQuestions, setSubQuestions] = useState<{ content: string; answer: string }[]>([{ content: '', answer: '' }]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subjectId) {
      fetch(`/api/chapters?subjectId=${subjectId}`).then(r => r.json()).then(setChapters).catch(() => {});
    }
  }, [subjectId]);

  // Populate fields when editing
  useEffect(() => {
    if (!editQuestion) return;
    setType(editQuestion.type);
    setDifficulty(editQuestion.difficulty);
    setSubjectId(editQuestion.subjectId || subjects[0]?.id || 1);
    setChapterId(editQuestion.chapterId || 0);
    setContent(editQuestion.content || '');
    setAnalysis(editQuestion.analysis || '');

    if (editQuestion.type === 'SINGLE_CHOICE' || editQuestion.type === 'MULTIPLE_CHOICE') {
      const opts = editQuestion.options?.map((o: any) => o.content) || [];
      while (opts.length < 4) opts.push('');
      setOptions(opts);
      if (editQuestion.type === 'SINGLE_CHOICE') {
        const correct = editQuestion.options?.find((o: any) => o.isCorrect);
        setCorrectAnswer(correct?.label || '');
      } else {
        setCorrectAnswers(editQuestion.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label) || []);
      }
    } else {
      setOptions(['', '', '', '']);
      setCorrectAnswer('');
      setCorrectAnswers([]);
    }

    if (editQuestion.type === 'TRUE_FALSE') {
      const trueOpt = editQuestion.options?.find((o: any) => o.label === 'A');
      setCorrectAnswer(trueOpt?.isCorrect ? 'true' : 'false');
    }

    if (editQuestion.type === 'FILL_BLANK') {
      setBlanks(editQuestion.blanks?.map((b: any) => b.answer) || ['']);
    } else {
      setBlanks(['']);
    }

    if (editQuestion.type === 'CASE_STUDY') {
      setSubQuestions(editQuestion.subQuestions?.map((sq: any) => ({ content: sq.content || '', answer: sq.answer || '' })) || [{ content: '', answer: '' }]);
    } else {
      setSubQuestions([{ content: '', answer: '' }]);
    }
  }, [editQuestion]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        subjectId, chapterId: chapterId || undefined,
        type, content, difficulty, analysis: analysis || undefined,
      };

      if (type === 'SINGLE_CHOICE') {
        body.options = options.filter(o => o).map((o, i) => ({
          label: String.fromCharCode(65 + i), content: o, isCorrect: String.fromCharCode(65 + i) === correctAnswer,
        }));
      } else if (type === 'MULTIPLE_CHOICE') {
        body.options = options.filter(o => o).map((o, i) => ({
          label: String.fromCharCode(65 + i), content: o, isCorrect: correctAnswers.includes(String.fromCharCode(65 + i)),
        }));
      } else if (type === 'TRUE_FALSE') {
        body.options = [
          { label: 'A', content: '正确', isCorrect: correctAnswer === 'true' },
          { label: 'B', content: '错误', isCorrect: correctAnswer === 'false' },
        ];
      } else if (type === 'SHORT_ANSWER') {
        body.analysis = analysis || undefined;
      } else if (type === 'FILL_BLANK') {
        body.blanks = blanks.filter(b => b).map(b => ({ answer: b }));
      } else if (type === 'CASE_STUDY') {
        body.subQuestions = subQuestions.filter(s => s.content).map(s => ({ content: s.content, answer: s.answer || undefined }));
      }

      await fetch(`/api/questions/${editQuestion ? editQuestion.id : ''}`, {
        method: editQuestion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">{editQuestion ? '编辑试题' : '录入试题'}</h3>
        </div>

        <div className="modal-body">
          <div className="grid grid-cols-2 gap-4 mb-1">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>题型</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input select">
                {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>难度</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input select">
                {Object.entries(DIFF_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>科目</label>
              <select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))} className="input select">
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} ({s.name})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>章节</label>
              <select value={chapterId} onChange={e => setChapterId(Number(e.target.value))} className="input select">
                <option value={0}>不指定</option>
                {chapters.map((ch: any) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>题干</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
              className="input textarea"
              placeholder={type === 'FILL_BLANK' ? '用 {{_}} 标记填空位置' : '输入试题题干…'} />
          </div>

          {/* Dynamic question body */}
          {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                {options.map((o, i) => (
                  <div key={i}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>选项 {String.fromCharCode(65 + i)}</label>
                    <input value={o} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                      className="input" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>正确答案</label>
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>正确答案</label>
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
                  <label className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--ink-500)' }}>填空 {i + 1}</label>
                  <input value={b} onChange={e => { const n = [...blanks]; n[i] = e.target.value; setBlanks(n); }}
                    className="input" />
                  <button onClick={() => setBlanks(blanks.filter((_, j) => j !== i))}
                    className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>✕</button>
                </div>
              ))}
              <button onClick={() => setBlanks([...blanks, ''])}
                className="text-xs" style={{ color: 'var(--ink-300)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>+ 添加填空位</button>
            </div>
          )}

          {type === 'SHORT_ANSWER' && (
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>参考答案</label>
              <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} rows={3}
                className="input textarea" />
            </div>
          )}

          {type === 'CASE_STUDY' && (
            <div className="space-y-3 mb-4">
              {subQuestions.map((sq, i) => (
                <div key={i} className="p-4 border rounded" style={{ borderColor: 'var(--ink-100)', background: 'rgba(239, 233, 220, 0.4)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>子问题 {i + 1}</span>
                    {subQuestions.length > 1 && (
                      <button onClick={() => setSubQuestions(subQuestions.filter((_, j) => j !== i))}
                        className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
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
                className="text-xs" style={{ color: 'var(--ink-300)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>+ 添加子问题</button>
            </div>
          )}

          {type !== 'SHORT_ANSWER' && (
            <div className="mb-1">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                参考解析 <span style={{ color: 'var(--ink-300)' }}>（可选）</span>
              </label>
              <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} rows={2}
                className="input textarea" />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-gold btn-sm">
            {saving ? '保存中…' : editQuestion ? '保存修改' : '保存试题'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ViewQuestionModal({ open, onClose, question }: { open: boolean; onClose: () => void; question: any }) {
  const [papers, setPapers] = useState<any[]>([]);

  useEffect(() => {
    if (question && open) {
      fetch('/api/papers').then(r => r.json()).then((data: any) => {
        const items = data.items || [];
        const related = items.filter((p: any) =>
          p.questions?.some?.((q: any) => q.questionId === question.id)
        );
        setPapers(related);
      }).catch(() => {});
    }
  }, [question, open]);

  if (!open || !question) return null;

  const typeName = TYPE_NAMES[question.type] || question.type;
  const diffName = DIFF_NAMES[question.difficulty] || question.difficulty;

  const diffTag = (d: string) => {
    switch (d) {
      case 'EASY': return 'tag-cyan';
      case 'MEDIUM_EASY': return 'tag-gold';
      case 'MEDIUM_HARD': return 'tag-ink';
      case 'HARD': return 'tag-verm';
      default: return 'tag-ink';
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">试题详情</h3>
        </div>

        <div className="modal-body space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="tag tag-ink">{typeName}</span>
            <span className={`tag ${diffTag(question.difficulty)}`}>{diffName}</span>
            <span className="tag tag-gold">{question.subject?.code}</span>
          </div>

          <div className="p-4 rounded text-sm leading-relaxed" style={{ background: 'var(--paper)' }}>
            {question.content}
          </div>

          {question.options?.length > 0 && (
            <div className="space-y-1.5">
              {question.options.map((o: any) => (
                <div key={o.id} className={`px-3 py-2 rounded text-sm ${o.isCorrect ? 'border' : ''}`}
                  style={{
                    background: o.isCorrect ? 'var(--cyan-glow)' : 'transparent',
                    borderColor: o.isCorrect ? 'rgba(0, 201, 182, 0.3)' : 'transparent',
                  }}>
                  <span className="font-medium">{o.label}.</span> {o.content}
                  {o.isCorrect && <span className="ml-1" style={{ color: 'var(--cyan)' }}>✓</span>}
                </div>
              ))}
            </div>
          )}

          {question.blanks?.length > 0 && (
            <div className="space-y-1.5">
              {question.blanks.map((b: any) => (
                <div key={b.id} className="text-sm">
                  <span className="font-medium">填空 {b.blankIndex + 1}:</span> {b.answer}
                </div>
              ))}
            </div>
          )}

          {question.analysis && (
            <div>
              <span className="font-medium text-xs" style={{ color: 'var(--ink-500)' }}>解析：</span>
              <span className="text-sm" style={{ color: 'var(--ink-300)' }}>{question.analysis}</span>
            </div>
          )}

          <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>引用记录：已使用 {question.usageCount || 0} 次</span>
            {papers.length > 0 && (
              <div className="mt-2 space-y-1">
                {papers.map((p: any) => (
                  <div key={p.id} className="text-xs" style={{ color: 'var(--ink-300)' }}>· {p.name} ({p.paperNumber})</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ink btn-sm">关闭</button>
        </div>
      </div>
    </div>
  );
}
