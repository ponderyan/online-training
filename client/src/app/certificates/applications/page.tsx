'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待审批', color: '#d97706' },
  APPROVED: { text: '已批准', color: 'var(--cyan)' },
  REJECTED: { text: '已驳回', color: 'var(--verm)' },
};

export default function CertificateApplications() {
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const load = () => {
    setLoading(true);
    api.certificateApplications.list({ status: statusFilter || '', page: '1', limit: '50' })
      .then(r => setApps(r.items || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter]);

  const handleApprove = async (id: number) => {
    if (!confirm('确认批准此申请？')) return;
    try { await api.certificateApplications.approve(id, user.id || 1); load(); }
    catch (e: any) { alert('操作失败：' + e.message); }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确认批量批准 ${selectedIds.length} 个申请？`)) return;
    try { await api.certificateApplications.batchApprove(selectedIds, user.id || 1); setSelectedIds([]); load(); }
    catch (e: any) { alert('操作失败：' + e.message); }
  };

  const handleReject = async () => {
    if (!rejectReason || !rejectId) return;
    try { await api.certificateApplications.reject(rejectId, rejectReason, user.id || 1); setRejectId(null); setRejectReason(''); load(); }
    catch (e: any) { alert('操作失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🏅 证书申请审批</h1>
          <p className="page-subtitle">审核通过后自动生成证书</p>
        </div>
        {selectedIds.length > 0 && (
          <button onClick={handleBatchApprove} className="btn btn-fox btn-sm">
            ✅ 批量批准（{selectedIds.length}）
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[['PENDING', '待审批'], ['APPROVED', '已批准'], ['REJECTED', '已驳回'], ['', '全部']].map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setSelectedIds([]); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: statusFilter === v ? 'var(--fox)' : 'var(--paper-dark)',
              color: statusFilter === v ? '#fff' : 'var(--ink-400)',
            }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                {statusFilter === 'PENDING' && <th style={{ width: 40 }}></th>}
                <th>学员</th><th>考试</th><th>状态</th><th>申请时间</th>
                {statusFilter === 'PENDING' && <th style={{ width: 140 }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {apps.map((a: any) => (
                <tr key={a.id}>
                  {statusFilter === 'PENDING' && (
                    <td><input type="checkbox" checked={selectedIds.includes(a.id)}
                      onChange={e => { if (e.target.checked) setSelectedIds([...selectedIds, a.id]); else setSelectedIds(selectedIds.filter(id => id !== a.id)); }}
                      className="accent-[#e87a30]" /></td>
                  )}
                  <td className="font-medium">{a.student?.displayName || '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{a.examSession?.exam?.title || '—'}</td>
                  <td>
                    <span className="tag" style={{ background: STATUS_LABEL[a.status]?.color + '18', color: STATUS_LABEL[a.status]?.color, border: '1px solid ' + (STATUS_LABEL[a.status]?.color + '30') }}>
                      {STATUS_LABEL[a.status]?.text || a.status}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('zh-CN') : '—'}</td>
                  {statusFilter === 'PENDING' && (
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => handleApprove(a.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--cyan)' }}>批准</button>
                        <button onClick={() => setRejectId(a.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>驳回</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={statusFilter === 'PENDING' ? 6 : 5} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无申请</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rejectId && (
        <div className="modal-overlay" onClick={() => setRejectId(null)}>
          <div className="modal-card max-w-[400px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">驳回证书申请</h3>
              <button onClick={() => setRejectId(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-3">
              <label className="block text-xs" style={{ color: 'var(--ink-400)' }}>驳回原因 *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="如：成绩未达标、缺少必要材料" className="input textarea" rows={3} />
            </div>
            <div className="modal-footer">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleReject} disabled={!rejectReason}
                className="btn btn-sm" style={{ background: 'var(--verm)', color: 'white', opacity: !rejectReason ? 0.5 : 1 }}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
