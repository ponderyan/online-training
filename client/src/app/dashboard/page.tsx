'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  PREPARING: '#8b8174', ENROLLING: '#00897b', IN_PROGRESS: '#e87a30',
  REVIEWING: '#e87a30', CERTIFYING: '#7b1fa2', COMPLETED: '#2e7d32', CANCELLED: '#aaa',
};

const QUICK_ACTIONS = [
  { icon: '📝', title: '录入试题', desc: '手动录入 · 批量导入', path: '/questions', color: '#e87a30' },
  { icon: '✨', title: '智能组卷', desc: '配置参数 · 自动生成', path: '/generate', color: '#c9a03a' },
  { icon: '📥', title: '导出试卷', desc: 'Word · 答题卡 · PDF', path: '/papers', color: '#00897b' },
  { icon: '📖', title: '教材出题', desc: '上传PDF → AI生成', path: '/materials', color: '#5a5348' },
];

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');

  // Student-specific state
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

    const isStudent = parsed && (parsed.roles?.includes('STUDENT') || parsed.role === 'STUDENT');
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
      Promise.all([
        api.dashboard.stats().catch(() => null),
      ]).then(([d]) => {
        setStats(d);
      }).finally(() => setLoading(false));
    }
  }, []);

  const isStudent = role === 'STUDENT';

  // ── Student Dashboard ──
  if (isStudent) {
    const now = new Date();
    const activeExams = studentExams.filter((e: any) => e.sessionStatus === 'ACTIVE');
    const nextExam = studentExams
      .filter((e: any) => !e.submittedAt && new Date(e.startTime) > now)
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    const recentDone = studentExams
      .filter((e: any) => e.submittedAt)
      .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 3);

    const formatCount = (d: Date) => {
      const diff = d.getTime() - now.getTime();
      if (diff <= 0) return '已开始';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h >= 24) return `${Math.floor(h / 24)}天后`;
      return `${h}时${m}分后`;
    };

    return (
      <AppLayout>
        <div className="mb-8">
          <h1 className="page-title">🎓 我的学习</h1>
          <p className="page-subtitle">{user?.displayName}，欢迎回来 🐾</p>
        </div>

        {studentStats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="card p-4 text-center" style={{ border: activeExams.length > 0 ? '2px solid var(--fox)' : undefined }}>
              <div className="text-2xl font-bold" style={{ color: activeExams.length > 0 ? 'var(--fox)' : 'var(--ink-500)' }}>
                {activeExams.length}
                {activeExams.length > 0 && <span className="text-xs ml-1" style={{ color: 'var(--fox)' }}>进行中</span>}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>考试中</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: '#1565c0' }}>{studentStats.pending}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>待考</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: '#2e7d32' }}>{studentStats.completed}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>已完成</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: '#7b1fa2' }}>{(studentStats.completed / Math.max(studentStats.total, 1) * 100).toFixed(0)}%</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>完成率</div>
            </div>
          </div>
        )}

        {activeExams.length > 0 && (
          <div className="rounded-xl p-5 mb-6 flex items-center justify-between" style={{
            background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
            border: '2px solid var(--fox)',
          }}>
            <div className="flex items-center gap-4">
              <span className="text-3xl">📝</span>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--ink-700)' }}>
                  你有 {activeExams.length} 场考试正在进行
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                  {activeExams[0].title} · 点击继续答题
                </p>
              </div>
            </div>
            <button onClick={() => router.push(`/exam/take/${activeExams[0].id}`)}
              className="px-5 py-2 rounded-lg text-sm font-bold border-none cursor-pointer"
              style={{ background: 'var(--fox)', color: '#fff' }}>
              继续答题 →
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: '📋', title: '我的考试', desc: '待考 · 进行中 · 已完成', path: '/exam', color: 'var(--fox)' },
            { icon: '🏅', title: '我的证书', desc: '查看已获得的证书', path: '/my-certificates', color: '#7b1fa2' },
            { icon: '📝', title: '练习模式', desc: '不计分 · 不限次 · 看解析', path: '/practice', color: '#00897b' },
            { icon: '📺', title: '学习中心', desc: '视频课程 · 学时追踪', path: '/learning-center', color: '#1565c0' },
          ].map((item, i) => (
            <div key={i} onClick={() => router.push(item.path)}
              className="card p-5 cursor-pointer hover:-translate-y-0.5 transition-all group">
              <div className="text-2xl mb-3">{item.icon}</div>
              <div className="font-bold text-sm" style={{ color: item.color }}>{item.title}</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>
              📅 即将到来的考试
            </h3>
            {nextExam ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink-600)' }}>{nextExam.title}</p>
                  <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>
                    ⏰ {formatCount(new Date(nextExam.startTime))}
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                  {nextExam.paperName} · {nextExam.durationMinutes}分钟 · {new Date(nextExam.startTime).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <button onClick={() => router.push('/exam')}
                  className="mt-3 text-xs font-medium bg-transparent border-none cursor-pointer"
                  style={{ color: 'var(--fox)' }}>
                  查看全部 →
                </button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无待考考试</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>
              🏆 最近成绩
            </h3>
            {recentDone.length > 0 ? (
              <div className="space-y-2">
                {recentDone.map((e: any) => (
                  <div key={e.id} onClick={() => router.push(`/exam/result/${e.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{ background: 'var(--paper-dark)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--ink-600)' }}>{e.title}</p>
                      <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                        {new Date(e.submittedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {e.isPassed === true && <span className="text-xs" style={{ color: '#2e7d32' }}>✅ {e.myFinalScore}分</span>}
                      {e.isPassed === false && <span className="text-xs" style={{ color: '#ef4444' }}>❌ {e.myFinalScore}分</span>}
                      {(e.isPassed === null) && <span className="text-xs" style={{ color: '#f59e0b' }}>⏳ 待阅卷</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--ink-300)' }}>还没有完成过考试</p>
            )}
            {recentDone.length > 0 && (
              <button onClick={() => router.push('/exam')}
                className="mt-3 text-xs font-medium bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--fox)' }}>
                查看全部 →
              </button>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Admin Dashboard ──
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="page-title">🦊 早上好{user ? `，${user.displayName}` : ''}</h1>
        <p className="page-subtitle">📊 数据概览 · {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { value: stats?.activePrograms || '—', label: '进行中的培训班', icon: '📋', color: 'var(--fox)' },
              { value: stats?.totalStudents || '—', label: '学员总数', icon: '👥', color: 'var(--cyan)' },
              { value: stats?.pendingGrading ?? '—', label: '待阅卷', icon: '📝', color: stats?.pendingGrading > 0 ? 'var(--gold)' : 'var(--sage)' },
              { value: stats?.pendingAppeals ?? '—', label: '待审核申诉', icon: '⚖️', color: stats?.pendingAppeals > 0 ? 'var(--verm)' : 'var(--sage)' },
            ].map((s, i) => (
              <div key={i} className="card p-5 flex items-center gap-4">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="card p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>最近培训班</h3>
                <button onClick={() => router.push('/programs')} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>查看更多 →</button>
              </div>
              {(!stats?.recentPrograms || stats.recentPrograms.length === 0) ? (
                <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无培训班</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentPrograms.map((p: any) => (
                    <div key={p.id} onClick={() => router.push(`/programs/${p.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                      style={{ background: 'var(--paper-dark)' }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>{p.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>
                          {p.code} · {p.startDate?.slice(0, 10)} ~ {p.endDate?.slice(0, 10)}
                        </div>
                      </div>
                      <span className="tag text-[10px]" style={{ background: `${STATUS_COLORS[p.status] || '#888'}18`, color: STATUS_COLORS[p.status] || '#888' }}>
                        {STATUS_NAMES[p.status] || p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>待办事项</h3>
                <div className="space-y-2">
                  {(stats?.pendingGrading ?? 0) > 0 && (
                    <div onClick={() => router.push('/grading')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer" style={{ background: 'var(--fox-glow)' }}>
                      <span style={{ color: 'var(--fox)' }}>📝</span>
                      <span className="text-xs" style={{ color: 'var(--ink-600)' }}>{stats.pendingGrading} 份阅卷待完成</span>
                    </div>
                  )}
                  {(stats?.pendingAppeals ?? 0) > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--verm-glow)' }}>
                      <span style={{ color: 'var(--verm)' }}>⚖️</span>
                      <span className="text-xs" style={{ color: 'var(--ink-600)' }}>{stats.pendingAppeals} 个申诉待审核</span>
                    </div>
                  )}
                  {(stats?.pendingCertificates ?? 0) > 0 && (
                    <div onClick={() => router.push('/certificates/applications')} className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer" style={{ background: 'var(--gold-glow)' }}>
                      <span style={{ color: 'var(--gold)' }}>🏅</span>
                      <span className="text-xs" style={{ color: 'var(--ink-600)' }}>{stats.pendingCertificates} 份证书记审批</span>
                    </div>
                  )}
                  {(stats?.pendingGrading ?? 0) === 0 && (stats?.pendingAppeals ?? 0) === 0 && (stats?.pendingCertificates ?? 0) === 0 && (
                    <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无待办事项 ✅</p>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>快速操作</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => router.push('/programs/new')} className="btn btn-fox btn-xs">➕ 新建培训班</button>
                  <button onClick={() => router.push('/exams')} className="btn btn-sm btn-xs" style={{ border: '1px solid var(--ink-200)' }}>📋 安排考试</button>
                  <button onClick={() => router.push('/certificates')} className="btn btn-sm btn-xs" style={{ border: '1px solid var(--ink-200)' }}>🎓 发证</button>
                  <button onClick={() => router.push('/instructors/new')} className="btn btn-sm btn-xs" style={{ border: '1px solid var(--ink-200)' }}>👨‍🏫 新建讲师</button>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>其他功能</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {QUICK_ACTIONS.map((action, i) => (
              <div key={i} onClick={() => router.push(action.path)} className="card p-5 cursor-pointer hover:-translate-y-0.5 transition-all">
                <div className="text-2xl mb-2">{action.icon}</div>
                <div className="font-semibold text-sm" style={{ color: action.color }}>{action.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>{action.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
