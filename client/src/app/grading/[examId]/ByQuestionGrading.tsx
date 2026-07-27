"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/Toast';

interface RubricItem {
  description: string;
  points: number;
  type: 'add' | 'deduct';
}

interface ByQuestionGradingProps {
  examId: number;
  exam: any;
  blind: boolean;
}

export default function ByQuestionGrading({ examId, exam, blind }: ByQuestionGradingProps) {
  const toast = useToast();
  const [subjectivePqs, setSubjectivePqs] = useState<any[]>([]);
  const [selectedPq, setSelectedPq] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [rubric, setRubric] = useState<RubricItem[]>([]);
  const [selectedRubric, setSelectedRubric] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scoreInput, setScoreInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [rubricDraft, setRubricDraft] = useState<RubricItem[]>([]);
  const scoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const subjectiveTypes = ['SHORT_ANSWER', 'CASE_STUDY'];
    const pqs = (exam?.paper?.questions || []).filter((pq: any) => subjectiveTypes.includes(pq.question?.type));
    setSubjectivePqs(pqs);
    if (pqs.length > 0) setSelectedPq(pqs[0]);
  }, [exam]);

  const loadAnswers = useCallback(async (pq: any) => {
    if (!pq) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading/${examId}/by-question/${pq.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); setAnswers([]); return; }
      setAnswers(data.answers || []);
      setRubric(data.question?.rubric || []);
      const firstPending = (data.answers || []).findIndex((a: any) => !a.graded);
      setCurrentIdx(firstPending >= 0 ? firstPending : 0);
      setScoreInput('');
      setNoteInput('');
      setSelectedRubric(new Set());
    } catch (e: any) { toast.error('加载失败：' + e.message); }
    setLoading(false);
  }, [examId]);

  useEffect(() => { if (selectedPq) loadAnswers(selectedPq); }, [selectedPq, loadAnswers]);

  // Rubric 点击 → 自动计算分数
  const toggleRubricItem = (idx: number) => {
    setSelectedRubric(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      // 计算总分：满分起步，加上 add 项、减去 deduct 项
      const maxScore = selectedPq?.score || 0;
      let score = 0;
      next.forEach(i => {
        const item = rubric[i];
        if (item.type === 'add') score += item.points;
        else score -= item.points;
      });
      score = Math.max(0, Math.min(maxScore, score));
      setScoreInput(String(score));
      // 自动拼接评语
      const notes = [...next].map(i => rubric[i].description);
      setNoteInput(notes.join('；'));
      return next;
    });
  };

  const saveRubric = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading/${examId}/rubric/${selectedPq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rubric: rubricDraft }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setRubric(rubricDraft);
      setShowRubricEditor(false);
      toast.success('评分标准已保存');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
  };

  const submitGrade = async (answerId: number, score: number, note: string) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const studentId = answers.find(a => a.answerId === answerId)?.studentId;
      const res = await fetch(`/api/grading/${examId}/${studentId}/${answerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score, graderNote: note }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return false; }
      setAnswers(prev => prev.map(a => a.answerId === answerId ? { ...a, score, graderNote: note, graded: true } : a));
      return true;
    } catch (e: any) { toast.error('评分失败：' + e.message); return false; }
    finally { setSubmitting(false); }
  };

  const handleSubmitAndNext = async () => {
    const current = answers[currentIdx];
    if (!current || !scoreInput) return;
    const score = parseFloat(scoreInput);
    if (isNaN(score)) { toast.warning('请输入有效分数'); return; }
    const ok = await submitGrade(current.answerId, score, noteInput);
    if (ok) {
      setScoreInput('');
      setNoteInput('');
      setSelectedRubric(new Set());
      const nextPending = answers.findIndex((a, i) => i > currentIdx && !a.graded);
      if (nextPending >= 0) setCurrentIdx(nextPending);
      else {
        const anyPending = answers.findIndex(a => !a.graded);
        if (anyPending >= 0) setCurrentIdx(anyPending);
        else toast.success('🎉 该题全部评完！');
      }
      setTimeout(() => scoreRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAndNext(); }
    if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); setCurrentIdx(prev => Math.min(prev + 1, answers.length - 1)); setScoreInput(''); setNoteInput(''); setSelectedRubric(new Set()); }
    if (e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); setCurrentIdx(prev => Math.max(prev - 1, 0)); setScoreInput(''); setNoteInput(''); setSelectedRubric(new Set()); }
  };

  const gradedCount = answers.filter(a => a.graded).length;
  const maxScore = selectedPq?.score || 0;
  const typeNames: Record<string, string> = { SHORT_ANSWER: '简答题', CASE_STUDY: '案例题' };

  return (
    <div className="flex gap-5" onKeyDown={handleKeyDown}>
      {/* 左栏：题目列表 */}
      <div className="w-56 flex-shrink-0">
        <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
          <div className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
            主观题（{subjectivePqs.length}）
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {subjectivePqs.map((pq: any) => (
              <div key={pq.id} onClick={() => setSelectedPq(pq)}
                className="px-4 py-3 cursor-pointer transition-colors text-sm"
                style={{ background: selectedPq?.id === pq.id ? '#fef3e7' : 'white' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                    {typeNames[pq.question?.type] || pq.question?.type}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{pq.score}分</span>
                </div>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-400)' }}>{pq.question?.content}</p>
              </div>
            ))}
            {subjectivePqs.length === 0 && <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>本场无主观题</div>}
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg text-[10px] space-y-1" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
          <p>⌨️ 快捷键：</p>
          <p><kbd className="px-1 rounded" style={{ background: 'white', border: '1px solid var(--ink-200)' }}>Enter</kbd> 提交并下一个</p>
          <p><kbd className="px-1 rounded" style={{ background: 'white', border: '1px solid var(--ink-200)' }}>Alt+↑↓</kbd> 切换答案</p>
        </div>
      </div>

      {/* 右栏：答案列表 + 评分 */}
      <div className="flex-1">
        {!selectedPq ? (
          <div className="rounded-xl p-12 text-center" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
            <p className="text-3xl mb-3">📝</p>
            <p style={{ color: 'var(--ink-300)' }}>选择左侧题目开始按题批阅</p>
          </div>
        ) : loading ? (
          <div className="rounded-xl p-12 text-center" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
            <p style={{ color: 'var(--ink-300)' }}>加载中…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 题目信息 + 进度 */}
            <div className="rounded-xl p-4" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                    {typeNames[selectedPq.question?.type]} · {selectedPq.score}分
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ink-400)' }}>已评 {gradedCount}/{answers.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${answers.length > 0 ? Math.round(gradedCount / answers.length * 100) : 0}%`, background: gradedCount === answers.length ? 'var(--sage)' : 'var(--fox)' }} />
                  </div>
                  <span className="text-[10px] num" style={{ color: 'var(--ink-400)' }}>{answers.length > 0 ? Math.round(gradedCount / answers.length * 100) : 0}%</span>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink-600)' }}>{selectedPq.question?.content}</p>
              {selectedPq.question?.analysis && (
                <p className="text-xs mt-2 p-2 rounded" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>
                  📖 参考答案：{selectedPq.question.analysis}
                </p>
              )}
            </div>

            {/* Rubric 评分标准 */}
            {rubric.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>📋 评分标准（点击打分）</span>
                  <button onClick={() => { setRubricDraft([...rubric]); setShowRubricEditor(true); }}
                    className="text-[10px] px-2 py-0.5 rounded" style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-400)' }}>
                    编辑标准
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rubric.map((item, idx) => (
                    <button key={idx} onClick={() => toggleRubricItem(idx)}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                      style={{
                        border: `1.5px solid ${selectedRubric.has(idx) ? (item.type === 'add' ? 'var(--sage)' : '#e53e3e') : 'var(--ink-200)'}`,
                        background: selectedRubric.has(idx) ? (item.type === 'add' ? 'var(--sage-glow)' : '#fff5f5') : 'white',
                        color: selectedRubric.has(idx) ? (item.type === 'add' ? 'var(--sage)' : '#e53e3e') : 'var(--ink-500)',
                      }}>
                      {item.type === 'add' ? '+' : '-'}{item.points} {item.description}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {rubric.length === 0 && (
              <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--paper-dark)', border: '1px dashed var(--ink-200)' }}>
                <span className="text-xs" style={{ color: 'var(--ink-400)' }}>💡 尚未设置评分标准，可预设扣分点提升阅卷一致性</span>
                <button onClick={() => { setRubricDraft([]); setShowRubricEditor(true); }}
                  className="text-xs px-3 py-1 rounded-md" style={{ background: 'var(--fox)', color: 'white' }}>
                  + 设置 Rubric
                </button>
              </div>
            )}

            {/* 当前答案 + 评分表单 */}
            {answers.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: 'white', border: `2px solid ${answers[currentIdx]?.graded ? 'var(--sage)' : 'var(--fox-light)'}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>
                    {blind ? `考生 #${currentIdx + 1}` : answers[currentIdx]?.studentName} · 第 {currentIdx + 1}/{answers.length} 份
                  </span>
                  {answers[currentIdx]?.graded && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>
                      ✅ 已评 {answers[currentIdx].score}/{maxScore}
                    </span>
                  )}
                </div>
                <div className="text-sm p-4 rounded-lg mb-4" style={{ background: 'var(--fox-pale)', borderLeft: '3px solid var(--fox-light)', minHeight: 80 }}>
                  <p style={{ color: 'var(--ink-700)', whiteSpace: 'pre-wrap' }}>
                    {typeof answers[currentIdx]?.answer === 'string'
                      ? (answers[currentIdx]?.answer || '（未作答）')
                      : JSON.stringify(answers[currentIdx]?.answer || '（未作答）')}
                  </p>
                </div>
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>评分（/{maxScore}）</label>
                    <input ref={scoreRef} type="number" value={scoreInput}
                      onChange={e => setScoreInput(e.target.value)}
                      className="input w-24" min={0} max={maxScore} placeholder="0" autoFocus />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>评语（可选）</label>
                    <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                      className="input" placeholder="扣分原因…" />
                  </div>
                  <button onClick={handleSubmitAndNext} disabled={!scoreInput || submitting}
                    className="btn text-xs px-4 py-2.5" style={{ background: 'var(--sage)', color: 'white', opacity: !scoreInput || submitting ? 0.5 : 1 }}>
                    {submitting ? '…' : '✓ 提交 (Enter)'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {[0, Math.round(maxScore * 0.5), Math.round(maxScore * 0.8), maxScore].filter((v, i, arr) => arr.indexOf(v) === i).map(v => (
                    <button key={v} onClick={() => { setScoreInput(String(v)); setSelectedRubric(new Set()); }}
                      className="text-xs px-2.5 py-1 rounded-md transition-all"
                      style={{ border: '1px solid var(--ink-200)', color: scoreInput === String(v) ? 'var(--fox)' : 'var(--ink-400)', background: scoreInput === String(v) ? 'var(--fox-glow)' : 'white' }}>
                      {v === 0 ? '0分' : v === maxScore ? `满分${v}` : `${v}分`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 全部答案缩略列表 */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
              <div className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
                全部答案（{answers.length}份）
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                {answers.map((a, idx) => (
                  <div key={a.answerId} onClick={() => { setCurrentIdx(idx); setScoreInput(a.score !== null ? String(a.score) : ''); setNoteInput(a.graderNote || ''); setSelectedRubric(new Set()); }}
                    className="px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors"
                    style={{ background: idx === currentIdx ? '#fef3e7' : 'white' }}>
                    <span className="text-[10px] num w-6 text-center" style={{ color: 'var(--ink-300)' }}>{idx + 1}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--ink-500)' }}>
                      {blind ? `考生 #${idx + 1}` : a.studentName}
                    </span>
                    <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--ink-300)' }}>
                      {typeof a.answer === 'string' ? (a.answer || '未作答').slice(0, 30) : '…'}
                    </span>
                    {a.graded ? (
                      <span className="text-xs font-medium num" style={{ color: 'var(--sage)' }}>{a.score}/{maxScore}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--gold-glow)', color: 'var(--gold-dark)' }}>待评</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rubric 编辑弹窗 */}
      {showRubricEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="rounded-2xl p-6 w-[520px] max-h-[80vh] overflow-y-auto" style={{ background: 'white' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-700)' }}>📋 编辑评分标准（{selectedPq?.score}分）</h3>
            <div className="space-y-2 mb-4">
              {rubricDraft.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={item.type} onChange={e => { const d = [...rubricDraft]; d[idx] = { ...d[idx], type: e.target.value as any }; setRubricDraft(d); }}
                    className="input w-20 text-xs">
                    <option value="add">得分</option>
                    <option value="deduct">扣分</option>
                  </select>
                  <input type="number" value={item.points} min={1} max={selectedPq?.score}
                    onChange={e => { const d = [...rubricDraft]; d[idx] = { ...d[idx], points: parseInt(e.target.value) || 0 }; setRubricDraft(d); }}
                    className="input w-16 text-xs" />
                  <input type="text" value={item.description} placeholder="描述…"
                    onChange={e => { const d = [...rubricDraft]; d[idx] = { ...d[idx], description: e.target.value }; setRubricDraft(d); }}
                    className="input flex-1 text-xs" />
                  <button onClick={() => setRubricDraft(rubricDraft.filter((_, i) => i !== idx))}
                    className="text-xs px-2 py-1 rounded" style={{ color: '#e53e3e' }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setRubricDraft([...rubricDraft, { description: '', points: 1, type: 'add' }])}
              className="text-xs px-3 py-1.5 rounded-md mb-4" style={{ border: '1px dashed var(--ink-300)', color: 'var(--ink-500)' }}>
              + 添加评分项
            </button>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRubricEditor(false)} className="btn btn-outline btn-sm">取消</button>
              <button onClick={saveRubric} className="btn btn-sm" style={{ background: 'var(--fox)', color: 'white' }}>保存标准</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
