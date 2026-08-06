'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: '✅ 已通过', color: 'var(--sage)', bg: 'var(--sage-glow)' },
  AUTO_APPROVED: { label: '✅ 已通过', color: 'var(--sage)', bg: 'var(--sage-glow)' },
  PENDING: { label: '⏳ 待审核', color: 'var(--fox)', bg: 'var(--fox-glow)' },
  REJECTED: { label: '❌ 已驳回', color: 'var(--error)', bg: 'var(--verm-glow)' },
};

const SOURCE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  VIDEO: { label: '📺 视频', color: 'var(--info)', bg: 'var(--cyan-glow)' },
  OFFLINE: { label: '✏️ 申报', color: 'var(--fox)', bg: 'var(--fox-glow)' },
  MANUAL: { label: '✏️ 人工', color: 'var(--fox)', bg: 'var(--fox-glow)' },
};

export default function AdminLearningHoursPage() {
  const toast = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [programs, setPrograms] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (programFilter) params.programId = parseInt(programFilter);
      if (sourceFilter) params.source = sourceFilter;
      const d = await api.learningHours.list(params);
      setRecords(d.items || []);
      setTotal(d.total || 0);
    } catch {}
    setLoading(false);
  }, [statusFilter, programFilter, sourceFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    api.programs.list({ pageSize: 200 } as any).then(d => setPrograms(d.items || [])).catch(() => {});
  }, []);

  // 汇总统计
  const summary = {
    approved: records.filter(r => r.status === 'APPROVED' || r.status === 'AUTO_APPROVED').reduce((s, r) => s + r.hours, 0),
    pending: records.filter(r => r.status === 'PENDING').reduce((s, r) => s + r.hours, 0),
    rejected: records.filter(r => r.status === 'REJECTED').reduce((s, r) => s + r.hours, 0),
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">⏱ 学时管理</h1>
        <p className="page-subtitle">查看和管理所有学员学时记录</p>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-[var(--fox)] text-xl font-bold">{total}</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">总记录数</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[var(--sage)] text-xl font-bold">{Math.round(summary.approved * 100) / 100}h</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">已通过学时</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[var(--fox)] text-xl font-bold">{Math.round(summary.pending * 100) / 100}h</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">待审核学时</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[var(--error)] text-xl font-bold">{Math.round(summary.rejected * 100) / 100}h</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">已驳回学时</div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input select text-xs" style={{ maxWidth: 130 }}>
          <option value="">全部状态</option>
          <option value="APPROVED">✅ 已通过</option>
          <option value="PENDING">⏳ 待审核</option>
          <option value="REJECTED">❌ 已驳回</option>
        </select>
        <select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
          className="input select text-xs" style={{ maxWidth: 220 }}>
          <option value="">全部培训班</option>
          {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="input select text-xs" style={{ maxWidth: 130 }}>
          <option value="">全部来源</option>
          <option value="VIDEO">📺 视频</option>
          <option value="OFFLINE">✏️ 申报</option>
        </select>
        <span className="text-[var(--ink-300)] text-xs">共 {total} 条</span>
      </div>

      {/* 记录表格 */}
      {loading ? (
        <div className="card p-12 text-center"><p className="text-[var(--ink-300)]">加载中…</p></div>
      ) : records.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-[var(--ink-300)]">暂无学时记录</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="list-table">
            <thead><tr>
              <th>学员</th><th>培训班</th><th>来源</th><th>学时类型</th><th>学时</th><th>状态</th><th>审核信息</th><th>记录时间</th>
            </tr></thead>
            <tbody>
              {records.map((r: any) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.PENDING;
                const src = SOURCE_MAP[r.source] || SOURCE_MAP.OFFLINE;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="text-sm font-medium">{r.student?.displayName || '—'}</div>
                      <div className="text-[var(--ink-300)] text-xs">{r.student?.studentNumber || ''}</div>
                    </td>
                    <td className="text-xs">{r.program?.name || '—'}</td>
                    <td>
                      <span className="tag" style={{ background: src.bg, color: src.color, fontSize: '10px' }}>{src.label}</span>
                    </td>
                    <td className="text-[var(--ink-400)] text-xs">{r.type?.name || '—'}</td>
                    <td className="text-sm font-medium">{r.hours}h</td>
                    <td>
                      <span className="tag" style={{ background: st.bg, color: st.color, fontSize: '10px' }}>{st.label}</span>
                    </td>
                    <td className="text-[var(--ink-400)] text-xs">
                      {r.reviewComment ? <span title={r.reviewComment}>💬 {r.reviewComment.length > 12 ? r.reviewComment.slice(0, 12) + '…' : r.reviewComment}</span> : '—'}
                      {r.approvedAt && <div style={{ color: 'var(--ink-300)', fontSize: '10px' }}>{new Date(r.approvedAt).toLocaleDateString('zh-CN')}</div>}
                    </td>
                    <td className="text-[var(--ink-300)] text-xs">{new Date(r.recordedAt).toLocaleString('zh-CN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
