'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction } from './shared';

export default function AgencyAdminDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const d = stats?.agency;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { value: d.totalStudents ?? '—', label: '名下学员', icon: '👥', color: 'var(--cyan)' },
          { value: d.pendingCertificates ?? '—', label: '待处理证书', icon: '🎓', color: d.pendingCertificates > 0 ? 'var(--fox)' : 'var(--sage)' },
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

      <div className="card p-5 mb-8">
        <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => router.push('/admin/agency-students')} className="btn btn-fox btn-xs">👥 管理学员</button>
          <button onClick={() => router.push('/admin/learning-hours-review')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">⏱ 学时管理</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Auditor Dashboard
// ═══════════════════════════════════════════
