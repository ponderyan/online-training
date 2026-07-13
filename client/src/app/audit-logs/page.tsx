'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonTable } from '@/components/Skeleton';

const ENTITY_TYPES = ['', 'User', 'Exam', 'Certificate', 'Paper', 'Question',
  'TrainingProgram', 'ExamSession', 'ScoreAppeal',
  'Filing', 'VideoCourse', 'Instructor', 'Schedule',
  'ProgramEnrollment', 'Course', 'CourseVideo',
];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'APPEAL_ADJUST', 'UNLOCK', 'ADJUST'];

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  if (current <= 4) { pages.push(1, 2, 3, 4, 5, '...', total); }
  else if (current >= total - 3) { pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total); }
  else { pages.push(1, '...', current - 1, current, current + 1, '...', total); }
  return pages;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [filters, setFilters] = useState({
    entityType: '', action: '', operatorId: '', operatorName: '', entityId: '', startDate: '', endDate: '',
  });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const searchKey = useMemo(() => JSON.stringify(filters), [filters]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.operatorName) params.operatorName = filters.operatorName;
      if (filters.operatorId) params.operatorId = filters.operatorId;
      if (filters.entityId) params.entityId = filters.entityId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const data = await api.auditLogs.list(params);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || '加载审计日志失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, pageSize, searchKey]);

  const totalPages = Math.ceil(total / pageSize);

  const ACTION_COLORS: Record<string, string> = {
    CREATE: '#00897b', UPDATE: '#e87a30', DELETE: '#e53935',
    APPEAL_ADJUST: '#7b1fa2', UNLOCK: '#c9a03a', ADJUST: '#e87a30',
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📋 审计日志</h1>
        <p className="page-subtitle">共 {total} 条操作记录 · 所有变更可追溯</p>
      </div>

      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>实体类型</label>
            <select value={filters.entityType} onChange={e => setFilters({ ...filters, entityType: e.target.value })} className="input select text-xs" style={{ width: 130 }}>
              <option value="">全部</option>
              {ENTITY_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>操作</label>
            <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} className="input select text-xs" style={{ width: 110 }}>
              <option value="">全部</option>
              {ACTIONS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>操作人</label>
            <input type="text" value={filters.operatorName} onChange={e => setFilters({ ...filters, operatorName: e.target.value })}
              className="input text-xs" style={{ width: 150 }} placeholder="搜索用户名/姓名" />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>实体ID</label>
            <input type="text" value={filters.entityId} onChange={e => setFilters({ ...filters, entityId: e.target.value })}
              className="input text-xs" style={{ width: 130 }} placeholder="输入实体ID" />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>开始</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="input text-xs" style={{ width: 140 }} />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>结束</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="input text-xs" style={{ width: 140 }} />
          </div>
          <button onClick={() => { setPage(1); }} className="btn btn-fox btn-xs">搜索</button>
          <button onClick={() => {
            setFilters({ entityType: '', action: '', operatorId: '', operatorName: '', entityId: '', startDate: '', endDate: '' });
            setPage(1);
          }} className="btn btn-outline btn-xs">清空</button>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonTable rows={8} cols={6} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : logs.length === 0 ? (
        <div className="card"><EmptyState icon="📋" title="暂无审计日志" description="所有操作变更记录都会在这里留痕" /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>实体类型</th>
                <th>实体ID</th>
                <th>操作</th>
                <th>IP</th>
                <th>变更详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-400)' }}>{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="text-xs">
                    {log.operatorName ? (
                      <span>{log.operatorName}<span className="font-mono" style={{ color: 'var(--ink-300)' }}> ({log.operatorId})</span></span>
                    ) : log.operatorId ? (
                      <span className="font-mono" style={{ color: 'var(--ink-300)' }}>用户 #{log.operatorId}</span>
                    ) : (
                      <span style={{ color: 'var(--ink-300)' }}>—</span>
                    )}
                  </td>
                  <td><span className="tag tag-cyan text-[10px]">{log.entityType}</span></td>
                  <td className="font-mono text-xs">{log.entityId}</td>
                  <td><span className="tag text-[10px]" style={{ background: `${ACTION_COLORS[log.action] || '#888'}18`, color: ACTION_COLORS[log.action] || '#888' }}>{log.action}</span></td>
                  <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{log.ip || '—'}</td>
                  <td>
                    {(log.before || log.after) ? (
                      <button onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                        {expandedRow === log.id ? '收起' : '查看'}
                      </button>
                    ) : <span className="text-xs" style={{ color: 'var(--ink-300)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expandedRow && (() => {
            const log = logs.find(l => l.id === expandedRow);
            if (!log) return null;
            return (
              <div className="p-4 border-t" style={{ borderColor: 'var(--ink-100)', background: 'var(--paper-dark)' }}>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <div className="font-medium text-[10px] mb-1" style={{ color: 'var(--ink-400)' }}>变更前 (before):</div>
                    <pre className="p-2 rounded overflow-auto max-h-40" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                      {JSON.stringify(log.before, null, 2) || '—'}
                    </pre>
                  </div>
                  <div>
                    <div className="font-medium text-[10px] mb-1" style={{ color: 'var(--ink-400)' }}>变更后 (after):</div>
                    <pre className="p-2 rounded overflow-auto max-h-40" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                      {JSON.stringify(log.after, null, 2) || '—'}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Pagination — 居中 */}
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ink-400)' }}>共 {total} 条</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="input select text-xs" style={{ width: 70 }}>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-xs" style={{ color: 'var(--ink-400)' }}>条/页</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="btn btn-outline btn-xs px-2" style={{ opacity: page === 1 ? 0.3 : 1 }}>⟪</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn btn-outline btn-xs" style={{ opacity: page === 1 ? 0.3 : 1 }}>上一页</button>
          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="text-xs px-1" style={{ color: 'var(--ink-300)' }}>…</span>
            ) : (
              <button key={p} onClick={() => setPage(p as number)}
                className="btn btn-xs px-2"
                style={p === page
                  ? { background: 'var(--fox)', color: 'white', border: 'none' }
                  : { background: 'transparent', border: '1px solid var(--ink-200)', color: 'var(--ink-500)' }}>
                {p}
              </button>
            )
          )}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="btn btn-outline btn-xs" style={{ opacity: page === totalPages ? 0.3 : 1 }}>下一页</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="btn btn-outline btn-xs px-2" style={{ opacity: page === totalPages ? 0.3 : 1 }}>⟫</button>
        </div>
      </div>
    </AppLayout>
  );
}
