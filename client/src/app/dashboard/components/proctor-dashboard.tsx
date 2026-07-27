'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction } from './shared';

export default function ProctorDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const d = stats?.proctor;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <div className="text-3xl font-bold" style={{ color: d.activeExams > 0 ? 'var(--fox)' : 'var(--sage)' }}>{d.activeExams}</div>
          <div className="text-xs mt-1 text-[var(--ink-400)]">进行中的考试</div>
        </div>
        <div className="card p-5 flex items-center justify-center">
          <button onClick={() => router.push('/proctoring')} className="btn btn-fox w-full text-center py-3">🎥 进入监考中心</button>
        </div>
      </div>

      {d.upcomingExams && d.upcomingExams.length > 0 && (
        <div className="card p-5 mb-8">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">即将开始的考试</h3>
          <div className="space-y-2">
            {d.upcomingExams.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--paper-dark)' }}>
                <span className="text-sm text-[var(--ink-600)]">{e.title}</span>
                <span className="text-xs text-[var(--ink-300)]">
                  {new Date(e.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// Agency Admin Dashboard
// ═══════════════════════════════════════════
