'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import Loading from '@/components/Loading';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

// ── 类型 ──
interface ExamTrendItem {
  examId: number;
  examTitle: string;
  totalScore: number;
  myScore: number | null;
  submittedAt: string | null;
}

interface KpMasteryItem {
  kpId: number;
  kpName: string;
  rate: number;
  level: string;
}

interface HoursDistItem {
  typeName: string;
  hours: number;
}

interface WeakAreaItem {
  kpId: number;
  kpName: string;
  rate: number;
  level: string;
}

interface DailyActivity {
  date: string;
  examCount: number;
  studyHours: number;
  videoHours: number;
  practiceCount: number;
}

interface ProgramProgressItem {
  programId: number;
  programName: string;
  completedCourses: number;
  totalCourses: number;
  progressRate: number;
}

interface LearningReport {
  examTrend: ExamTrendItem[];
  kpMastery: KpMasteryItem[];
  hoursDistribution: HoursDistItem[];
  weakAreas: WeakAreaItem[];
  streak: {
    totalActiveDays: number;
    currentStreak: number;
    lastActiveDate: string | null;
  };
  dailyActivity: DailyActivity[];
  recent30DayActive: number;
  programProgress: ProgramProgressItem[];
  summary: {
    passRate: number;
    passed: number;
    failed: number;
    pending: number;
    totalHours: number;
    approvedHours: number;
    pendingHours: number;
    rejectedHours: number;
    certificateCount: number;
    avgScore: number;
  };
}

// ── 常量 ──
const LEVEL_COLORS: Record<string, string> = {
  '优秀': '#2e7d32',
  '良好': '#558b2f',
  '一般': '#f59e0b',
  '薄弱': '#ef4444',
  '危险': '#dc2626',
};

const LEVEL_LABELS: Record<string, string> = {
  '优秀': '优秀',
  '良好': '良好',
  '一般': '一般',
  '薄弱': '薄弱',
  '危险': '危险',
};

const WEAK_GRADIENT = 'linear-gradient(90deg, #ef4444, #dc2626)';
const PIE_COLORS = ['#e87a30', '#558b2f', '#00897b', '#f59e0b', '#8b8174', '#a67f2a'];

const chartTooltipStyle = {
  background: 'var(--paper-dark)',
  border: '1px solid var(--ink-200)',
  borderRadius: '8px',
  fontSize: '12px',
  padding: '8px 12px',
};

// ── 辅助函数 ──
function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ── 各等级进度条颜色 ──
function masteryBarColor(level: string): string {
  return LEVEL_COLORS[level] || '#8b8174';
}

// ── 自定义 Tooltip ──
function CustomLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={chartTooltipStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink-700)' }}>{label}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} style={{ color: entry.color, fontSize: 12 }}>
          {entry.name}: {entry.value}分
        </div>
      ))}
    </div>
  );
}

// ── 主页面 ──
export default function LearningReportPage() {
  const router = useRouter();
  const [data, setData] = useState<LearningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceTrend, setPracticeTrend] = useState<any[]>([]);
  const [activeKps, setActiveKps] = useState<string[]>([]);
  const [topKps, setTopKps] = useState<string[]>([]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const res = await fetch('/api/student/exams/learning-report', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error(`加载失败 (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      const trendRes = await fetch('/api/questions/practice/trend?days=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setPracticeTrend(trendData);
        // Extract top 5 KPs by total practice count
        const kpCounts: Record<string, number> = {};
        trendData.forEach((d: any) => {
          if (d.kpBreakdown) {
            Object.entries(d.kpBreakdown).forEach(([kp, stats]: [string, any]) => {
              kpCounts[kp] = (kpCounts[kp] || 0) + (stats.totalQuestions || 0);
            });
          }
        });
        const sorted = Object.entries(kpCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([kp]) => kp);
        setTopKps(sorted);
        setActiveKps(sorted);
      }
    } catch (e: any) {
      setError(e.message || '加载学习报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // ── Loading ──
  if (loading) {
    return (
      <AppLayout>
        <Loading text="小狐狸正在加载学习报告…" />
      </AppLayout>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <AppLayout>
        <div className="card"><ErrorCard message={error} onRetry={loadReport} /></div>
      </AppLayout>
    );
  }

  const summary = data?.summary;
  const examTrend = data?.examTrend || [];
  const kpMastery = data?.kpMastery || [];
  const hoursDist = data?.hoursDistribution || [];
  const weakAreas = data?.weakAreas || [];
  const streak = data?.streak;
  const dailyActivity = data?.dailyActivity || [];
  const programProgress = data?.programProgress || [];

  // ── Line chart data ──
  const lineData = examTrend.map(e => ({
    name: truncate(e.examTitle || '', 16),
    score: e.myScore ?? 0,
  }));

  // ── Pie chart data ──
  const pieData = hoursDist.map(h => ({
    name: h.typeName || '其他',
    value: h.hours,
  }));

  // ── Bar chart data (knowledge mastery, horizontal) ──
  const kpData = kpMastery.map(k => ({
    name: k.kpName,
    rate: k.rate,
    level: k.level,
  }));

  // ── Weak areas (sorted ascending by rate, take 5) ──
  const topWeak = [...weakAreas]
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  // ── Daily activity columns ──
  const today = new Date();
  const last7Days: { date: string; label: string; activity: DailyActivity | undefined }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const activity = dailyActivity.find(a => a.date === dateStr);
    last7Days.push({ date: dateStr, label, activity });
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-6">

        {/* ════════ 1. 标题 ════════ */}
        <div className="mb-2">
          <h1 className="page-title">📊 学习报告</h1>
          <p className="page-subtitle">学习数据全景 · 考试趋势 · 掌握分析</p>
        </div>

        {/* ════════ 2. 摘要卡片 ════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 考试通过率 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'var(--fox-pale)' }}>
                📋
              </div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-400)' }}>
                考试通过率
              </span>
            </div>
            <div className="stat-card-value">
              {summary ? summary.passRate : 0}%
            </div>
            <div className="flex gap-3 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
              <span>通过 <strong style={{ color: '#2e7d32' }}>{summary?.passed || 0}</strong></span>
              <span>未通过 <strong style={{ color: '#ef4444' }}>{summary?.failed || 0}</strong></span>
              <span>待评分 <strong style={{ color: '#e87a30' }}>{summary?.pending || 0}</strong></span>
            </div>
          </div>

          {/* 总学时 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'var(--fox-pale)' }}>
                🕐
              </div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-400)' }}>
                总学时
              </span>
            </div>
            <div className="stat-card-value">
              {summary?.totalHours || 0}
              <span className="text-base font-normal ml-1" style={{ color: 'var(--ink-400)' }}>h</span>
            </div>
            <div className="flex gap-3 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
              <span>已审核 <strong style={{ color: '#2e7d32' }}>{summary?.approvedHours || 0}</strong></span>
              <span>待审核 <strong style={{ color: '#e87a30' }}>{summary?.pendingHours || 0}</strong></span>
              <span>已驳回 <strong style={{ color: '#ef4444' }}>{summary?.rejectedHours || 0}</strong></span>
            </div>
          </div>

          {/* 证书 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'var(--fox-pale)' }}>
                🏅
              </div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-400)' }}>
                证书数
              </span>
            </div>
            <div className="stat-card-value">
              {summary?.certificateCount || 0}
            </div>
            <div className="mt-2">
              <button onClick={() => router.push('/my-certificates')}
                className="text-xs" style={{ color: '#e87a30', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                查看全部证书 →
              </button>
            </div>
          </div>

          {/* 平均分 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'var(--fox-pale)' }}>
                📊
              </div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-400)' }}>
                平均分
              </span>
            </div>
            <div className="stat-card-value">
              {summary?.avgScore ?? 0}
              <span className="text-base font-normal ml-1" style={{ color: 'var(--ink-400)' }}>分</span>
            </div>
          </div>
        </div>

        {/* ════════ 3. 练习正确率趋势 ════════ */}
        <div className="card p-5">
          <h2 className="section-title">练习正确率趋势</h2>
          {practiceTrend.length < 3 ? (
            <div
              onClick={() => router.push('/practice')}
              className="flex flex-col items-center justify-center py-12 cursor-pointer"
              style={{ color: 'var(--ink-300)' }}
            >
              <p className="text-xs">
                继续练习，积累更多记录后自动生成趋势图 →
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={practiceTrend.map((d: any) => ({
                    ...d,
                    dateLabel: (() => {
                      const dt = new Date(d.date);
                      return `${dt.getMonth() + 1}/${dt.getDate()}`;
                    })(),
                  }))}
                  margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: 'var(--ink-400)' }}
                    axisLine={{ stroke: 'var(--ink-100)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'var(--ink-400)' }}
                    axisLine={{ stroke: 'var(--ink-100)' }}
                    tickLine={false}
                    tickFormatter={(v: any) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload;
                      return (
                        <div style={chartTooltipStyle}>
                          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink-700)' }}>
                            {label}
                          </div>
                          <div style={{ color: '#e87a30', fontSize: 12 }}>
                            正确率: {data?.accuracy ?? 0}%
                          </div>
                          <div style={{ color: 'var(--ink-400)', fontSize: 12 }}>
                            总题数: {data?.totalQuestions ?? 0}
                          </div>
                          <div style={{ color: 'var(--ink-400)', fontSize: 12 }}>
                            正确: {data?.correctCount ?? 0}
                          </div>
                          {payload.slice(1).map((entry: any, idx: number) => (
                            <div key={idx} style={{ color: entry.color, fontSize: 12 }}>
                              {entry.name}: {entry.value}%
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'var(--ink-500)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="每日正确率"
                    stroke="#e87a30"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#e87a30', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#e87a30' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={() => 60}
                    name="合格线 (60%)"
                    stroke="#8b8174"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={false}
                  />
                  {topKps.map((kp, idx) => (
                    activeKps.includes(kp) && (
                      <Line
                        key={kp}
                        type="monotone"
                        dataKey={(d: any) => d.kpBreakdown?.[kp]?.accuracy ?? null}
                        name={kp}
                        stroke={PIE_COLORS[idx]}
                        strokeWidth={1.5}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* KP filter buttons */}
              {topKps.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {topKps.map((kp, idx) => (
                    <button
                      key={kp}
                      onClick={() => {
                        setActiveKps(prev =>
                          prev.includes(kp)
                            ? prev.filter(k => k !== kp)
                            : [...prev, kp]
                        );
                      }}
                      className="text-xs px-3 py-1.5 rounded-full transition-all"
                      style={{
                        background: activeKps.includes(kp) ? `${PIE_COLORS[idx]}22` : 'var(--paper-dark)',
                        color: activeKps.includes(kp) ? PIE_COLORS[idx] : 'var(--ink-400)',
                        border: `1px solid ${activeKps.includes(kp) ? PIE_COLORS[idx] : 'transparent'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {kp}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ════════ 4. 知识点掌握度 ════════ */}
        <div className="card p-5">
          <h2 className="section-title">知识点掌握度</h2>
          {kpData.length === 0 ? (
            <EmptyState icon="🧠" title="暂无知识点数据" size="small" />
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
              <ResponsiveContainer width="100%" height={Math.max(kpData.length * 44, 120)}>
                <BarChart
                  data={kpData}
                  layout="vertical"
                  margin={{ top: 4, right: 100, left: 120, bottom: 4 }}
                  barSize={24}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'var(--ink-400)' }}
                    axisLine={{ stroke: 'var(--ink-100)' }}
                    tickLine={false}
                    tickFormatter={(v: any) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--ink-500)' }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, '掌握率']}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar
                    dataKey="rate"
                    name="掌握率"
                    radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right',
                      formatter: ((value: any, entry: any) => `${value}% · ${entry?.payload?.level}`) as any,
                      fill: 'var(--ink-600)',
                      fontSize: 11,
                    }}
                  >
                    {kpData.map((entry, idx) => (
                      <Cell key={idx} fill={masteryBarColor(entry.level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ════════ 5. 学时分布 + 薄弱环节 (两列) ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 左：学时分布 PieChart */}
          <div className="card p-5">
            <h2 className="section-title">学时分布</h2>
            {pieData.length === 0 ? (
              <EmptyState icon="🕐" title="暂无学时数据" size="small" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }: any) => `${name} ${value}h`}
                      labelLine
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} h`, name]}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center text-xs mt-2" style={{ color: 'var(--ink-400)' }}>
                  总审核学时 <strong style={{ color: 'var(--ink-700)' }}>{summary?.approvedHours || 0}</strong> h
                </div>
              </>
            )}
          </div>

          {/* 右：薄弱环节 */}
          <div className="card p-5">
            <h2 className="section-title">薄弱环节</h2>
            {topWeak.length === 0 ? (
              <EmptyState icon="👍" title="暂无明显薄弱环节，继续保持" size="small" />
            ) : (
              <div className="space-y-4">
                {topWeak.map((kp, idx) => (
                  <div
                    key={kp.kpId}
                    onClick={() => router.push('/practice')}
                    className="cursor-pointer p-3 rounded-lg transition-all hover:shadow-sm"
                    style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>
                        {idx + 1}. {kp.kpName}
                      </span>
                      <span
                        className="tag text-xs font-medium"
                        style={{
                          background: `${masteryBarColor(kp.level)}22`,
                          color: masteryBarColor(kp.level),
                          border: `1px solid ${masteryBarColor(kp.level)}44`,
                        }}
                      >
                        {kp.level}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${kp.rate}%`,
                          background: kp.rate < 40
                            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                            : kp.rate < 60
                              ? 'linear-gradient(90deg, #f59e0b, #e87a30)'
                              : 'linear-gradient(90deg, #558b2f, #2e7d32)',
                        }}
                      />
                    </div>
                    <div className="text-right text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                      掌握率 {kp.rate}%
                    </div>
                  </div>
                ))}
                <div className="text-center mt-2">
                  <button onClick={() => router.push('/practice')}
                    className="text-xs" style={{ color: '#e87a30', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                    去练习巩固 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════ 6. 学习活跃度 ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左：连续学习 */}
          <div className="card p-5">
            <h2 className="section-title">学习活跃度</h2>
            <div className="flex items-start gap-6 flex-wrap">
              <div className="text-center">
                <div className="stat-card-value">{streak?.totalActiveDays ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>累计活跃天数</div>
              </div>
              <div className="text-center">
                <div className="stat-card-value" style={{ color: 'var(--fox)' }}>{streak?.currentStreak ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>当前连续</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium" style={{ color: 'var(--ink-500)' }}>
                  {streak?.lastActiveDate
                    ? new Date(streak.lastActiveDate).toLocaleDateString('zh-CN')
                    : '—'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>最近活跃</div>
              </div>
            </div>
          </div>

          {/* 右：近7天明细 */}
          <div className="card p-5">
            <h2 className="section-title">近7天学习明细</h2>
            {last7Days.length === 0 ? (
              <EmptyState icon="📅" title="暂无学习记录" size="small" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--ink-400)' }}>
                        <th className="text-left pb-2 font-medium">日期</th>
                        <th className="text-center pb-2 font-medium">考试</th>
                        <th className="text-center pb-2 font-medium">学时</th>
                        <th className="text-center pb-2 font-medium">视频</th>
                        <th className="text-center pb-2 font-medium">练习</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last7Days.map((day, idx) => (
                        <tr key={day.date} className="border-t" style={{ borderColor: 'rgba(139,129,116,0.12)' }}>
                          <td className="py-2 pr-2 font-medium" style={{ color: 'var(--ink-600)' }}>
                            {day.label}
                          </td>
                          <td className="py-2 text-center" style={{ color: 'var(--ink-400)' }}>
                            {day.activity && day.activity.examCount > 0 ? day.activity.examCount : '—'}
                          </td>
                          <td className="py-2 text-center" style={{ color: 'var(--ink-400)' }}>
                            {day.activity && day.activity.studyHours > 0 ? `${day.activity.studyHours}h` : '—'}
                          </td>
                          <td className="py-2 text-center" style={{ color: 'var(--ink-400)' }}>
                            {day.activity && day.activity.videoHours > 0 ? `${day.activity.videoHours}h` : '—'}
                          </td>
                          <td className="py-2 text-center" style={{ color: 'var(--ink-400)' }}>
                            {day.activity && day.activity.practiceCount > 0 ? day.activity.practiceCount : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-right text-xs" style={{ color: 'var(--ink-400)' }}>
                  + 近30天共活跃 <strong style={{ color: 'var(--ink-600)' }}>{data?.recent30DayActive ?? 0}</strong> 天
                </div>
              </>
            )}
          </div>
        </div>

        {/* ════════ 7. 培训班进度 ════════ */}
        {programProgress.length > 0 && (
          <div className="card p-5">
            <h2 className="section-title">培训班进度</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {programProgress.map((prog) => (
                <div
                  key={prog.programId}
                  className="p-4 rounded-lg"
                  style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}
                >
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--ink-700)' }}>
                    {prog.programName}
                  </div>
                  <div className="w-full h-2 rounded-full mb-2" style={{ background: 'var(--paper-dark)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${prog.progressRate}%`,
                        background: prog.progressRate >= 80
                          ? 'linear-gradient(90deg, #558b2f, #2e7d32)'
                          : prog.progressRate >= 50
                            ? 'linear-gradient(90deg, #f59e0b, #e87a30)'
                            : 'linear-gradient(90deg, #e87a30, #c9601e)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--ink-400)' }}>
                    <span>进度 {prog.progressRate}%</span>
                    <span>
                      <strong style={{ color: 'var(--ink-600)' }}>{prog.completedCourses}</strong> / {prog.totalCourses} 课程
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
