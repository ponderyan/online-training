'use client';
import { useRouter } from 'next/navigation';

export default function AgencyAdminDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… ��</div>;
  const d = stats?.agency;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { value: d.totalStudents ?? '—', label: '名下学员', icon: '👥', color: 'var(--cyan)' },
          { value: d.totalEnrollments ?? '—', label: '累计招生', icon: '📋', color: 'var(--gold)' },
          { value: d.pendingCertificates ?? '—', label: '待处理证书', icon: '🎓', color: (d.pendingCertificates ?? 0) > 0 ? 'var(--fox)' : 'var(--sage)' },
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

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="card p-5 col-span-2">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">最近招生记录</h3>
          {(d.recentEnrollments?.length ?? 0) === 0 ? (
            <p className="text-xs text-[var(--ink-300)] py-4 text-center">暂无招生记录</p>
          ) : (
            <div className="space-y-2">
              {d.recentEnrollments.map((e: any) => (
                <div key={e.id} className="bg-[var(--paper-dark)] flex items-center justify-between p-2.5 rounded-lg">
                  <span className="text-sm text-[var(--ink-600)]">👤 {e.student?.displayName || '—'}</span>
                  <span className="text-xs text-[var(--ink-400)]">{e.program?.name || ''}</span>
                  <span className="text-xs text-[var(--ink-300)]">{new Date(e.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 self-start">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => router.push('/admin/agency-students')} className="btn btn-fox btn-xs">👥 管理学员</button>
            <button onClick={() => router.push('/agencies/radar')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📊 招生雷达</button>
            <button onClick={() => router.push('/admin/learning-hours-review')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">⏱ 学时管理</button>
          </div>
        </div>
      </div>
    </>
  );
}
