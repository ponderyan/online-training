'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction } from './shared';

export default function LecturerDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const d = stats?.lecturer;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { value: d.myQuestions ?? '—', label: '我的试题', icon: '📝', color: 'var(--cyan)' },
          { value: d.programCount ?? '—', label: '进行中的培训班', icon: '📋', color: 'var(--fox)' },
          { value: d.pendingGradingCount ?? '—', label: '待阅卷', icon: '📊', color: d.pendingGradingCount > 0 ? 'var(--fox)' : 'var(--sage)' },
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
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">待办事项</h3>
          <div className="space-y-2">
            {(d.pendingGradingCount ?? 0) > 0 && (
              <div onClick={() => router.push('/grading')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--fox-glow)]">
                <span className="text-[var(--fox)]">📝</span>
                <span className="text-xs text-[var(--ink-600)]">{d.pendingGradingCount} 份试卷待批阅</span>
              </div>
            )}
            {(d.pendingGradingCount ?? 0) === 0 && <p className="text-xs text-[var(--ink-300)]">暂无待办事项 ✅</p>}
          </div>
        </div>

        <div className="card p-5 self-start">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => router.push('/questions')} className="btn btn-fox btn-xs">📝 录入试题</button>
            <button onClick={() => router.push('/materials')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📖 教材出题</button>
            <button onClick={() => router.push('/grading')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📊 阅卷</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Proctor Dashboard
// ═══════════════════════════════════════════
