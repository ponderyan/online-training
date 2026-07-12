'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

// ── 统计卡片组件 ──
function StatCard({ icon, value, label, color, badge, urgent }: {
  icon: string; value: string | number; label: string;
  color: 'fox' | 'cyan' | 'sage' | 'gold';
  badge?: string; urgent?: boolean;
}) {
  const colorMap = {
    fox: { bar: 'bg-[var(--fox)]', value: 'text-[var(--fox)]' },
    cyan: { bar: 'bg-[var(--cyan)]', value: 'text-[var(--cyan)]' },
    sage: { bar: 'bg-[var(--sage)]', value: 'text-[var(--sage)]' },
    gold: { bar: 'bg-[var(--gold)]', value: 'text-[var(--gold-dark)]' },
  };
  const c = colorMap[color];
  return (
    <div className="relative overflow-hidden rounded-card border border-[var(--ink-100)] bg-[var(--paper-bright)] p-5 transition-all hover:shadow-md hover:border-[var(--fox)] hover:-translate-y-px">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${c.bar}`} />
      <span className="block mb-2 text-2xl">{icon}</span>
      <div className={`font-serif text-[1.9rem] font-bold leading-tight ${c.value}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--ink-400)]">{label}</div>
      {badge && (
        <span className={`absolute top-4 right-4 rounded border px-2 py-px text-[0.62rem] ${
          urgent ? 'border-[var(--verm)] text-[var(--verm)] bg-[var(--verm-glow)]' : 'border-[var(--ink-100)] text-[var(--ink-300)]'
        }`}>{badge}</span>
      )}
    </div>
  );
}

// ── 待办事项组件 ──
function TodoItem({ dot, text, href, urgent, router }: {
  dot: 'fox' | 'verm' | 'cyan'; text: string; href: string; urgent?: boolean; router: any;
}) {
  const dotMap = { fox: 'bg-[var(--fox)]', verm: 'bg-[var(--verm)]', cyan: 'bg-[var(--cyan)]' };
  return (
    <div onClick={() => router.push(href)}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded cursor-pointer transition-colors mb-1.5 last:mb-0 ${
        urgent ? 'bg-[var(--verm-glow)] hover:bg-[rgba(217,54,74,0.14)]' : 'hover:bg-[var(--paper-dark)]'
      }`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[dot]}`} />
      <span className="flex-1 text-xs text-[var(--ink-600)]">{text}</span>
      <span className="text-xs text-[var(--ink-400)]">→</span>
    </div>
  );
}

// ── 快捷操作组件 ──
function QuickAction({ icon, label, href, primary, router }: {
  icon: string; label: string; href: string; primary?: boolean; router: any;
}) {
  return (
    <button onClick={() => router.push(href)}
      className={`flex items-center gap-2.5 px-4 py-3.5 rounded text-xs font-medium transition-all ${
        primary
          ? 'bg-[var(--fox)] border border-[var(--fox)] text-white hover:bg-[var(--fox-dark)]'
          : 'bg-[var(--paper-bright)] border border-[var(--ink-100)] text-[var(--ink-700)] hover:border-[var(--fox)] hover:bg-[var(--fox-glow)] hover:text-[var(--fox-dark)] hover:-translate-y-px'
      }`}>
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  PREPARING: '#8b8174', ENROLLING: 'var(--cyan)', IN_PROGRESS: 'var(--fox)',
  REVIEWING: 'var(--fox)', CERTIFYING: 'var(--gold)', COMPLETED: 'var(--sage)', CANCELLED: 'var(--ink-300)',
};

// ═══════════════════════════════════════════
// Student Dashboard
// ═══════════════════════════════════════════
function StudentDashboard({ user, studentExams, studentStats, loading }: any) {
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
      <div className="mb-8">
        <h1 className="page-title">🎓 我的学习</h1>
        <p className="page-subtitle">{user?.displayName}，欢迎回来 🐾</p>
      </div>

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
            <div className="text-2xl font-bold text-[var(--gold)]">{(studentStats.completed / Math.max(studentStats.total, 1) * 100).toFixed(0)}%</div>
            <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">完成率</div>
          </div>
        </div>
      )}

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
    </>
  );
}

// ═══════════════════════════════════════════
// Global Admin Dashboard (SUPER_ADMIN / ORG_ADMIN)
// ═══════════════════════════════════════════
function GlobalAdminDashboard({ stats, loading }: any) {
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
function ExamOfficerDashboard({ stats, loading }: any) {
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
function LecturerDashboard({ stats, loading }: any) {
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
function ProctorDashboard({ stats, loading }: any) {
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
function AgencyAdminDashboard({ stats, loading }: any) {
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
function AuditorDashboard({ stats, loading }: any) {
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
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--fox)' }} />
                <span>{log.action}</span>
                <span className="text-[10px] text-[var(--ink-300)]">{log.entityType || '—'}</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--ink-200)' }}>
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
export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
  const [studentExams, setStudentExams] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    let parsed: any = null;
    if (u) {
      parsed = JSON.parse(u);
      setUser(parsed);
      setRole((parsed?.roles && parsed.roles[0]) || parsed?.role || '');
    }

    const isStudent = parsed && (parsed.roles?.includes('STUDENT') || parsed.role === 'STUDENT')
      && !parsed.roles?.some((r: string) =>
        ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR'].includes(r)
      );

    if (isStudent) {
      fetch('/api/student/exams', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()).then((data: any) => {
        const list = Array.isArray(data) ? data : [];
        setStudentExams(list);
        const active = list.filter((e: any) => e.sessionStatus === 'ACTIVE').length;
        const pending = list.filter((e: any) => !e.submittedAt && e.sessionStatus !== 'ACTIVE' && new Date(e.startTime) > new Date()).length;
        const completed = list.filter((e: any) => e.submittedAt).length;
        setStudentStats({ active, pending, completed, total: list.length });
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()).then((data: any) => {
        setStats(data);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, []);

  const isStudent = role === 'STUDENT';

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="page-title">{greeting()}</h1>
          <span className="text-lg text-[var(--fox)]">{user?.displayName ? `，${user.displayName}` : ''}</span>
        </div>
        <p className="page-subtitle">
          {isStudent ? '🎓 我的学习'
            : role === 'EXAM_OFFICER' ? '📋 考务工作台'
            : role === 'LECTURER' ? '📚 教学工作台'
            : role === 'PROCTOR' ? '🎥 监考工作台'
            : role === 'AGENCY_ADMIN' ? '🏢 机构工作台'
            : role === 'AUDITOR' ? '🔍 审计工作台'
            : '📊 数据概览'}
          · {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {isStudent ? (
        <StudentDashboard user={user} studentExams={studentExams} studentStats={studentStats} loading={loading} />
      ) : !stats && loading ? (
        <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>
      ) : role === 'EXAM_OFFICER' ? (
        <ExamOfficerDashboard stats={stats} loading={loading} />
      ) : role === 'LECTURER' ? (
        <LecturerDashboard stats={stats} loading={loading} />
      ) : role === 'PROCTOR' ? (
        <ProctorDashboard stats={stats} loading={loading} />
      ) : role === 'AGENCY_ADMIN' ? (
        <AgencyAdminDashboard stats={stats} loading={loading} />
      ) : role === 'AUDITOR' ? (
        <AuditorDashboard stats={stats} loading={loading} />
      ) : (
        <GlobalAdminDashboard stats={stats} loading={loading} />
      )}
    </AppLayout>
  );
}
