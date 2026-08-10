// 练习正确率趋势卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PIE_COLORS, chartTooltipStyle } from './report-constants';

export function PracticeTrendCard({ practiceTrend, topKps, activeKps, onToggleKp, onGoPractice }: {
  practiceTrend: any[];
  topKps: string[];
  activeKps: string[];
  onToggleKp: (kp: string) => void;
  onGoPractice: () => void;
}) {
  return (
    <div className="card p-5">
      <h2 className="section-title">练习正确率趋势</h2>
      {practiceTrend.length < 3 ? (
        <div
          onClick={onGoPractice}
          className="flex flex-col items-center justify-center py-12 cursor-pointer text-[var(--ink-300)]"
          
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
                      <div className="text-[var(--ink-700)]" style={{ fontWeight: 600, marginBottom: 4,  }}>
                        {label}
                      </div>
                      <div className="text-[var(--fox)]" style={{  fontSize: 12 }}>
                        正确率: {data?.accuracy ?? 0}%
                      </div>
                      <div className="text-[var(--ink-400)]" style={{  fontSize: 12 }}>
                        总题数: {data?.totalQuestions ?? 0}
                      </div>
                      <div className="text-[var(--ink-400)]" style={{  fontSize: 12 }}>
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
                stroke="var(--fox)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--fox)', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'var(--fox)' }}
              />
              <Line
                type="monotone"
                dataKey={() => 60}
                name="合格线 (60%)"
                stroke="var(--ink-300)"
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
                  onClick={() => onToggleKp(kp)}
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
  );
}
