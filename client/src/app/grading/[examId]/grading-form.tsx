'use client';

import { useState } from 'react';

// 单题评分输入表单（分数 + 评语 + 提交，Enter 快捷提交）
export default function GradingForm({ answerId, maxScore, onGrade, onNextStudent }: { answerId: number; maxScore: number; onGrade: (id: number, score: number, note?: string) => void; onNextStudent?: () => void }) {
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!score) return;
    setSubmitting(true);
    await onGrade(answerId, parseInt(score), note);
    setSubmitting(false);
    setScore('');
    if (onNextStudent) onNextStudent();
  };
  return (
    <div className="flex gap-2 items-end">
      <div><label className="text-[var(--ink-400)] block text-xs mb-1">评分（/{maxScore}）</label><input type="number" value={score} onChange={e => setScore(e.target.value)} className="input w-20" min={0} max={maxScore}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} /></div>
      <div className="flex-1"><label className="text-[var(--ink-400)] block text-xs mb-1">评语</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="扣分原因" className="input"
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} /></div>
      <button onClick={handleSubmit}
        disabled={!score || submitting} className="btn text-xs px-3 py-2 bg-[var(--sage)]" style={{  color: 'white', opacity: !score || submitting ? 0.5 : 1 }}>
        {submitting ? '提交中…' : '提交评分'}</button>
    </div>
  );
}
