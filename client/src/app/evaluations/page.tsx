'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function EvaluationsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.trainingPrograms.list({ pageSize: '100' }).then((d: any) => {
      setPrograms(d.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadEvaluations = async (programId: number) => {
    setSelectedProgramId(programId);
    const [evals, st] = await Promise.all([
      api.evaluations.byProgram(programId).catch(() => []),
      api.evaluations.programStats(programId).catch(() => null),
    ]);
    setEvaluations(evals as any[] || []);
    setStats(st);
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📋 评价管理</h1>
        <p className="page-subtitle">查看学员对培训班的评价</p>
      </div>

      <div className="flex gap-3 mb-5">
        <select value={selectedProgramId || ''} onChange={e => e.target.value && loadEvaluations(parseInt(e.target.value))} className="input select" style={{ maxWidth: 300 }}>
          <option value="">选择培训班…</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selectedProgramId && (
        <>
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: '评价人数', value: stats.count, color: 'var(--ink-600)' },
                { label: '课程内容', value: `${renderStars(stats.contentRating)} ${stats.contentRating}`, color: 'var(--fox)' },
                { label: '讲师教学', value: `${renderStars(stats.instructorRating)} ${stats.instructorRating}`, color: 'var(--cyan)' },
                { label: '总体评分', value: `${renderStars(stats.overallRating)} ${stats.overallRating}`, color: 'var(--sage)' },
              ].map((s, i) => (
                <div key={i} className="card p-4 text-center">
                  <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead><tr><th>学员</th><th>时间</th><th>内容</th><th>讲师</th><th>总体</th><th>评语</th></tr></thead>
              <tbody>
                {evaluations.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.isAnonymous ? '匿名' : e.student?.displayName || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="text-center">{'★'.repeat(e.contentRating)}</td>
                    <td className="text-center">{'★'.repeat(e.instructorRating)}</td>
                    <td className="text-center"><strong style={{ color: e.overallRating >= 4 ? 'var(--sage)' : e.overallRating >= 3 ? 'var(--gold)' : 'var(--verm)' }}>{'★'.repeat(e.overallRating)}</strong></td>
                    <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>{e.comment || '—'}</td>
                  </tr>
                ))}
                {evaluations.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无评价</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedProgramId && !loading && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>请选择一个培训班查看评价</p>
        </div>
      )}
    </AppLayout>
  );
}
