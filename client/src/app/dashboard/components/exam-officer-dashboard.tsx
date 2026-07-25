'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction } from './shared';

export default function ExamOfficerDashboard({ stats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
  const d = stats?.examOfficer;
  if (!d) return null;

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: d.totalQuestions ?? '—', label: '题库总量', icon: '📝', color: 'var(--cyan)' },
          { value: d.totalPapers ?? '—', label: '试卷总数', icon: '📄', color: 'var(--gold)' },
          { value: d.examCount ?? '—', label: '考试场次', icon: '📋', color: 'var(--fox)' },
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
        <div className="space-y-4 col-span-2">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">待办事项</h3>
            <div className="space-y-2">
              {(d.pendingGradingCount ?? 0) > 0 && (
                <div onClick={() => router.push('/grading')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--fox-glow)]">
                  <span className="text-[var(--fox)]">📝</span>
                  <span className="text-xs text-[var(--ink-600)]">{d.pendingGradingCount} 份试卷待阅卷</span>
                </div>
              )}
              {(d.pendingAppeals ?? 0) > 0 && (
                <div onClick={() => router.push('/exams/appeals')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer bg-[var(--verm-glow)]">
                  <span className="text-[var(--verm)]">⚖️</span>
                  <span className="text-xs text-[var(--ink-600)]">{d.pendingAppeals} 个申诉待审核</span>
                </div>
              )}
              {(d.pendingGradingCount ?? 0) === 0 && (d.pendingAppeals ?? 0) === 0 && (
                <p className="text-xs text-[var(--ink-300)]">暂无待办事项 ✅</p>
              )}
            </div>
          </div>

          {d.upcomingExams && d.upcomingExams.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">即将到来的考试</h3>
              <div className="space-y-2">
                {d.upcomingExams.map((e: any) => (
                  <div key={e.id} onClick={() => router.push(`/exams/${e.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer" style={{ background: 'var(--paper-dark)' }}>
                    <span className="text-sm font-medium text-[var(--ink-600)]">{e.title}</span>
                    <span className="text-xs text-[var(--ink-300)]">
                      {new Date(e.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 self-start">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">快速操作</h3>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => router.push('/questions')} className="btn btn-fox btn-xs">📝 录入试题</button>
            <button onClick={() => router.push('/generate')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">✨ 智能组卷</button>
            <button onClick={() => router.push('/exams')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📋 安排考试</button>
            <button onClick={() => router.push('/grading')} className="btn btn-sm btn-xs border border-[var(--ink-100)]">📊 阅卷中心</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Lecturer Dashboard
// ═══════════════════════════════════════════
