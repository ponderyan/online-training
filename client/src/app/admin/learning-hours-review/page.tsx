'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function LearningHoursReviewPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [pendingHours, setPendingHours] = useState<any[]>([]);
  const [reviewedHours, setReviewedHours] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [programFilter, setProgramFilter] = useState<number | undefined>();
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadPending = useCallback(async () => {
    try {
      const d = await api.learningHours.pending(programFilter, sourceFilter || undefined);
      setPendingHours(Array.isArray(d) ? d : []);
    } catch {}
  }, [programFilter, sourceFilter]);

  const loadReviewed = useCallback(async () => {
    try {
      const params: any = {};
      if (programFilter) params.programId = programFilter;
      if (sourceFilter) params.source = sourceFilter;
      // 加载已审核记录（APPROVED + REJECTED）
      const [approved, rejected] = await Promise.all([
        api.learningHours.list({ ...params, status: 'APPROVED' }),
        api.learningHours.list({ ...params, status: 'REJECTED' }),
      ]);
      const merged = [...(approved.items || []), ...(rejected.items || [])]
        .sort((a, b) => new Date(b.approvedAt || b.recordedAt).getTime() - new Date(a.approvedAt || a.recordedAt).getTime());
      setReviewedHours(merged);
    } catch {}
  }, [programFilter, sourceFilter]);

  useEffect(() => {
    if (tab === 'pending') loadPending();
    else loadReviewed();
  }, [tab, loadPending, loadReviewed]);

  useEffect(() => {
    api.programs.list({ pageSize: 200 } as any).then(d => setPrograms(d.items || [])).catch(() => {});
  }, []);

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === pendingHours.length) setSelected(new Set());
    else setSelected(new Set(pendingHours.map(h => h.id)));
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;
    try {
      await api.learningHours.approve(Array.from(selected));
      toast.success(`已通过 ${selected.size} 条学时`);
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setSelected(new Set());
    loadPending();
  };

  const handleReject = async () => {
    if (selected.size === 0 || !rejectReason.trim()) return;
    try {
      await api.learningHours.reject(Array.from(selected), rejectReason);
      toast.success(`已驳回 ${selected.size} 条学时`);
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setSelected(new Set()); setRejectModal(false); setRejectReason('');
    loadPending();
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">⏱ 学时审核</h1>
        <p className="page-subtitle">审核学员申报的学时记录</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 mb-4">
        <button onClick={() => { setTab('pending'); setSelected(new Set()); }}
          className="btn btn-sm" style={tab === 'pending' ? { background: 'var(--fox)', color: '#fff' } : { background: 'transparent', color: 'var(--ink-400)' }}>
          待审核 {pendingHours.length > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full text-white text-[10px] w-4 h-4" style={{ background: '#ef4444' }}>{pendingHours.length}</span>}
        </button>
        <button onClick={() => { setTab('reviewed'); setSelected(new Set()); }}
          className="btn btn-sm" style={tab === 'reviewed' ? { background: 'var(--fox)', color: '#fff' } : { background: 'transparent', color: 'var(--ink-400)' }}>
          已审核
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 mb-4">
        <select value={programFilter || ''} onChange={e => setProgramFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="input select text-xs" style={{ maxWidth: 250 }}>
          <option value="">全部培训班</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="input select text-xs" style={{ maxWidth: 140 }}>
          <option value="">全部来源</option>
          <option value="OFFLINE">✏️ 人工申报</option>
        </select>
        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
          {tab === 'pending' ? `共 ${pendingHours.length} 条待审核` : `共 ${reviewedHours.length} 条已审核`}
        </span>
      </div>

      {/* 待审核 Tab */}
      {tab === 'pending' && (
        pendingHours.length === 0 ? (
          <div className="card p-12 text-center"><p style={{ color: 'var(--ink-300)' }}>🎉 暂无待审核学时记录</p></div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden mb-4">
              <table className="list-table">
                <thead><tr>
                  <th><input type="checkbox" checked={selected.size === pendingHours.length} onChange={selectAll} className="accent-[var(--fox)]" /></th>
                  <th>学员</th><th>培训班</th><th>学时类型</th><th>学时</th><th>证据</th><th>申报说明</th><th>提交时间</th>
                </tr></thead>
                <tbody>
                  {pendingHours.map(h => (
                    <tr key={h.id}>
                      <td><input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleSelect(h.id)} className="accent-[var(--fox)]" /></td>
                      <td><div className="text-sm font-medium">{h.student?.displayName || '—'}</div><div className="text-xs" style={{ color: 'var(--ink-300)' }}>{h.student?.studentNumber || ''}</div></td>
                      <td className="text-xs">{h.program?.name || '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{h.type?.name || '—'}</td>
                      <td className="text-sm font-medium">{h.hours}h</td>
                      <td>{h.evidenceUrl ? <a href={h.evidenceUrl} target="_blank" className="text-xs" style={{ color: 'var(--fox)' }}>查看附件</a> : '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-400)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.note || h.description || ''}>{h.note || h.description || '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(h.recordedAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={handleApprove} disabled={selected.size === 0}
                className="btn btn-fox btn-sm">✅ 批量通过 ({selected.size})</button>
              <button onClick={() => setRejectModal(true)} disabled={selected.size === 0}
                className="btn btn-outline btn-sm" style={{ color: '#ef4444' }}>❌ 批量驳回 ({selected.size})</button>
            </div>
          </>
        )
      )}

      {/* 已审核 Tab */}
      {tab === 'reviewed' && (
        reviewedHours.length === 0 ? (
          <div className="card p-12 text-center"><p style={{ color: 'var(--ink-300)' }}>暂无已审核记录</p></div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead><tr>
                <th>学员</th><th>培训班</th><th>学时</th><th>结果</th><th>审核意见</th><th>审核时间</th>
              </tr></thead>
              <tbody>
                {reviewedHours.map(h => (
                  <tr key={h.id}>
                    <td><div className="text-sm font-medium">{h.student?.displayName || '—'}</div></td>
                    <td className="text-xs">{h.program?.name || '—'}</td>
                    <td className="text-sm font-medium">{h.hours}h</td>
                    <td>
                      {h.status === 'REJECTED'
                        ? <span className="tag" style={{ background: '#ef444418', color: '#ef4444', fontSize: '10px' }}>❌ 驳回</span>
                        : <span className="tag" style={{ background: '#2e7d3218', color: '#2e7d32', fontSize: '10px' }}>✅ 通过</span>}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-400)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.reviewComment || ''}>
                      {h.reviewComment || '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {h.approvedAt ? new Date(h.approvedAt).toLocaleString('zh-CN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 驳回弹窗 */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setRejectModal(false); }}>
          <div className="rounded-2xl w-full max-w-sm p-6" style={{ background: 'white' }}>
            <h3 className="text-base font-semibold mb-2">驳回原因</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} className="input w-full" placeholder="请输入驳回原因…" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRejectModal(false)} className="btn btn-outline btn-sm flex-1">取消</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-sm flex-1" style={{ background: '#ef4444', color: '#fff' }}>确认驳回</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
