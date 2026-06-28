'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

// ── 操作类型中文映射 ──
const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  PUBLISH: '发布',
  APPEAL_ADJUST: '申诉调整',
  UNLOCK: '解锁',
  ADJUST: '调整',
  IMPORT: '导入',
  EXPORT: '导出',
  ARCHIVE: '归档',
  RESTORE: '恢复',
  REVOKE: '撤销',
  APPROVE: '审核通过',
  REJECT: '驳回',
  SUBMIT: '提交',
  REVIEW: '审核',
  CERTIFY: '发证',
  CANCEL: '取消',
};
const ACTION_COLORS: Record<string, string> = {
  CREATE: '#00897b',
  UPDATE: '#e87a30',
  DELETE: '#e53935',
  PUBLISH: '#7b1fa2',
  APPEAL_ADJUST: '#7b1fa2',
  UNLOCK: '#c9a03a',
  ADJUST: '#e87a30',
};

const ENTITY_TYPES = [
  'User', 'Exam', 'Certificate', 'Paper', 'Question',
  'TrainingProgram', 'ExamSession', 'ScoreAppeal',
  'Filing', 'VideoCourse', 'Instructor', 'Schedule',
  'ProgramEnrollment', 'Course', 'CourseVideo',
  'Material', 'Notification', 'Permission', 'Role',
];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 从已加载数据生成 CSV 并触发下载 */
function downloadCSV(logs: any[], filename = '审计日志.csv') {
  const headers = ['操作时间', '操作人', '操作类型', '实体类型', '实体ID', '操作内容摘要', 'IP地址'];
  const rows = logs.map((log: any) => [
    formatTime(log.createdAt),
    log.operatorName || `用户 #${log.operatorId || '?'}`,
    ACTION_LABELS[log.action] || log.action || '',
    log.entityType || '',
    String(log.entityId ?? ''),
    (log.after && typeof log.after === 'object')
      ? Object.keys(log.after).slice(0, 3).join(', ')
      : (log.before && typeof log.before === 'object')
        ? Object.keys(log.before).slice(0, 3).join(', ')
        : '',
    log.ip || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

/** 检查当前用户是否有指定权限 */
function can(permission: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const permsStr = localStorage.getItem('userPermissions');
    if (permsStr) {
      const permsData = JSON.parse(permsStr);
      if (permsData.isSuperAdmin) return true;
      const perms: string[] = permsData.permissions || [];
      return perms.includes(permission);
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.isSuperAdmin) return true;
      const perms: string[] = user.permissions || [];
      return perms.includes(permission);
    }
  } catch {
    // ignore parse errors
  }
  return false;
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // 固定每页 20 条
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    operatorName: '',
    startDate: '',
    endDate: '',
  });

  const searchKey = useMemo(() => JSON.stringify(filters), [filters]);

  const hasPermission = can('auditLog:view');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.operatorName) params.operatorName = filters.operatorName;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const data = await api.auditLogs.list(params);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasPermission) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchKey, hasPermission]);

  const totalPages = Math.ceil(total / pageSize);

  // 若没有权限，显示无权限提示
  if (!hasPermission) {
    return (
      <AppLayout>
        <div className="mb-6">
          <h1 className="page-title">📋 审计日志</h1>
          <p className="page-subtitle">系统操作审计追溯</p>
        </div>
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p style={{ color: 'var(--ink-300)' }}>您没有查看审计日志的权限</p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>请联系管理员开通 auditLog:view 权限</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📋 审计日志</h1>
        <p className="page-subtitle">
          系统操作审计追溯 · 共 {total} 条操作记录
        </p>
      </div>

      {/* ── 筛选器 ── */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          {/* 实体类型 */}
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>
              实体类型
            </label>
            <select
              value={filters.entityType}
              onChange={e =>
                setFilters({ ...filters, entityType: e.target.value })
              }
              className="input select text-xs"
              style={{ width: 140 }}
            >
              <option value="">全部实体</option>
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* 操作类型 */}
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>
              操作类型
            </label>
            <select
              value={filters.action}
              onChange={e =>
                setFilters({ ...filters, action: e.target.value })
              }
              className="input select text-xs"
              style={{ width: 130 }}
            >
              <option value="">全部操作</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({k})
                </option>
              ))}
            </select>
          </div>

          {/* 操作人搜索 */}
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>
              操作人
            </label>
            <input
              type="text"
              value={filters.operatorName}
              onChange={e =>
                setFilters({ ...filters, operatorName: e.target.value })
              }
              className="input text-xs"
              style={{ width: 160 }}
              placeholder="搜索用户名/姓名…"
            />
          </div>

          {/* 开始日期 */}
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>
              开始日期
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="input text-xs"
              style={{ width: 150 }}
            />
          </div>

          {/* 结束日期 */}
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--ink-400)' }}>
              结束日期
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="input text-xs"
              style={{ width: 150 }}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 items-end">
            <button
              onClick={() => {
                setPage(1);
                load();
              }}
              className="btn btn-fox btn-xs"
            >
              搜索
            </button>
            <button
              onClick={() => {
                setFilters({
                  entityType: '',
                  action: '',
                  operatorName: '',
                  startDate: '',
                  endDate: '',
                });
                setPage(1);
              }}
              className="btn btn-outline btn-xs"
            >
              清空
            </button>
            <button
              onClick={() => downloadCSV(logs)}
              className="btn btn-outline btn-xs"
              disabled={logs.length === 0}
              style={{ opacity: logs.length === 0 ? 0.4 : 1 }}
            >
              📥 导出 CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── 表格区域 ── */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>
          小狐狸正在加载… 🦊
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无审计日志</p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>操作时间</th>
                  <th>操作人</th>
                  <th>操作类型</th>
                  <th>操作对象</th>
                  <th>操作内容摘要</th>
                  <th>IP 地址</th>
                  <th style={{ width: 60 }}>详情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => {
                  const isExpanded = expandedRow === log.id;
                  // 生成操作内容摘要
                  const summary = (() => {
                    if (log.action === 'CREATE') return `创建 ${log.entityType || '实体'}`;
                    if (log.action === 'UPDATE') {
                      const after = log.after;
                      if (after && typeof after === 'object') {
                        const changed = Object.keys(after).slice(0, 3).join(', ');
                        return `更新了 ${changed}${Object.keys(after).length > 3 ? ' 等' : ''}`;
                      }
                      return '更新数据';
                    }
                    if (log.action === 'DELETE') return `删除 ${log.entityType || '实体'}`;
                    if (log.action === 'PUBLISH') return `发布 ${log.entityType || '实体'}`;
                    if (log.before || log.after) return '修改数据';
                    return `执行 ${ACTION_LABELS[log.action] || log.action} 操作`;
                  })();
                  // 操作对象描述
                  const entityLabel = log.entityType
                    ? `${log.entityType}#${log.entityId ?? '?'}`
                    : log.entityId
                      ? `#${log.entityId}`
                      : '—';

                  return (
                    <tr key={log.id}>
                      <td className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-400)' }}>
                        {formatTime(log.createdAt)}
                      </td>
                      <td className="text-xs">
                        {log.operatorName ? (
                          <span>
                            {log.operatorName}
                            <span className="font-mono" style={{ color: 'var(--ink-300)' }}>
                              {' '}({log.operatorId})
                            </span>
                          </span>
                        ) : log.operatorId ? (
                          <span className="font-mono" style={{ color: 'var(--ink-300)' }}>
                            用户 #{log.operatorId}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-300)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className="tag text-[10px]"
                          style={{
                            background: `${ACTION_COLORS[log.action] || '#888'}18`,
                            color: ACTION_COLORS[log.action] || '#888',
                          }}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="text-xs">
                        <span className="tag tag-cyan text-[10px]" style={{ marginRight: 4 }}>
                          {log.entityType || '?'}
                        </span>
                        <span className="font-mono" style={{ color: 'var(--ink-400)' }}>
                          #{log.entityId ?? '?'}
                        </span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--ink-500)', maxWidth: 280 }}>
                        <span className="truncate block" style={{ maxWidth: 280 }}>
                          {summary}
                        </span>
                      </td>
                      <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>
                        {log.ip || '—'}
                      </td>
                      <td>
                        {(log.before || log.after) ? (
                          <button
                            onClick={() =>
                              setExpandedRow(isExpanded ? null : log.id)
                            }
                            className="text-xs bg-transparent border-none cursor-pointer whitespace-nowrap"
                            style={{ color: 'var(--fox)' }}
                          >
                            {isExpanded ? '收起' : '展开'}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── 展开详情 (使用 <details> 标签) ── */}
            {expandedRow && (() => {
              const log = logs.find(l => l.id === expandedRow);
              if (!log) return null;
              return (
                <div
                  className="border-t"
                  style={{ borderColor: 'var(--ink-100)' }}
                >
                  <details
                    open
                    className="p-4"
                    style={{ background: 'var(--paper-dark)' }}
                  >
                    <summary
                      className="text-xs font-medium cursor-pointer mb-2"
                      style={{ color: 'var(--ink-400)' }}
                    >
                      完整变更详情（JSON）
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <div
                          className="font-medium text-[10px] mb-1"
                          style={{ color: 'var(--ink-400)' }}
                        >
                          变更前 (before):
                        </div>
                        <pre
                          className="p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all"
                          style={{
                            background: 'white',
                            border: '1px solid var(--ink-100)',
                            fontSize: 11,
                          }}
                        >
                          {log.before
                            ? JSON.stringify(log.before, null, 2)
                            : '—'}
                        </pre>
                      </div>
                      <div>
                        <div
                          className="font-medium text-[10px] mb-1"
                          style={{ color: 'var(--ink-400)' }}
                        >
                          变更后 (after):
                        </div>
                        <pre
                          className="p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all"
                          style={{
                            background: 'white',
                            border: '1px solid var(--ink-100)',
                            fontSize: 11,
                          }}
                        >
                          {log.after
                            ? JSON.stringify(log.after, null, 2)
                            : '—'}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })()}
          </div>

          {/* ── 分页控件 ── */}
          <div className="flex flex-col items-center gap-3 mt-6">
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--ink-400)' }}>
                共 {total} 条 · 每页 {pageSize} 条 · 第 {page}/{totalPages || 1} 页
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn btn-outline btn-xs px-2"
                style={{ opacity: page === 1 ? 0.3 : 1 }}
              >
                ⟪
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-outline btn-xs"
                style={{ opacity: page === 1 ? 0.3 : 1 }}
              >
                上一页
              </button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span
                    key={`dots-${i}`}
                    className="text-xs px-1"
                    style={{ color: 'var(--ink-300)' }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className="btn btn-xs px-2"
                    style={
                      p === page
                        ? { background: 'var(--fox)', color: 'white', border: 'none' }
                        : {
                            background: 'transparent',
                            border: '1px solid var(--ink-200)',
                            color: 'var(--ink-500)',
                          }
                    }
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-outline btn-xs"
                style={{ opacity: page === totalPages ? 0.3 : 1 }}
              >
                下一页
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="btn btn-outline btn-xs px-2"
                style={{ opacity: page === totalPages ? 0.3 : 1 }}
              >
                ⟫
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
