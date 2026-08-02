'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function EvaluationsPage() {
  const toast = useToast();
  const [programs, setPrograms] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | ''>('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | ''>('');
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    const perms = JSON.parse(localStorage.getItem('userPermissions') || '{}');
    setCanManage(perms.isSuperAdmin || (perms.permissions || []).includes('evaluation:manage'));
    Promise.all([
      api.trainingPrograms.list({ pageSize: '100' }).then((d: any) => d.items || []),
      api.instructors.list({ pageSize: '100' }).then((d: any) => d.items || []),
    ]).then(([progs, insts]) => {
      setPrograms(progs);
      setInstructors(insts);
    }).catch(() => {});
  }, []);

  const loadEvaluations = useCallback(async (programId?: number | '', instructorId?: number | '') => {
    setLoading(true);
    const params: any = {};
    if (programId) params.programId = programId;
    if (instructorId) params.instructorId = instructorId;
    const [evals, st] = await Promise.all([
      api.evaluations.list(params).catch(() => []),
      programId ? api.evaluations.programStats(programId as number).catch(() => null) : Promise.resolve(null),
    ]);
    setEvaluations(Array.isArray(evals) ? evals : []);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  const handleProgramChange = (val: string) => {
    const id = val ? parseInt(val) : '';
    setSelectedProgramId(id);
    setSelectedInstructorId('');
    loadEvaluations(id, '');
  };

  const handleInstructorChange = (val: string) => {
    const id = val ? parseInt(val) : '';
    setSelectedInstructorId(id);
    setSelectedProgramId('');
    loadEvaluations('', id);
  };

  const handleDelete = async (evalId: number) => {
    if (!confirm('确定删除该评价？此操作不可撤销。')) return;
    try {
      await api.evaluations.delete(evalId);
      toast.success('已删除');
      loadEvaluations(selectedProgramId, selectedInstructorId);
    } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  const renderStars = (rating: number) => {
    if (!rating) return '—';
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📋 评价管理</h1>
        <p className="page-subtitle">查看学员对培训班及讲师的评价反馈</p>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={selectedProgramId} onChange={e => handleProgramChange(e.target.value)}
          className="input select" style={{ maxWidth: 300 }}>
          <option value="">全部培训班</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedInstructorId} onChange={e => handleInstructorChange(e.target.value)}
          className="input select" style={{ maxWidth: 250 }}>
          <option value="">全部讲师</option>
          {instructors.map((inst: any) => <option key={inst.id} value={inst.id}>{inst.realName}</option>)}
        </select>
      </div>

      {/* 统计卡片（仅按培训班筛选时显示） */}
      {stats && stats.count > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: '评价人数', value: stats.count, color: 'var(--ink-600)' },
            { label: '课程内容', value: `${renderStars(Math.round(stats.contentRating))} ${stats.contentRating}`, color: 'var(--fox)' },
            { label: '讲师教学', value: `${renderStars(Math.round(stats.instructorRating))} ${stats.instructorRating}`, color: 'var(--cyan)' },
            { label: '组织服务', value: stats.organizationRating ? `${renderStars(Math.round(stats.organizationRating))} ${stats.organizationRating}` : '—', color: 'var(--purple)' },
            { label: '总体评分', value: `${renderStars(Math.round(stats.overallRating))} ${stats.overallRating}`, color: 'var(--sage)' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 评价列表 */}
      <div className="card p-0 overflow-hidden">
        <table className="list-table">
          <thead>
            <tr>
              <th>培训班</th>
              <th>学员</th>
              <th>时间</th>
              <th>课程内容</th>
              <th>讲师教学</th>
              <th>总体</th>
              <th>评语</th>
              {canManage && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canManage ? 8 : 7} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</td></tr>
            ) : evaluations.length === 0 ? (
              <tr><td colSpan={canManage ? 8 : 7} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无评价数据</td></tr>
            ) : evaluations.map((e: any) => (
              <tr key={e.id}>
                <td className="text-xs">
                  <div className="font-medium">{e.program?.name || '—'}</div>
                  {e.program?.code && <div style={{ color: 'var(--ink-300)' }}>{e.program.code}</div>}
                </td>
                <td>{e.isAnonymous ? '匿名学员' : e.student?.displayName || '—'}</td>
                <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                <td className="text-center" title={`${e.contentRating}/5`}>
                  <span style={{ color: 'var(--fox)' }}>{'★'.repeat(e.contentRating)}</span>
                </td>
                <td className="text-center">
                  {e.instructorRatings && e.instructorRatings.length > 0 ? (
                    <div className="text-xs space-y-0.5">
                      {e.instructorRatings.map((ir: any) => (
                        <div key={ir.id} title={`${ir.instructor?.realName}: ${ir.rating}/5`}>
                          <span style={{ color: 'var(--ink-500)' }}>{ir.instructor?.realName}</span>{' '}
                          <span style={{ color: 'var(--cyan)' }}>{'★'.repeat(ir.rating)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--cyan)' }} title={`${e.instructorRating}/5`}>{'★'.repeat(e.instructorRating)}</span>
                  )}
                </td>
                <td className="text-center">
                  <strong style={{ color: e.overallRating >= 4 ? 'var(--sage)' : e.overallRating >= 3 ? 'var(--warning)' : 'var(--error)' }}>
                    {e.overallRating}/5
                  </strong>
                </td>
                <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>{e.comment || '—'}</td>
                {canManage && (
                  <td>
                    <button onClick={() => handleDelete(e.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--error)' }}>删除</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && evaluations.length > 0 && (
        <p className="text-xs mt-3" style={{ color: 'var(--ink-300)' }}>共 {evaluations.length} 条评价</p>
      )}
    </AppLayout>
  );
}
