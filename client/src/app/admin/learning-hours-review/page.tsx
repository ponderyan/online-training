'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function LearningHoursReviewPage() {
  const [pendingHours, setPendingHours] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [programFilter, setProgramFilter] = useState<number | undefined>();
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    api.learningHours.pending(programFilter).then(d => setPendingHours(Array.isArray(d) ? d : [])).catch(() => {});
    // Load programs list
    api.programs.list({ pageSize: 200 }).then(d => setPrograms(d.items || [])).catch(() => {});
  }, [programFilter]);

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === pendingHours.length) setSelected(new Set());
    else setSelected(new Set(pendingHours.map(h => h.id)));
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;
    await api.learningHours.approve(Array.from(selected));
    setSelected(new Set());
    api.learningHours.pending(programFilter).then(d => setPendingHours(Array.isArray(d) ? d : []));
  };

  const handleReject = async () => {
    if (selected.size === 0 || !rejectReason.trim()) return;
    await api.learningHours.reject(Array.from(selected), rejectReason);
    setSelected(new Set()); setRejectModal(false); setRejectReason('');
    api.learningHours.pending(programFilter).then(d => setPendingHours(Array.isArray(d) ? d : []));
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">⏱ 学时审核</h1>
        <p className="page-subtitle">审核学员线下培训学时</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select value={programFilter || ''} onChange={e => setProgramFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="input select text-xs" style={{ maxWidth: 250 }}>
          <option value="">全部培训班</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>共 {pendingHours.length} 条待审核</span>
      </div>

      {pendingHours.length === 0 ? (
        <div className="card p-12 text-center"><p style={{ color: 'var(--ink-300)' }}>暂无待审核学时记录</p></div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden mb-4">
            <table className="list-table">
              <thead><tr>
                <th><input type="checkbox" checked={selected.size === pendingHours.length} onChange={selectAll} className="accent-[#e87a30]" /></th>
                <th>学员</th><th>培训班</th><th>线下学时</th><th>证据</th><th>提交时间</th>
              </tr></thead>
              <tbody>
                {pendingHours.map(h => (
                  <tr key={h.id}>
                    <td><input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleSelect(h.id)} className="accent-[#e87a30]" /></td>
                    <td><div className="text-sm font-medium">{h.student?.displayName || '—'}</div><div className="text-xs" style={{ color: 'var(--ink-300)' }}>{h.student?.studentNumber || ''}</div></td>
                    <td className="text-xs">{h.program?.name || '—'}</td>
                    <td className="text-sm font-medium">{h.hours}</td>
                    <td>{h.evidenceUrl ? <a href={h.evidenceUrl} target="_blank" className="text-xs" style={{ color: 'var(--fox)' }}>查看附件</a> : '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(h.recordedAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApprove} disabled={selected.size === 0}
              className="btn btn-fox btn-sm">✅ 批量通过</button>
            <button onClick={() => setRejectModal(true)} disabled={selected.size === 0}
              className="btn btn-outline btn-sm" style={{ color: '#ef4444' }}>❌ 批量驳回</button>
          </div>
        </>
      )}

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
