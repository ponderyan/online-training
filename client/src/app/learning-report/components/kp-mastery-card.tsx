// 知识点掌握度卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import EmptyState from '@/components/EmptyState';
import { chartTooltipStyle, masteryBarColor } from './report-constants';

export function KpMasteryCard({ kpData }: {
  kpData: { name: string; rate: number; level: string }[];
}) {
  return (
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
  );
}
