// 学时分布 + 薄弱环节两列卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import EmptyState from '@/components/EmptyState';
import { PIE_COLORS, chartTooltipStyle, masteryBarColor } from './report-constants';
import type { WeakAreaItem } from './report-types';

export function HoursWeakCard({ pieData, topWeak, approvedHours, onGoPractice }: {
  pieData: { name: string; value: number }[];
  topWeak: WeakAreaItem[];
  approvedHours: number;
  onGoPractice: () => void;
}) {
  return (
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
            <div className="text-[var(--ink-400)] text-center text-xs mt-2">
              总审核学时 <strong className="text-[var(--ink-700)]">{approvedHours}</strong> h
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
                onClick={onGoPractice}
                className="cursor-pointer p-3 rounded-lg transition-all hover:shadow-sm bg-[var(--paper)]"
                style={{  border: '1px solid var(--ink-100)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--ink-700)] text-sm font-medium">
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
                <div className="bg-[var(--paper-dark)] w-full h-2 rounded-full">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${kp.rate}%`,
                      background: kp.rate < 40
                        ? 'linear-gradient(90deg, var(--verm-light), var(--verm))'
                        : kp.rate < 60
                          ? 'linear-gradient(90deg, var(--gold-light), var(--fox))'
                          : 'linear-gradient(90deg, var(--sage-light), var(--sage))',
                    }}
                  />
                </div>
                <div className="text-[var(--ink-400)] text-right text-xs mt-1">
                  掌握率 {kp.rate}%
                </div>
              </div>
            ))}
            <div className="text-center mt-2">
              <button onClick={onGoPractice}
                className="text-xs text-[var(--fox)]" style={{  textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                去练习巩固 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
