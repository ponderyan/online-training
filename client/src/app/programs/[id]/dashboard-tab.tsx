'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Recharts
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── 类型 ──
interface DashboardData {
  overview: {
    enrollCount: number;
    examCount: number;
    passCount: number;
    passRate: number | null;
  };
  scoreDistribution: { range: string; count: number }[];
  typeAccuracy: { type: string; label: string; total: number; correct: number; rate: number }[];
  funnel: {
    enrolled: number;
    examined: number;
    passed: number;
    certified: number;
  };
  leaderboard: { rank: number; studentName: string; score: number; certStatus: string }[];
}

// ── 主题色 ──
const FOX = '#e87a30';
const CYAN = '#00897b';
const SAGE = '#558b2f';
const GOLD = '#f9a825';
const ROSE = '#e5393588';
const INK_300 = '#999';
const INK_400 = '#777';
const INK_600 = '#444';

const CARD_STYLE = { background: 'var(--paper)', border: '1px solid var(--ink-200)', borderRadius: '10px' };

// ── 数字卡片 ──
function StatCard({ value, label, suffix, color }: { value: number | string; label: string; suffix?: string; color?: string }) {
  return (
    <div className="p-4 text-center" style={CARD_STYLE}>
      <div className="text-3xl font-bold" style={{ color: color || 'var(--ink-700)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-sm font-normal ml-1" style={{ color: INK_400 }}>{suffix}</span>}
      </div>
      <div className="text-xs mt-1.5" style={{ color: INK_400 }}>{label}</div>
    </div>
  );
}

// ── 空状态 ──
function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="card p-8 text-center" style={CARD_STYLE}>
      <div className="text-sm" style={{ color: INK_300 }}>{message}</div>
      {sub && <div className="text-xs mt-1" style={{ color: INK_300 }}>{sub}</div>}
    </div>
  );
}

// ── 工具：Tooltip 公共样式 ──
const chartTooltipStyle = {
  background: 'var(--paper-dark)',
  border: '1px solid var(--ink-200)',
  borderRadius: '8px',
  fontSize: '12px',
};

// ── 转换漏斗（自定义渲染）──
function FunnelSection({ label, value, pct, color, barWidth }: { label: string; value: number; pct: string; color: string; barWidth: number }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="text-xs text-right" style={{ width: 64, color: INK_400, flexShrink: 0 }}>{label}</div>
      <div className="flex-1 flex items-center gap-2">
        <div style={{ height: 28, width: `${Math.max(barWidth, 4)}%`, background: color, borderRadius: '4px', transition: 'width 0.5s ease', minWidth: 20 }} />
        <span className="text-sm font-semibold" style={{ color: INK_600, whiteSpace: 'nowrap' }}>{value.toLocaleString()}</span>
        {pct && <span className="text-xs" style={{ color: INK_300, whiteSpace: 'nowrap' }}>({pct})</span>}
      </div>
    </div>
  );
}

// ── 主组件 ──
export default function DashboardTab({ programId }: { programId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.trainingPrograms.getDashboard(Number(programId));
      setData(d);
    } catch (e: any) {
      setError(e.message || '加载仪表盘失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [programId]);

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="card p-12 text-center text-xs" style={{ color: INK_300, ...CARD_STYLE }}>
        小狐狸正在加载数据… 🦊
      </div>
    );
  }

  // ── 错误态 ──
  if (error) {
    return (
      <div className="card p-8 text-center" style={CARD_STYLE}>
        <div className="text-sm" style={{ color: '#e53935' }}>加载失败</div>
        <div className="text-xs mt-2" style={{ color: INK_400 }}>{error}</div>
        <button onClick={load} className="btn btn-fox btn-xs mt-3">重试</button>
      </div>
    );
  }

  // ── 完全无数据态（培训班刚创建，啥都没有）──
  const hasAnyData = data && (data.overview.enrollCount > 0 || data.overview.examCount > 0);
  if (!hasAnyData) {
    return (
      <div className="card p-12 text-center" style={CARD_STYLE}>
        <div className="text-base mb-2">📊</div>
        <div className="text-sm" style={{ color: INK_300 }}>培训班进行中，暂无数据</div>
        <div className="text-xs mt-1" style={{ color: INK_300 }}>考试后将自动生成数据</div>
      </div>
    );
  }

  const { overview, scoreDistribution, typeAccuracy, funnel, leaderboard } = data!;

  // ── 漏斗百分比计算 ──
  const funnelPct = (num: number, denom: number) =>
    denom > 0 ? `${Math.round((num / denom) * 100)}%` : '—';

  return (
    <div className="space-y-5">
      {/* ═══ 顶部概览：4 个数字卡片 ═══ */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard value={overview.enrollCount} label="报名人数" color={FOX} />
        <StatCard
          value={overview.examCount}
          label="参考人数"
          color={CYAN}
          suffix={overview.enrollCount > 0 ? `/ ${overview.enrollCount}` : ''}
        />
        <StatCard value={overview.passCount} label="通过人数" color={SAGE} />
        <StatCard
          value={overview.passRate !== null ? `${overview.passRate}` : '—'}
          label="通过率"
          suffix={overview.passRate !== null ? '%' : ''}
          color={GOLD}
        />
      </div>

      {/* ═══ 中排：分数段分布 + 题型正确率 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左：分数段分布 */}
        <div className="card p-5" style={CARD_STYLE}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: INK_600 }}>成绩分数段分布</h3>
          {scoreDistribution.every(s => s.count === 0) ? (
            <EmptyState message="暂无考试数据" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={scoreDistribution} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-200)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: INK_400 }} axisLine={{ stroke: 'var(--ink-200)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: INK_400 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: any) => [value, '人数']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {scoreDistribution.map((entry, i) => {
                    const color = entry.range === '0-59' ? ROSE
                      : entry.range === '60-69' ? GOLD
                      : entry.range === '70-79' ? FOX
                      : entry.range === '80-89' ? CYAN
                      : SAGE;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 右：题型正确率 */}
        <div className="card p-5" style={CARD_STYLE}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: INK_600 }}>各题型正确率</h3>
          {typeAccuracy.length === 0 ? (
            <EmptyState message="暂无答题数据" />
          ) : (
            <div className="space-y-3">
              {typeAccuracy.map(t => (
                <div key={t.type}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs" style={{ color: INK_400 }}>{t.label}</span>
                    <span className="text-xs font-medium" style={{ color: t.rate >= 70 ? SAGE : t.rate >= 40 ? FOX : ROSE }}>
                      {t.rate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{
                      width: `${t.rate}%`,
                      background: t.rate >= 70 ? SAGE : t.rate >= 40 ? FOX : ROSE,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ 底排：转化漏斗 + 排行榜 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左：转化漏斗 */}
        <div className="card p-5" style={CARD_STYLE}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: INK_600 }}>报名→出证 转化漏斗</h3>
          {funnel.enrolled === 0 ? (
            <EmptyState message="培训班进行中，暂无数据" />
          ) : (
            <div className="pt-2 pb-2">
              <FunnelSection label="报名" value={funnel.enrolled} pct="" color={FOX}
                barWidth={100} />
              <FunnelSection label="已考试" value={funnel.examined} pct={funnelPct(funnel.examined, funnel.enrolled)} color={CYAN}
                barWidth={funnel.enrolled > 0 ? (funnel.examined / funnel.enrolled) * 100 : 0} />
              <FunnelSection label="通过" value={funnel.passed} pct={funnelPct(funnel.passed, funnel.examined)} color={SAGE}
                barWidth={funnel.examined > 0 ? (funnel.passed / funnel.examined) * 100 : 0} />
              <FunnelSection label="已出证" value={funnel.certified} pct={funnelPct(funnel.certified, funnel.passed)} color={GOLD}
                barWidth={funnel.passed > 0 ? (funnel.certified / funnel.passed) * 100 : 0} />
            </div>
          )}
        </div>

        {/* 右：排行榜 TOP 10 */}
        <div className="card p-5" style={CARD_STYLE}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: INK_600 }}>学员成绩排行 TOP 10</h3>
          {leaderboard.length === 0 ? (
            <EmptyState message="暂无成绩数据" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: INK_300 }}>
                    <th className="text-left pb-2 font-medium">排名</th>
                    <th className="text-left pb-2 font-medium">学员姓名</th>
                    <th className="text-right pb-2 font-medium">成绩</th>
                    <th className="text-center pb-2 font-medium">证书</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.rank} className="border-t" style={{ borderColor: 'var(--ink-100)' }}>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                          row.rank <= 3 ? 'text-white' : ''
                        }`} style={{
                          background: row.rank === 1 ? GOLD : row.rank === 2 ? INK_400 : row.rank === 3 ? FOX : 'var(--ink-100)',
                          color: row.rank <= 3 ? '#fff' : INK_400,
                        }}>
                          {row.rank}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: INK_600 }}>{row.studentName}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: row.score >= 80 ? SAGE : row.score >= 60 ? FOX : ROSE }}>
                        {row.score}
                      </td>
                      <td className="py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          row.certStatus === '已发放'
                            ? 'bg-green-50 text-green-700'
                            : row.certStatus !== '—'
                            ? 'bg-yellow-50 text-yellow-700'
                            : ''
                        }`} style={{
                          background: row.certStatus === '已发放' ? '#00897b18' : row.certStatus !== '—' ? '#f9a82518' : 'transparent',
                          color: row.certStatus === '已发放' ? '#00897b' : row.certStatus !== '—' ? '#f9a825' : INK_300,
                        }}>
                          {row.certStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
