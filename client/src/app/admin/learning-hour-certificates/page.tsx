'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待审批', color: '#e87a30' },
  APPROVED: { text: '已通过', color: '#2e7d32' },
  REJECTED: { text: '已驳回', color: '#ef4444' },
  REVOKED: { text: '已撤销', color: '#6b7280' },
};

export default function LearningHourCertificates() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Detail modal
  const [detailItem, setDetailItem] = useState<any>(null);

  // Review modal
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);

  // Revoke modal
  const [revokeItem, setRevokeItem] = useState<any>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const r = await api.learningHourCertificates.list(params);
      setItems(r.items || []);
      setTotal(r.total || 0);
    } catch {}
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  };

  const handleReview = async () => {
    if (!reviewItem || !reviewAction) return;
    setProcessing(true);
    try {
      await api.learningHourCertificates.review(reviewItem.id, reviewAction, reviewNote || undefined);
      setReviewItem(null);
      setReviewNote('');
      setReviewAction(null);
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      alert('操作失败：' + e.message);
    }
    setProcessing(false);
  };

  const handleRevoke = async () => {
    if (!revokeItem || !revokeReason.trim()) return;
    setProcessing(true);
    try {
      await api.learningHourCertificates.revoke(revokeItem.id, revokeReason);
      setRevokeItem(null);
      setRevokeReason('');
      load();
    } catch (e: any) {
      alert('操作失败：' + e.message);
    }
    setProcessing(false);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📜 学时证明</h1>
          <p className="page-subtitle">管理学员学时证明申请 · 共 {total} 份</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {[['', '全部'], ['PENDING', '待审批'], ['APPROVED', '已通过'], ['REJECTED', '已驳回'], ['REVOKED', '已撤销']].map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setSelectedIds(new Set()); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: statusFilter === v ? 'var(--fox)' : 'var(--paper-dark)',
              color: statusFilter === v ? '#fff' : 'var(--ink-400)',
            }}>{l}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 搜索学员/编号…"
          className="input text-xs ml-auto" style={{ width: 200 }} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📜</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无学时证明</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === items.length} onChange={selectAll} className="accent-[#e87a30]" /></th>
                <th>编号</th>
                <th>学员</th>
                <th>培训班</th>
                <th>总学时</th>
                <th>状态</th>
                <th>申请时间</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const st = STATUS_MAP[item.approvalStatus] || { text: item.approvalStatus, color: '#6b7280' };
                return (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-[#e87a30]" /></td>
                    <td className="font-mono text-xs">{item.certificateNo || '—'}</td>
                    <td>
                      <div className="text-sm font-medium">{item.studentName || '—'}</div>
                    </td>
                    <td className="text-xs">{item.programName || '—'}</td>
                    <td className="text-sm font-medium">{item.totalHours}</td>
                    <td>
                      <span className="tag" style={{
                        background: st.color + '18',
                        color: st.color,
                        border: '1px solid ' + st.color + '30',
                        fontSize: '10px',
                      }}>
                        {st.text}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {item.appliedAt ? new Date(item.appliedAt).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setDetailItem(item)}
                          className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-400)' }}>详情</button>
                        {item.approvalStatus === 'APPROVED' && (
                          <>
                            <a href={`/api/learning-hour-certificates/${item.id}/pdf`} target="_blank"
                              className="btn btn-ghost btn-xs" style={{ color: 'var(--cyan)' }}>📥 PDF</a>
                            <button onClick={() => setRevokeItem(item)}
                              className="btn btn-ghost btn-xs" style={{ color: '#6b7280' }}>撤销</button>
                          </>
                        )}
                        {item.approvalStatus === 'PENDING' && (
                          <button onClick={() => { setReviewItem(item); setReviewNote(''); setReviewAction(null); }}
                            className="btn btn-ghost btn-xs" style={{ color: 'var(--fox)' }}>审核</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div className="modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="modal-card max-w-[480px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">📜 学时证明详情</h3>
              <button onClick={() => setDetailItem(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block" style={{ color: 'var(--ink-400)' }}>证明编号</span>
                  <span className="font-mono font-medium">{detailItem.certificateNo || '—'}</span>
                </div>
                <div>
                  <span className="block" style={{ color: 'var(--ink-400)' }}>状态</span>
                  <span className="tag" style={{
                    background: (STATUS_MAP[detailItem.approvalStatus]?.color || '#6b7280') + '18',
                    color: STATUS_MAP[detailItem.approvalStatus]?.color || '#6b7280',
                    fontSize: '10px',
                  }}>{STATUS_MAP[detailItem.approvalStatus]?.text || detailItem.approvalStatus}</span>
                </div>
                <div className="col-span-2">
                  <span className="block" style={{ color: 'var(--ink-400)' }}>学员</span>
                  <span className="font-medium">{detailItem.studentName}</span>
                </div>
                <div className="col-span-2">
                  <span className="block" style={{ color: 'var(--ink-400)' }}>培训班</span>
                  <span>{detailItem.programName}</span>
                </div>
                <div>
                  <span className="block" style={{ color: 'var(--ink-400)' }}>总学时</span>
                  <span className="font-medium" style={{ color: 'var(--fox)' }}>{detailItem.totalHours} 小时</span>
                </div>
                <div>
                  <span className="block" style={{ color: 'var(--ink-400)' }}>申请时间</span>
                  <span>{detailItem.appliedAt ? new Date(detailItem.appliedAt).toLocaleString('zh-CN') : '—'}</span>
                </div>
              </div>

              {detailItem.hoursDetail?.length > 0 && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--ink-200)' }}>
                  <div className="text-xs mb-1.5 font-semibold">学时明细</div>
                  <table className="w-full text-xs">
                    <thead><tr><th className="text-left py-1" style={{ color: 'var(--ink-400)' }}>类型</th><th className="text-right py-1" style={{ color: 'var(--ink-400)' }}>学时</th></tr></thead>
                    <tbody>
                      {detailItem.hoursDetail.map((d: any, i: number) => (
                        <tr key={i}>
                          <td className="py-0.5">{d.typeName || d.source}</td>
                          <td className="text-right py-0.5">{d.hours} 小时</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {detailItem.reviewNote && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--ink-200)' }}>
                  <span className="block text-xs" style={{ color: 'var(--ink-400)' }}>审核备注</span>
                  <span className="text-xs">{detailItem.reviewNote}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {detailItem.approvalStatus === 'APPROVED' && (
                <a href={`/api/learning-hour-certificates/${detailItem.id}/pdf`} target="_blank"
                  className="btn btn-fox btn-sm">📥 下载 PDF</a>
              )}
              <button onClick={() => setDetailItem(null)} className="btn btn-outline btn-sm">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewItem && (
        <div className="modal-overlay" onClick={() => setReviewItem(null)}>
          <div className="modal-card max-w-[420px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">审核学时证明</h3>
              <button onClick={() => setReviewItem(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="text-xs space-y-1">
                <div><span style={{ color: 'var(--ink-400)' }}>学员：</span>{reviewItem.studentName}</div>
                <div><span style={{ color: 'var(--ink-400)' }}>培训班：</span>{reviewItem.programName}</div>
                <div><span style={{ color: 'var(--ink-400)' }}>总学时：</span><span style={{ color: 'var(--fox)' }}>{reviewItem.totalHours} 小时</span></div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>审核备注（可选）</label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  className="input w-full" rows={2} placeholder="审核意见…" />
              </div>
            </div>
            <div className="modal-footer flex gap-2">
              <button onClick={() => setReviewItem(null)} className="btn btn-outline btn-sm flex-1">取消</button>
              <button onClick={() => { setReviewAction('reject'); handleReview(); }}
                disabled={processing}
                className="btn btn-sm" style={{ background: '#ef4444', color: 'white', opacity: processing ? 0.5 : 1 }}>
                {processing ? '处理中…' : '驳回'}
              </button>
              <button onClick={() => { setReviewAction('approve'); handleReview(); }}
                disabled={processing}
                className="btn btn-sm" style={{ background: '#2e7d32', color: 'white', opacity: processing ? 0.5 : 1 }}>
                {processing ? '处理中…' : '通过'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeItem && (
        <div className="modal-overlay" onClick={() => setRevokeItem(null)}>
          <div className="modal-card max-w-[400px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">撤销学时证明</h3>
              <button onClick={() => setRevokeItem(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-3">
              <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                确认撤销 {revokeItem.studentName} 的学时证明（{revokeItem.certificateNo}）？
              </p>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>撤销原因 *</label>
                <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)}
                  className="input w-full" rows={2} placeholder="请输入撤销原因…" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setRevokeItem(null); setRevokeReason(''); }} className="btn btn-outline btn-sm">取消</button>
              <button onClick={handleRevoke} disabled={!revokeReason.trim() || processing}
                className="btn btn-sm" style={{ background: '#6b7280', color: 'white', opacity: (!revokeReason.trim() || processing) ? 0.5 : 1 }}>
                {processing ? '处理中…' : '确认撤销'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
