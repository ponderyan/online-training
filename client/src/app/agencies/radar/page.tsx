'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip as ReTooltip,
} from 'recharts';

// ── 类型 ──
interface AgencyDim {
  id: number;
  name: string;
  dimensions: Record<string, number | null>;
  dimensionDetails: Record<string, { numerator: number; denominator: number }>;
  totalStudents: number;
  activePrograms: number;
}

interface RadarData {
  agencies: AgencyDim[];
  averages: Record<string, number> | null;
  timeRange: { label: string };
}

// ── 常量 ──
const FOX = '#e87a30';
const INK_300 = '#999';
const INK_400 = '#777';
const INK_600 = '#444';
const INK_100 = '#e8e2da';

const DIMENSION_CONFIG = [
  { key: 'capacityUtilization', label: '招生能力', icon: '🏫', sortOrder: 1 },
  { key: 'attendanceRate', label: '参考率', icon: '📝', sortOrder: 2 },
  { key: 'passRate', label: '通过率', icon: '✅', sortOrder: 3 },
  { key: 'studentActivity', label: '活跃度', icon: '🔥', sortOrder: 4 },
  { key: 'certConversion', label: '证书转化', icon: '📜', sortOrder: 5 },
  { key: 'retention', label: '退学控制', icon: '🛡️', sortOrder: 6 },
];

const DIM_LABELS: Record<string, string> = {
  capacityUtilization: '招生能力', attendanceRate: '参考率', passRate: '通过率',
  studentActivity: '活跃度', certConversion: '证书转化', retention: '退学控制',
};

const QUARTERS = [
  { value: 1, label: 'Q1 (1-3月)' },
  { value: 2, label: 'Q2 (4-6月)' },
  { value: 3, label: 'Q3 (7-9月)' },
  { value: 4, label: 'Q4 (10-12月)' },
];

const CARD_STYLE = { background: 'var(--paper)', border: '1px solid var(--ink-200)', borderRadius: '10px' };

// ── 工具 ──
function scoreColor(v: number | null): string {
  if (v === null) return INK_300;
  if (v >= 80) return '#2e7d32';
  if (v >= 50) return FOX;
  return '#e53935';
}

function shortPct(v: number | null): string {
  if (v === null) return '—';
  return `${v}%`;
}

// ── 空状态 ──
function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="p-12 text-center" style={CARD_STYLE}>
      <div className="text-sm" style={{ color: INK_300 }}>{message}</div>
      {sub && <div className="text-xs mt-1" style={{ color: INK_300 }}>{sub}</div>}
    </div>
  );
}

// ── 主页面 ──
export default function AgencyRadarPage() {
  const router = useRouter();

  // 机构列表
  const [allAgencies, setAllAgencies] = useState<{ id: number; name: string }[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  // 时间选择
  const [timeMode, setTimeMode] = useState<'year' | 'quarter' | 'custom'>('year');
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');

  // 数据
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgencyAdmin, setIsAgencyAdmin] = useState(false);

  // 加载机构列表
  useEffect(() => {
    api.agencies.list().then((r: any) => {
      setAllAgencies(r.items || []);
    }).catch(() => {});
    // 检测是否 AGENCY_ADMIN
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.roles?.includes('AGENCY_ADMIN')) {
          setIsAgencyAdmin(true);
          setSelectedAgencyId(user.primaryAgencyId || null);
        }
      } catch {}
    }
  }, []);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {};
      if (!isAgencyAdmin && selectedAgencyId) params.agencyId = selectedAgencyId;
      if (timeMode === 'year') {
        params.year = year;
      } else if (timeMode === 'quarter') {
        params.year = year;
        params.quarter = quarter;
      } else {
        if (monthStart) params.monthStart = monthStart;
        if (monthEnd) params.monthEnd = monthEnd;
      }
      const result = await api.agencies.radar(params);
      setData(result);
    } catch (e: any) {
      setError(e.message || '加载失败');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedAgencyId, compareMode, timeMode, year, quarter, monthStart, monthEnd]);

  // ── 构建雷达图数据 ──
  const currentAgency = data?.agencies.find(a => a.id === selectedAgencyId) || data?.agencies[0] || null;

  const radarChartData = DIMENSION_CONFIG.map(dim => {
    const point: any = { dimension: dim.label };
    if (currentAgency) {
      point.score = currentAgency.dimensions[dim.key] ?? 0;
    }
    if (compareMode && data?.averages) {
      point.average = data.averages[dim.key] ?? 0;
    }
    return point;
  });

  const hasAverageLine = compareMode && data?.averages && DIMENSION_CONFIG.some(d => (data.averages![d.key] ?? 0) > 0);

  // ── 综合评估 ──
  const evaluations: { type: 'warn' | 'good' | 'info'; text: string }[] = [];
  if (currentAgency) {
    const dims = currentAgency.dimensions;
    const allAbove80 = DIMENSION_CONFIG.every(d => (dims[d.key] ?? 100) >= 80);
    const allZero = DIMENSION_CONFIG.every(d => dims[d.key] === null || dims[d.key] === 0);

    if (allZero) {
      evaluations.push({ type: 'info', text: `${currentAgency.name} 暂无运营数据` });
    } else {
      if (allAbove80) {
        evaluations.push({ type: 'good', text: `🌟 ${currentAgency.name} 各维度表现均衡优秀` });
      }
      for (const dim of DIMENSION_CONFIG) {
        const v = dims[dim.key];
        if (v !== null && v < 30) {
          evaluations.push({ type: 'warn', text: `⚠️ ${currentAgency.name} 的【${dim.label}】偏低（${v}%），建议重点关注` });
        }
        if (v !== null && v === 0) {
          evaluations.push({ type: 'warn', text: `⚠️ ${currentAgency.name} 的【${dim.label}】为 0，请核实数据` });
        }
      }
      if (dims.retention === 100) {
        evaluations.push({ type: 'good', text: `✅ ${currentAgency.name} 本年度退学率为 0` });
      }
    }

    if (currentAgency.totalStudents === 1) {
      evaluations.push({ type: 'info', text: `ℹ️ 样本量不足（${currentAgency.totalStudents} 人），数据仅供参考` });
    }
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/agencies')} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>← 返回</button>
          <h1 className="page-title mb-0">📡 机构质量雷达</h1>
        </div>
      </div>

      {/* ═══ 筛选区 ═══ */}
      <div className="p-4 mb-6 flex flex-wrap items-center gap-4" style={CARD_STYLE}>
        {/* 机构选择 */}
        {!isAgencyAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: INK_400 }}>机构</label>
            <select value={selectedAgencyId ?? ''} onChange={e => setSelectedAgencyId(e.target.value ? parseInt(e.target.value) : null)}
              className="input select text-xs" style={{ minWidth: 160 }}>
              <option value="">全部机构</option>
              {allAgencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {/* 时间模式 */}
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: INK_400 }}>时间</label>
          <select value={timeMode} onChange={e => setTimeMode(e.target.value as any)}
            className="input select text-xs" style={{ width: 100 }}>
            <option value="year">年度</option>
            <option value="quarter">季度</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        {timeMode === 'year' && (
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="input text-xs" style={{ width: 90 }} />
        )}

        {timeMode === 'quarter' && (
          <>
            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="input text-xs" style={{ width: 90 }} />
            <select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}
              className="input select text-xs" style={{ width: 120 }}>
              {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </>
        )}

        {timeMode === 'custom' && (
          <>
            <input type="month" value={monthStart} onChange={e => setMonthStart(e.target.value)}
              className="input text-xs" style={{ width: 140 }} placeholder="开始月" />
            <span className="text-xs" style={{ color: INK_300 }}>~</span>
            <input type="month" value={monthEnd} onChange={e => setMonthEnd(e.target.value)}
              className="input text-xs" style={{ width: 140 }} placeholder="结束月" />
          </>
        )}

        {/* 对比模式 */}
        {selectedAgencyId && (
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: INK_400 }}>
            <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)}
              className="cursor-pointer" />
            与平均值对比
          </label>
        )}
      </div>

      {/* ═══ 数据区域 ═══ */}
      {loading && (
        <div className="text-center py-16 text-xs" style={{ color: INK_300 }}>
          小狐狸正在计算机构质量指数… 🦊
        </div>
      )}

      {error && (
        <div className="card p-8 text-center max-w-md mx-auto" style={CARD_STYLE}>
          <div className="text-sm" style={{ color: '#e53935' }}>加载失败</div>
          <div className="text-xs mt-2" style={{ color: INK_400 }}>{error}</div>
          <button onClick={loadData} className="btn btn-fox btn-xs mt-3">重试</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.agencies.length === 0 ? (
            <EmptyState message="该时间范围内暂无机构数据" sub="请调整时间范围后重试" />
          ) : !currentAgency ? (
            <EmptyState message="暂无招生机构数据" sub="请先创建招生机构" />
          ) : (
            <>
              {/* 时间范围显示 */}
              <div className="text-xs mb-4" style={{ color: INK_400 }}>
                查询时段：{data.timeRange.label} · 当前机构：{currentAgency.name}
                {currentAgency.totalStudents > 0 && ` · ${currentAgency.totalStudents} 名学员 · ${currentAgency.activePrograms} 个活跃培训班`}
              </div>

              {/* ═══ 雷达图 + 详情表 ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 雷达图 */}
                <div className="card p-5" style={CARD_STYLE}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: INK_600 }}>六维能力雷达图</h3>
                  <ResponsiveContainer width="100%" height={380}>
                    <RadarChart data={radarChartData}>
                      <PolarGrid stroke={INK_100} />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: INK_400 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]}
                        tick={{ fontSize: 10, fill: INK_300 }}
                        tickCount={6} />
                      <ReTooltip
                        contentStyle={{ background: 'var(--paper-dark)', border: '1px solid var(--ink-200)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`]}
                      />
                      <Radar
                        name={currentAgency.name}
                        dataKey="score"
                        stroke={FOX}
                        fill={FOX}
                        fillOpacity={0.15}
                      />
                      {hasAverageLine && (
                        <Radar
                          name="行业平均"
                          dataKey="average"
                          stroke={INK_300}
                          strokeDasharray="4 4"
                          fill="none"
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* 维度明细表 */}
                <div className="card p-5" style={CARD_STYLE}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: INK_600 }}>维度明细</h3>
                  {currentAgency.totalStudents === 0 ? (
                    <EmptyState message="该机构暂无运营数据" />
                  ) : (
                    <div className="space-y-0 overflow-hidden rounded-lg" style={{ border: '1px solid var(--ink-100)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs" style={{ background: 'var(--paper-dark)', color: INK_400 }}>
                            <th className="text-left px-3 py-2 font-medium">维度</th>
                            <th className="text-right px-3 py-2 font-medium">得分</th>
                            <th className="text-right px-3 py-2 font-medium">明细</th>
                            <th className="text-center px-3 py-2 font-medium">趋势</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...DIMENSION_CONFIG]
                            .map(dim => ({ dim, val: currentAgency!.dimensions[dim.key], detail: currentAgency!.dimensionDetails[dim.key] }))
                            .sort((a, b) => {
                              if (a.val === null && b.val === null) return 0;
                              if (a.val === null) return 1;
                              if (b.val === null) return -1;
                              return a.val - b.val;
                            })
                            .map(({ dim, val, detail }) => (
                              <tr key={dim.key} className="border-t" style={{ borderColor: 'var(--ink-100)' }}>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', background: scoreColor(val) }} />
                                    <span className="text-xs" style={{ color: INK_600 }}>{dim.icon} {dim.label}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: scoreColor(val) }}>
                                  {shortPct(val)}
                                </td>
                                <td className="px-3 py-2 text-right text-xs" style={{ color: INK_400 }}>
                                  {detail ? `${detail.numerator} / ${detail.denominator}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-center text-xs" style={{ color: INK_300 }}>—</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ 综合评价 ═══ */}
              {evaluations.length > 0 && (
                <div className="card p-5" style={CARD_STYLE}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: INK_600 }}>综合评价</h3>
                  <div className="space-y-2">
                    {evaluations.map((ev, i) => (
                      <div key={i} className="p-3 rounded-lg text-xs" style={{
                        background: ev.type === 'warn' ? '#e5393508' : ev.type === 'good' ? '#2e7d3208' : '#f9a82508',
                        border: `1px solid ${
                          ev.type === 'warn' ? '#e5393544' : ev.type === 'good' ? '#2e7d3244' : '#f9a82544'
                        }`,
                        color: ev.type === 'warn' ? '#e53935' : ev.type === 'good' ? '#2e7d32' : FOX,
                      }}>
                        {ev.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}
