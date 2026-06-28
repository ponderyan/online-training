'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function EvaluationsPage() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const perms = JSON.parse(localStorage.getItem('userPermissions') || '{}');
    setCanManage(perms.isSuperAdmin || (perms.permissions || []).includes('evaluation:manage'));
    }
    Promise.all([
      api.trainingPrograms.list({ pageSize: '100' }).then((d: any) => d.items || []),
      api.instructors.list({ pageSize: '100' }).then((d: any) => d.items || []),
    ]).then(([progs, insts]) => {
      setPrograms(progs);
      setInstructors(insts);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadEvaluations = async (programId: number) => {
    setSelectedProgramId(programId);
    setSelectedInstructorId(null);
    const [evals, st] = await Promise.all([
      api.evaluations.byProgram(programId).catch(() => []),
      api.evaluations.programStats(programId).catch(() => null),
    ]);
    setEvaluations(evals as any[] || []);
    setStats(st);
  };

  const loadInstructorEvaluations = async (instructorId: number) => {
    setSelectedInstructorId(instructorId);
    setSelectedProgramId(null);
    const data = await api.evaluations.instructorStats(instructorId).catch(() => null);
    setEvaluations(data?.evaluations || []);
    setStats(null);
  };

  const handleDelete = async (evalId: number) => {
    if (!confirm('确定删除该评价？此操作不可撤销。')) return;
    try {
      await api.evaluations.delete(evalId);
      if (selectedProgramId) loadEvaluations(selectedProgramId);
      else if (selectedInstructorId) loadInstructorEvaluations(selectedInstructorId);
    } catch (e: any) { alert('删除失败：' + e.message); }
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
        <p className="page-subtitle">查看学员对培训班及各讲师的评价</p>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={selectedProgramId || ''} onChange={e => { if (e.target.value) loadEvaluations(parseInt(e.target.value)); else setSelectedProgramId(null); setSelectedInstructorId(null); }}
          className="input select" style={{ maxWidth: 300 }}>
          <option value="">按培训班筛选…</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedInstructorId || ''} onChange={e => { if (e.target.value) loadInstructorEvaluations(parseInt(e.target.value)); else setSelectedInstructorId(null); setSelectedProgramId(null); }}
          className="input select" style={{ maxWidth: 250 }}>
          <option value="">按讲师筛选…</option>
          {instructors.map((inst: any) => <option key={inst.id} value={inst.id}>{inst.realName}</option>)}
        </select>
      </div>

      {(selectedProgramId || selectedInstructorId) ? (
        <>
          {stats && (
            <div className="grid grid-cols-5 gap-4 mb-6">
              {[
                { label: '评价人数', value: stats.count, color: 'var(--ink-600)' },
                { label: '课程内容', value: `${renderStars(stats.contentRating)} ${stats.contentRating}`, color: 'var(--fox)' },
                { label: '讲师教学', value: `${renderStars(stats.instructorRating)} ${stats.instructorRating}`, color: 'var(--cyan)' },
                { label: '组织服务', value: `${renderStars(stats.organizationRating)} ${stats.organizationRating}`, color: '#7b1fa2' },
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
              <thead>
                <tr>
                  {selectedInstructorId ? <th>培训班</th> : null}
                  <th>学员</th><th>时间</th><th>内容</th><th>讲师</th><th>总体</th><th>评语</th>
                  {canManage && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {evaluations.map((e: any) => (
                  <tr key={e.id}>
                    {selectedInstructorId ? <td className="text-xs">{e.program?.name || '—'}</td> : null}
                    <td>{e.isAnonymous ? '匿名' : e.student?.displayName || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="text-center">{'★'.repeat(e.contentRating)}</td>
                    <td className="text-center">{'★'.repeat(e.rating || e.instructorRating)}</td>
                    <td className="text-center"><strong style={{ color: e.overallRating >= 4 ? '#2e7d32' : e.overallRating >= 3 ? '#f59e0b' : '#ef4444' }}>{'★'.repeat(e.overallRating)}</strong></td>
                    <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>{e.comment || '—'}</td>
                    {canManage && (
                      <td>
                        <button onClick={() => handleDelete(e.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                      </td>
                    )}
                  </tr>
                ))}
                {evaluations.length === 0 && <tr><td colSpan={canManage ? 8 : 7} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无评价</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : !loading ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>请选择一个培训班或讲师查看评价</p>
        </div>
      ) : null}
    </AppLayout>
  );
}
