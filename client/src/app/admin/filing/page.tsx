'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const STATUS_NAMES: Record<string, string> = {
  PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#e87a30', APPROVED: '#2e7d32', REJECTED: '#e53935',
};

export default function FilingPage() {
  const router = useRouter();
  const toast = useToast();
  const [filings, setFilings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Detail / review modal
  const [selected, setSelected] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.filing.list({ page, pageSize, status: filterStatus || undefined, search: search || undefined });
      setFilings(res.items || []);
      setTotal(res.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [page, filterStatus]);

  const doSearch = () => { setSearch(searchInput); setPage(1); };

  const openDetail = async (id: number) => {
    try { const data = await api.filing.get(id); setSelected(data); setModalOpen(true); setAction('APPROVED'); setComment(''); } catch {}
  };

  const handleReview = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.filing.review(selected.id, { status: action, reviewComment: comment || undefined });
      setModalOpen(false); setSelected(null); load();
    } catch { toast.error('操作失败'); }
    setSubmitting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🏢 开班备案</h1>
        <p className="page-subtitle">共 {total} 条记录 · 培训机构提交备案 · 秘书处审核</p>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 mb-5">
        <div className="flex gap-2">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="🔍 搜索机构名称…" className="input" style={{ maxWidth: 240 }} />
          <button onClick={doSearch} className="btn btn-outline btn-sm">搜索</button>
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="input select" style={{ maxWidth: 120 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : filings.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-4">🏢</p><p style={{ color: 'var(--ink-300)' }}>暂无备案记录</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead><tr><th>培训班</th><th>机构名称</th><th>联系人</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
            <tbody>
              {filings.map((f: any) => (
                <tr key={f.id}>
                  <td className="font-medium text-sm">{f.program?.name || '—'}</td>
                  <td>{f.agencyName}</td>
                  <td>{f.agencyContact} ({f.agencyPhone})</td>
                  <td><span className="tag" style={{ background: `${STATUS_COLORS[f.status]}18`, color: STATUS_COLORS[f.status] }}>{STATUS_NAMES[f.status] || f.status}</span></td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(f.submittedAt).toLocaleString('zh-CN')}</td>
                  <td>
                    <button onClick={() => openDetail(f.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                      {f.status === 'PENDING' ? '审核' : '详情'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <span className="text-xs" style={{ color: 'var(--ink-400)' }}>共 {total} 条，第 {page}/{totalPages} 页</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="btn btn-outline btn-xs">上一页</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="btn btn-outline btn-xs">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail / Review Modal */}
      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: 'var(--paper)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">
              {selected.status === 'PENDING' ? '审核备案' : '备案详情'}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>培训班</span><p className="font-medium mt-0.5">{selected.program?.name}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>培训班编号</span><p className="font-medium mt-0.5">{selected.program?.code || '—'}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>机构名称</span><p className="mt-0.5">{selected.agencyName}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>联系人</span><p className="mt-0.5">{selected.agencyContact} / {selected.agencyPhone}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>提交人</span><p className="mt-0.5">{selected.submittedBy?.displayName || '—'}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>提交时间</span><p className="mt-0.5">{selected.submittedAt ? new Date(selected.submittedAt).toLocaleString('zh-CN') : '—'}</p></div>
                <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>当前状态</span>
                  <p className="mt-0.5"><span className="tag" style={{ background: `${STATUS_COLORS[selected.status]}18`, color: STATUS_COLORS[selected.status] }}>{STATUS_NAMES[selected.status] || selected.status}</span></p>
                </div>
              </div>

              {selected.status === 'PENDING' && (
                <>
                  <div className="flex gap-2 pt-3">
                    <button onClick={() => setAction('APPROVED')} className="btn btn-sm flex-1"
                      style={{ background: action === 'APPROVED' ? '#2e7d32' : 'var(--paper-dark)', color: action === 'APPROVED' ? 'white' : 'var(--ink-400)' }}>✅ 通过</button>
                    <button onClick={() => setAction('REJECTED')} className="btn btn-sm flex-1"
                      style={{ background: action === 'REJECTED' ? '#e53935' : 'var(--paper-dark)', color: action === 'REJECTED' ? 'white' : 'var(--ink-400)' }}>❌ 驳回</button>
                  </div>
                  {action === 'REJECTED' && (
                    <div><label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>驳回原因 *</label>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} className="input w-full" rows={3} /></div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleReview} disabled={submitting || (action === 'REJECTED' && !comment)}
                      className="btn btn-fox btn-sm flex-1">{submitting ? '提交中…' : '确认审核'}</button>
                    <button onClick={() => setModalOpen(false)} className="btn btn-outline btn-sm">取消</button>
                  </div>
                </>
              )}

              {selected.status !== 'PENDING' && (
                <div className="pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核人</span><p className="mt-0.5">{selected.reviewedBy?.displayName || '—'}</p></div>
                    <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核时间</span><p className="mt-0.5">{selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString('zh-CN') : '—'}</p></div>
                  </div>
                  {selected.reviewComment && (
                    <div className="mt-2"><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核意见</span><p className="text-sm mt-1" style={{ color: 'var(--ink-600)' }}>{selected.reviewComment}</p></div>
                  )}
                  <button onClick={() => setModalOpen(false)} className="btn btn-outline btn-sm mt-4">关闭</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
