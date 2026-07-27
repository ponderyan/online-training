'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction, STATUS_NAMES, STATUS_COLORS } from './shared';

export default function GlobalAdminDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const g = stats?.global;
  if (!g) return null;

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: g.activePrograms ?? '—', label: '进行中的培训班', icon: '📋', color: 'var(--fox)' },
          { value: g.totalStudents ?? '—', label: '学员总数', icon: '👥', color: 'var(--cyan)' },
          { value: g.pendingGrading ?? '—', label: '待阅卷', icon: '📝', color: g.pendingGrading > 0 ? 'var(--fox)' : 'var(--sage)' },
          { value: g.pendingAppeals ?? '—', label: '待审核申诉', icon: '⚖️', color: g.pendingAppeals > 0 ? 'var(--verm)' : 'var(--sage)' },
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--ink-700)]">最近培训班</h3>
            <button onClick={() => router.push('/programs')} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]">查看更多 →</button>
          </div>
          {(!g.recentPrograms || g.recentPrograms.length === 0) ? (
            <p className="text-xs text-[var(--ink-300)]">暂无培训班</p>
          ) : (
            <div className="space-y-2">
              {g.recentPrograms.map((p: any) => (
                <div key={p.id} onClick={() => router.push(`/programs/${p.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'var(--paper-dark)' }}>
                  <div>
                    <div className="text-sm font-medium text-[var(--ink-600)]">{p.name}</div>
                    <div className="text-xs mt-0.5 text-[var(--ink-300)]">
                      {p.code} · {p.startDate?.slice(0, 10)} ~ {p.endDate?.slice(0, 10)}
                    </div>
                  </div>
                  <span className="tag text-[10px] px-2 py-1 rounded-lg" style={{ background: `${STATUS_COLORS[p.status] || 'var(--ink-300)'}18`, color: STATUS_COLORS[p.status] || 'var(--ink-300)' }}>
                    {STATUS_NAMES[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">待办事项</h3>
            <div className="space-y-2">
              {(g.pendingGrading ?? 0) > 0 && (
                <div onClick={() => router.push('/grading')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--fox-glow)]">
                  <span className="text-[var(--fox)]">📝</span>
                  <span className="text-xs text-[var(--ink-600)]">{g.pendingGrading} 份阅卷待完成</span>
                </div>
              )}
              {(g.pendingAppeals ?? 0) > 0 && (
                <div onClick={() => router.push('/exams/appeals')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--verm-glow)]">
                  <span className="text-[var(--verm)]">⚖️</span>
                  <span className="text-xs text-[var(--ink-600)]">{g.pendingAppeals} 个申诉待审核</span>
                </div>
              )}
              {(g.pendingCerts ?? 0) > 0 && (
                <div onClick={() => router.push('/certificates/applications')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--fox-glow)]">
                  <span className="text-[var(--fox)]">🏅</span>
                  <span className="text-xs text-[var(--ink-600)]">{g.pendingCerts} 份证书记审批</span>
                </div>
              )}
              {(g.pendingGrading ?? 0) === 0 && (g.pendingAppeals ?? 0) === 0 && (g.pendingCerts ?? 0) === 0 && (
                <p className="text-xs text-[var(--ink-300)]">暂无待办事项 ✅</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => router.push('/programs/new')} className="btn btn-fox btn-xs">➕ 新建培训班</button>
              <button onClick={() => router.push('/exams')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📋 安排考试</button>
              <button onClick={() => router.push('/certificates')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">🎓 发证</button>
              <button onClick={() => router.push('/admin/statistics')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📊 数据中心</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Exam Officer Dashboard
// ═══════════════════════════════════════════
