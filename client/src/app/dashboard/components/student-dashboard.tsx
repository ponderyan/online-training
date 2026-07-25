'use client';
import { useRouter } from 'next/navigation';
import { StatCard, TodoItem, QuickAction, STATUS_NAMES, STATUS_COLORS } from './shared';

export default function StudentDashboard({ user, studentExams, studentStats, loading }: any) {
  const router = useRouter();
  if (loading) return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;

  const now = new Date();
  const activeExams = studentExams?.filter((e: any) => e.sessionStatus === 'ACTIVE') || [];
  const nextExam = studentExams?.filter((e: any) => !e.submittedAt && new Date(e.startTime) > now)
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  const recentDone = studentExams?.filter((e: any) => e.submittedAt)
    .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 3) || [];

  const formatCount = (d: Date) => {
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return '已开始';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}天后`;
    return `${h}时${m}分后`;
  };

  return (
    <>
      {studentStats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="card p-4 text-center" style={{ border: activeExams.length > 0 ? '2px solid var(--fox)' : undefined }}>
            <div className="text-2xl font-bold" style={{ color: activeExams.length > 0 ? 'var(--fox)' : 'var(--ink-500)' }}>
              {activeExams.length}{activeExams.length > 0 && <span className="text-xs ml-1 text-[var(--fox)]">进行中</span>}
            </div>
            <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">考试中</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-[var(--cyan)]">{studentStats.pending}</div>
            <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">待考</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-[var(--sage)]">{studentStats.completed}</div>
            <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">已完成</div>
          </div>
          <div className="card p-4 text-center">
            {studentStats.certificateCount != null ? (
              <>
                <div className="text-2xl font-bold text-[var(--gold)]">{studentStats.certificateCount}</div>
                <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">证书 🏆</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-[var(--gold)]">{(studentStats.completed / Math.max(studentStats.total, 1) * 100).toFixed(0)}%</div>
                <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">完成率</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 快速入口 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <QuickAction icon="📝" label="去考试" href="/exam" primary router={router} />
        <QuickAction icon="📖" label="去学习" href="/learning-center" router={router} />
        <QuickAction icon="📊" label="看成绩" href="/exam/results" router={router} />
        <QuickAction icon="🏆" label="证书" href="/my-certificates" router={router} />
        <QuickAction icon="🦊" label="AI 助教" href="/ai/assistant" router={router} />
        <QuickAction icon="📈" label="学习报告" href="/learning-report" router={router} />
      </div>

      {activeExams.length > 0 && (
        <div className="rounded-xl p-5 mb-6 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--fox-pale), var(--fox-glow))', border: '1.5px solid var(--fox)' }}>
          <div className="flex items-center gap-4">
            <span className="text-3xl">📝</span>
            <div>
              <p className="font-bold text-sm text-[var(--ink-700)]">你有 {activeExams.length} 场考试正在进行</p>
              <p className="text-xs mt-0.5 text-[var(--ink-400)]">{activeExams[0].title} · 点击继续答题</p>
            </div>
          </div>
          <button onClick={() => router.push('/exam')} className="btn btn-fox btn-sm">继续考试 →</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">即将到来的考试</h3>
          {!nextExam ? (
            <p className="text-xs text-[var(--ink-300)]">暂无安排</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--ink-700)]">{nextExam.title}</p>
              <p className="text-xs mt-1 text-[var(--ink-400)]">{new Date(nextExam.startTime).toLocaleString('zh-CN')} · {formatCount(new Date(nextExam.startTime))}</p>
              <button onClick={() => router.push('/exam')} className="btn btn-outline btn-xs mt-3">查看全部考试 →</button>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">学习进度</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--ink-500)]">已参加的考试</span>
              <span className="font-bold">{studentStats?.completed || 0} / {studentStats?.total || 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--ink-500)]">学习中心</span>
              <button onClick={() => router.push('/learning-center')} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]">去学习 →</button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--ink-500)]">我的证书</span>
              <button onClick={() => router.push('/my-certificates')} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]">查看 →</button>
            </div>
          </div>
        </div>
      </div>

      {/* 待办事项 */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 text-[var(--ink-700)]">📋 待办事项</h3>
        {activeExams.length > 0 ? (
          <TodoItem dot="verm" text={`你有 ${activeExams.length} 场考试正在进行，请尽快完成`} href="/exam" urgent router={router} />
        ) : nextExam ? (
          <TodoItem dot="fox" text={`「${nextExam.title}」${formatCount(new Date(nextExam.startTime))}，请提前准备`} href="/exam" router={router} />
        ) : (
          <TodoItem dot="cyan" text="暂无紧急待办，可以开始学习新课程" href="/learning-center" router={router} />
        )}
        {recentDone.length > 0 && (
          <TodoItem dot="cyan" text={`学习报告已更新，最近完成 ${recentDone[0].title}`} href="/learning-report" router={router} />
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Global Admin Dashboard (SUPER_ADMIN / ORG_ADMIN)
// ═══════════════════════════════════════════
