'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { STATUS_NAMES, STATUS_COLORS } from './program-constants';

// 状态流转 Tab：当前状态卡 + 变更时间线
export default function StatusTab({ programId, status }: { programId: number; status: string }) {
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadStatusLogs = async () => {
    setLogsLoading(true);
    try { setStatusLogs(await api.trainingPrograms.getStatusLogs(programId) || []); } catch {}
    setLogsLoading(false);
  };

  useEffect(() => { loadStatusLogs(); }, []);

  return (
    <div>
      <div className="card p-5 mb-6 text-center">
        <div className="text-[var(--ink-400)] text-xs mb-2">当前状态</div>
        <div className="text-2xl font-bold mb-1" style={{ color: STATUS_COLORS[status] || 'var(--neutral-400)' }}>
          {STATUS_NAMES[status] || status}
        </div>
      </div>
      <div className="card p-5">
        <h3 className="text-[var(--ink-700)] text-sm font-semibold mb-4">状态变更记录</h3>
        <div className="relative pl-8">
          <div className="bg-[var(--ink-200)] absolute left-3.5 top-2 bottom-2 w-0.5" />
          {logsLoading ? (
            <div className="text-[var(--ink-300)] py-8 text-center text-xs">加载中…</div>
          ) : statusLogs.length === 0 ? (
            <div className="text-[var(--ink-300)] py-8 text-center text-xs">暂无状态变更记录</div>
          ) : statusLogs.map((log: any) => (
            <div key={log.id} className="relative pb-6">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 bg-[var(--paper)]"
                style={{  borderColor: STATUS_COLORS[log.toStatus] || 'var(--neutral-400)' }} />
              <div className="text-[var(--ink-400)] text-xs">
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </div>
              <div className="text-sm mt-0.5">
                <span style={{ color: STATUS_COLORS[log.fromStatus] || 'var(--neutral-400)' }}>
                  {STATUS_NAMES[log.fromStatus] || log.fromStatus || '初始'}
                </span>
                {' → '}
                <span style={{ color: STATUS_COLORS[log.toStatus] || 'var(--neutral-400)', fontWeight: 600 }}>
                  {STATUS_NAMES[log.toStatus] || log.toStatus}
                </span>
              </div>
              <div className="text-[var(--ink-400)] text-xs mt-0.5">
                {log.operator?.displayName || '系统'}{log.reason ? ` · ${log.reason}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
