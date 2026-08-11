'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// 评价 Tab：统计卡 + 评价列表
export default function EvaluationsTab({ programId }: { programId: number }) {
  const [evals, setEvals] = useState<any[]>([]);
  const [evalStats, setEvalStats] = useState<any>(null);

  const load = async () => {
    try {
      const [ev, st] = await Promise.all([
        api.evaluations.byProgram(programId).catch(() => []),
        api.evaluations.programStats(programId).catch(() => null),
      ]);
      setEvals(ev as any[] || []);
      setEvalStats(st);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      {evalStats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '评价人数', value: evalStats.count, color: 'var(--ink-600)' },
            { label: '课程内容', value: `${'★'.repeat(Math.floor(evalStats.contentRating))}${evalStats.contentRating % 1 >= 0.5 ? '☆' : ''} ${evalStats.contentRating}`, color: 'var(--fox)' },
            { label: '讲师教学', value: `${'★'.repeat(Math.floor(evalStats.instructorRating))} ${evalStats.instructorRating}`, color: 'var(--cyan)' },
            { label: '总体评分', value: `${'★'.repeat(Math.floor(evalStats.overallRating))} ${evalStats.overallRating}`, color: 'var(--sage)' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[var(--ink-400)] text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="list-table">
          <thead><tr><th>学员</th><th>时间</th><th>内容</th><th>讲师</th><th>总体</th><th>评语</th></tr></thead>
          <tbody>
            {evals.map((e: any) => (
              <tr key={e.id}>
                <td>{e.isAnonymous ? '匿名' : e.student?.displayName || '—'}</td>
                <td className="text-[var(--ink-300)] text-xs">{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                <td className="text-center">{'★'.repeat(e.contentRating)}</td>
                <td className="text-center">{'★'.repeat(e.instructorRating)}</td>
                <td className="text-center"><strong style={{ color: e.overallRating >= 4 ? 'var(--sage)' : e.overallRating >= 3 ? 'var(--gold)' : 'var(--verm)' }}>{'★'.repeat(e.overallRating)}</strong></td>
                <td className="text-[var(--ink-400)] text-xs max-w-[200px] truncate">{e.comment || '—'}</td>
              </tr>
            ))}
            {evals.length === 0 && <tr><td colSpan={6} className="text-[var(--ink-300)] text-center py-8 text-xs">暂无评价</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
