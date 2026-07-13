'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import CountUp from '@/components/CountUp';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface ExamOverview {
  totalExams: number;
  totalAttempts: number;
  passedAttempts: number;
  passRate: number;
  avgScore: number;
  recentTrend: { date: string; attempts: number; passed: number; passRate: number }[];
}

interface HoursOverview {
  totalStudents: number;
  totalRecords: number;
  totalApprovedHours: number;
  approvedRate: number;
  agencyBreakdown: { agencyId: number; agencyName: string; studentCount: number; totalHours: number }[];
}

interface CertOverview {
  totalIssued: number;
  totalRevoked: number;
  monthlyBreakdown: { month: string; issued: number; revoked: number }[];
}

interface StudentActivity {
  totalStudents: number;
  activeThisMonth: number;
  completionRate: number;
  inactiveCount: number;
}

interface DashboardData {
  examOverview: ExamOverview | null;
  hoursOverview: HoursOverview | null;
  certOverview: CertOverview | null;
  studentActivity: StudentActivity | null;
}

type FetchState = 'loading' | 'error' | 'loaded';

// ═══════════════════════════════════════════
// Helper — auth headers
// ═══════════════════════════════════════════
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  if (token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  return {};
}

// ═══════════════════════════════════════════
// Trend calculation helper
// ═══════════════════════════════════════════
function calcTrend(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (previous === 0) return current > 0 ? 'up' : 'flat';
  const diff = ((current - previous) / previous) * 100;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'flat';
}

// ═══════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════
function KpiCard({
  title,
  value,
  unit,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  unit?: string;
  trend: 'up' | 'down' | 'flat';
  trendLabel?: string;
}) {
  const trendColors: Record<string, string> = {
    up: '#2e7d32',
    down: '#c62828',
    flat: 'var(--ink-400)',
  };
  const trendIcons: Record<string, string> = {
    up: '↑',
    down: '↓',
    flat: '—',
  };

  // 解析数值与小数位，供 CountUp 使用
  const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const decimals = typeof value === 'string' && value.includes('.')
    ? (value.split('.')[1]?.length || 0)
    : 0;

  return (
    <div
      className="card p-5 rounded-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink-100)',
      }}
    >
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-400)' }}>
        {title}
      </div>
      <div className="flex items-baseline gap-1">
        <CountUp
          value={numValue}
          decimals={decimals}
          className="text-4xl font-bold"
          style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-serif)' }}
        />
        {unit && (
          <span className="text-sm" style={{ color: 'var(--ink-400)' }}>
            {unit}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className="text-sm font-semibold"
          style={{ color: trendColors[trend] }}
        >
          {trendIcons[trend]}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ink-400)' }}>
          {trendLabel || '较上期'}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Agency Breakdown Table
// ═══════════════════════════════════════════
function AgencyTable({
  data,
}: {
  data: { agencyId: number; agencyName: string; studentCount: number; totalHours: number }[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--ink-300)' }}>
        暂无机构数据
      </div>
    );
  }

  const maxHours = Math.max(...data.map((d) => d.totalHours), 1);

  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--ink-400)' }}>
            <th className="text-left pb-3 font-medium">机构名称</th>
            <th className="text-center pb-3 font-medium">学员数</th>
            <th className="text-center pb-3 font-medium">学时总数</th>
            <th className="text-left pb-3 font-medium">占比</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.agencyId} className="border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <td className="py-3 pr-4" style={{ color: 'var(--ink-600)' }}>
                {row.agencyName}
              </td>
              <td className="py-3 text-center" style={{ color: 'var(--ink-500)' }}>
                {row.studentCount}
              </td>
              <td className="py-3 text-center font-semibold" style={{ color: 'var(--fox)' }}>
                {row.totalHours}
              </td>
              <td className="py-3 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full flex-1" style={{ background: 'var(--ink-100)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.totalHours / maxHours) * 100}%`,
                        background: 'var(--fox)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] w-10 text-right" style={{ color: 'var(--ink-400)' }}>
                    {maxHours > 0 ? Math.round((row.totalHours / maxHours) * 100) : 0}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════
// SVG Trend Chart — exam pass rate
// ═══════════════════════════════════════════
function TrendChart({
  data,
}: {
  data: { date: string; passRate: number }[];
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm" style={{ color: 'var(--ink-300)' }}>
        暂无趋势数据
      </div>
    );
  }

  const padding = { top: 24, right: 24, bottom: 40, left: 44 };
  const width = 720;
  const height = 240;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxRate = Math.max(...data.map((d) => d.passRate), 100);
  const minRate = Math.min(...data.map((d) => d.passRate), 0);
  const yRange = Math.max(maxRate - minRate, 10);
  const yMin = Math.max(0, minRate - yRange * 0.1);
  const yMax = Math.min(100, maxRate + yRange * 0.1);
  const yDiff = yMax - yMin;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - ((v - yMin) / yDiff) * chartH;

  // Y-axis grid lines (5 lines)
  const yGridLines = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yDiff / 4) * i;
    return { value: Math.round(val), y: yScale(val) };
  });

  // Polyline points
  const points = data
    .map((d, i) => `${xScale(i)},${yScale(d.passRate)}`)
    .join(' ');

  // X-axis labels — show ~6 evenly spaced
  const xLabelCount = Math.min(6, data.length);
  const xLabelStep = Math.max(1, Math.floor(data.length / xLabelCount));
  const xLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < data.length; i += xLabelStep) {
    const d = data[i];
    const dateLabel = d.date.slice(5); // MM-DD
    xLabels.push({ label: dateLabel, x: xScale(i) });
  }
  // Always include the last label
  const last = data.length - 1;
  if (xLabels.length === 0 || xLabels[xLabels.length - 1].x < xScale(last)) {
    xLabels.push({ label: data[last].date.slice(5), x: xScale(last) });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ maxHeight: height }}>
      {/* Grid lines */}
      {yGridLines.map((gl) => (
        <g key={gl.value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={gl.y}
            y2={gl.y}
            stroke="var(--ink-100)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={gl.y + 4}
            textAnchor="end"
            fill="var(--ink-400)"
            fontSize={10}
          >
            {gl.value}%
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((xl, i) => (
        <text
          key={i}
          x={xl.x}
          y={height - 8}
          textAnchor="middle"
          fill="var(--ink-400)"
          fontSize={10}
        >
          {xl.label}
        </text>
      ))}

      {/* Area fill under polyline */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e87a30" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#e87a30" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding.left},${padding.top + chartH} ${points} ${xScale(data.length - 1)},${padding.top + chartH}`}
        fill="url(#areaGrad)"
      />

      {/* Trend line */}
      <polyline
        points={points}
        fill="none"
        stroke="#e87a30"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.passRate)}
          r={3}
          fill="#fff"
          stroke="#e87a30"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════
// Main Dashboard Page
// ═══════════════════════════════════════════
export default function AdminDashboard() {
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<DashboardData>({
    examOverview: null,
    hoursOverview: null,
    certOverview: null,
    studentActivity: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  const fetchAll = () => {
    setFetchState('loading');
    setError('');

    const headers = getAuthHeaders();
    const endpoints = [
      '/api/stats/exam-overview',
      '/api/stats/hours-overview',
      '/api/stats/cert-overview',
      '/api/stats/student-activity',
    ] as const;

    Promise.all(
      endpoints.map((url) =>
        fetch(url, { headers })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            return r.json();
          })
          .catch((e) => {
            throw new Error(`${url} — ${e.message}`);
          })
      )
    )
      .then(([examOverview, hoursOverview, certOverview, studentActivity]) => {
        setData({ examOverview, hoursOverview, certOverview, studentActivity });
        setFetchState('loaded');
      })
      .catch((e) => {
        setError(e.message || '加载统计数据失败');
        setFetchState('error');
      });
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // ── Compute KPI values with trends ──
  const passRate = data.examOverview?.passRate ?? 0;
  const approvedRate = data.hoursOverview?.approvedRate ?? 0;
  const certIssued = data.certOverview?.totalIssued ?? 0;
  const activeStudents = data.studentActivity?.activeThisMonth ?? 0;

  // Trend comparison: compare latest vs first half (roughly)
  const trend = data.examOverview?.recentTrend ?? [];
  const mid = Math.floor(trend.length / 2);
  const firstHalf = trend.slice(0, mid).filter((d) => d.passRate > 0);
  const secondHalf = trend.slice(mid).filter((d) => d.passRate > 0);
  const avgFirst =
    firstHalf.length > 0
      ? firstHalf.reduce((s, d) => s + d.passRate, 0) / firstHalf.length
      : 0;
  const avgSecond =
    secondHalf.length > 0
      ? secondHalf.reduce((s, d) => s + d.passRate, 0) / secondHalf.length
      : 0;
  const passRateTrend = calcTrend(avgSecond, avgFirst);

  // Hours trend: compare approved vs total
  const hoursTrend = calcTrend(approvedRate, 50);

  // Cert trend: compare this month vs last month
  const monthly = data.certOverview?.monthlyBreakdown ?? [];
  const lastMonth =
    monthly.length > 0 ? monthly[monthly.length - 1].issued : 0;
  const prevMonth =
    monthly.length > 1 ? monthly[monthly.length - 2].issued : 0;
  const certTrend = calcTrend(lastMonth, prevMonth);

  // Student activity trend
  const totalStudents = data.studentActivity?.totalStudents ?? 0;
  const activityRate =
    totalStudents > 0
      ? (activeStudents / totalStudents) * 100
      : 0;
  const activityRatePrev = 50; // rough baseline
  const activityTrend = calcTrend(activityRate, activityRatePrev);

  // ── Render ──
  return (
    <AppLayout>
      {/* Row 1: Title */}
      <div className="mb-8">
        <h1 className="page-title">📊 运营概览</h1>
        <p className="page-subtitle">
          平台统计 · 数据分析 · {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Loading */}
      {fetchState === 'loading' && (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>
          <div className="text-4xl mb-4">🦊</div>
          <p>小狐狸正在加载统计数据…</p>
        </div>
      )}

      {/* Error */}
      {fetchState === 'error' && (
        <div className="card p-8 text-center rounded-xl" style={{ border: '1px solid rgba(198,40,40,0.2)' }}>
          <div className="text-4xl mb-4">😿</div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--ink-600)' }}>
            加载失败
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>
            {error}
          </p>
          <button
            onClick={() => {
              setRetryCount((c) => c + 1);
            }}
            className="btn btn-fox btn-sm"
          >
            重新加载
          </button>
        </div>
      )}

      {/* Loaded content */}
      {fetchState === 'loaded' && (
        <>
          {/* Row 2: KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <KpiCard
              title="考试通过率"
              value={passRate.toFixed(1)}
              unit="%"
              trend={passRateTrend}
              trendLabel={
                passRateTrend === 'up'
                  ? '较上期上升'
                  : passRateTrend === 'down'
                    ? '较上期下降'
                    : '较上期持平'
              }
            />
            <KpiCard
              title="学时完成率"
              value={approvedRate.toFixed(1)}
              unit="%"
              trend={hoursTrend}
              trendLabel={
                hoursTrend === 'up'
                  ? '较基准上升'
                  : hoursTrend === 'down'
                    ? '较基准下降'
                    : '与基准持平'
              }
            />
            <KpiCard
              title="证书发放"
              value={certIssued}
              trend={certTrend}
              trendLabel={
                monthly.length > 1
                  ? `上月${lastMonth}张`
                  : certTrend === 'up'
                    ? '较上月增长'
                    : certTrend === 'down'
                      ? '较上月下降'
                      : '与上月持平'
              }
            />
            <KpiCard
              title="活跃学员"
              value={activeStudents}
              unit={`/ ${totalStudents}`}
              trend={activityTrend}
              trendLabel={
                activityRate >= 50 ? '本月活跃度良好' : '本月活跃度偏低'
              }
            />
          </div>

          {/* Row 3: Pass Rate Trend Chart */}
          <div className="card p-6 mb-8 rounded-xl" style={{ border: '1px solid var(--ink-100)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>
                  考试通过率趋势
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                  近30天 · 每日考试通过率
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded" style={{ background: '#e87a30' }} />
                  <span>通过率</span>
                </div>
                <div>
                  平均{' '}
                  <span className="font-semibold" style={{ color: 'var(--ink-600)' }}>
                    {trend.length > 0
                      ? `${(trend.reduce((s, d) => s + d.passRate, 0) / trend.length).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
            <TrendChart data={trend} />
          </div>

          {/* Row 4: Agency Breakdown */}
          <div className="card p-6 rounded-xl" style={{ border: '1px solid var(--ink-100)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>
                  机构学时分布
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                  各招生机构已审核学时统计
                </p>
              </div>
              <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                总学时:{' '}
                <span className="font-semibold" style={{ color: 'var(--ink-600)' }}>
                  {data.hoursOverview?.totalApprovedHours ?? 0}
                </span>
              </div>
            </div>
            <AgencyTable data={data.hoursOverview?.agencyBreakdown ?? []} />
          </div>
        </>
      )}
    </AppLayout>
  );
}
