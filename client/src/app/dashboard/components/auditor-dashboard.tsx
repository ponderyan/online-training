'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction } from './shared';

export default function AuditorDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const d = stats?.auditor;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { value: d.todayLogCount ?? '—', label: '今日操作数', icon: '📋', color: 'var(--fox)' },
          { value: d.totalLogCount ?? '—', label: '累计日志', icon: '📦', color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card p-5 flex items-center gap-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5 text-[var(--ink-400)]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {d.recentLogs && d.recentLogs.length > 0 && (
        <div className="card p-5 mb-8">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">最近操作记录</h3>
          <div className="space-y-1">
            {d.recentLogs.map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 p-2 rounded text-xs text-[var(--ink-500)]">
                <span className="bg-[var(--fox)] w-2 h-2 rounded-full flex-shrink-0" />
                <span>{log.action}</span>
                <span className="text-[10px] text-[var(--ink-300)]">{log.entityType || '—'}</span>
                <span className="text-[var(--ink-200)] ml-auto text-[10px]">
                  {new Date(log.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => router.push('/admin/audit-trail')} className="btn btn-fox btn-xs">🔍 全链审计</button>
          <button onClick={() => router.push('/audit-logs')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📋 审计日志</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════
