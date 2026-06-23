'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const ENTITY_TYPES = ['', 'User', 'Exam', 'Certificate', 'Paper', 'Question', 'TrainingProgram', 'ExamSession', 'ScoreAppeal'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'APPEAL_ADJUST', 'UNLOCK', 'ADJUST'];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entityType: '', action: '', operatorId: '', entityId: '', startDate: '', endDate: '',
  });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '30' };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.operatorId) params.operatorId = filters.operatorId;
      if (filters.entityId) params.entityId = filters.entityId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const data = await api.auditLogs.list(params);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

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
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>操作人ID</label>
            <input type="number" value={filters.operatorId} onChange={e => setFilters({ ...filters, operatorId: e.target.value })} className="input text-xs" style={{ width: 100 }} placeholder="数字ID" min={1} />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>实体ID</label>
            <input type="number" value={filters.entityId} onChange={e => setFilters({ ...filters, entityId: e.target.value })} className="input text-xs" style={{ width: 100 }} placeholder="数字ID" min={1} />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>开始</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="input text-xs" style={{ width: 140 }} />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>结束</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="input text-xs" style={{ width: 140 }} />
          </div>
          <button onClick={() => { setPage(1); load(); }} className="btn btn-fox btn-xs">搜索</button>
          <button onClick={() => { setFilters({ entityType: '', action: '', operatorId: '', entityId: '', startDate: '', endDate: '' }); setPage(1); }} className="btn btn-outline btn-xs">清空</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无审计日志</p>
        </div>
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
                  <td className="text-xs">{log.operatorName || '—'}</td>
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

      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && <button onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-xs">上一页</button>}
          <span className="text-xs px-3 py-1.5" style={{ color: 'var(--ink-400)' }}>第 {page} 页 / 共 {Math.ceil(total / 30)} 页</span>
          {page < Math.ceil(total / 30) && <button onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-xs">下一页</button>}
        </div>
      )}
    </AppLayout>
  );
}
