'use client';

import { useState } from 'react';
import AppLayout from '@/components/app-layout';
import PracticePlayer from '@/components/practice-player';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const ALL_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'];
const COUNT_OPTIONS = [5, 10, 20, 30];

export default function RandomPracticePage() {
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(10);
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [types, setTypes] = useState<string[]>([...ALL_TYPES]);

  useState(() => { api.subjects.list().then(setSubjects).catch(() => {}); });

  if (!started) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-16">
          <h1 className="page-title mb-6 text-center">🔀 随机练习</h1>
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ink-500)' }}>科目</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select text-sm w-full">
                <option value="">全部科目</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ink-500)' }}>题型</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={types.includes(t)}
                      onChange={() => setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      className="accent-[#e87a30]" />
                    {TYPE_NAMES[t]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ink-500)' }}>题数</label>
              <select value={count} onChange={e => setCount(parseInt(e.target.value))} className="input select text-sm w-24">
                {COUNT_OPTIONS.map(c => <option key={c} value={c}>{c}题</option>)}
              </select>
            </div>
            <button onClick={() => setStarted(true)} className="btn btn-fox w-full">开始练习</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const loadQuestions = async () => {
    const params: Record<string, any> = { random: 'true', count };
    if (subjectId) params.subjectId = subjectId;
    if (types.length < 4) params.types = types.join(',');
    return api.practice.questions(params);
  };

  return <PracticePlayer title="随机练习" loadQuestions={loadQuestions} />;
}
