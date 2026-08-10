// 学习活跃度 + 近7天明细两列卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import EmptyState from '@/components/EmptyState';
import type { DailyActivity, LearningReport } from './report-types';

export function ActivityCard({ streak, dailyActivity, recent30DayActive }: {
  streak: LearningReport['streak'] | undefined;
  dailyActivity: DailyActivity[];
  recent30DayActive: number;
}) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左：连续学习 */}
      <div className="card p-5">
        <h2 className="section-title">学习活跃度</h2>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="text-center">
            <div className="stat-card-value">{streak?.totalActiveDays ?? 0}</div>
            <div className="text-[var(--ink-400)] text-xs mt-1">累计活跃天数</div>
          </div>
          <div className="text-center">
            <div className="text-[var(--fox)] stat-card-value">{streak?.currentStreak ?? 0}</div>
            <div className="text-[var(--ink-400)] text-xs mt-1">当前连续</div>
          </div>
          <div className="text-center">
            <div className="text-[var(--ink-500)] text-sm font-medium">
              {streak?.lastActiveDate
                ? new Date(streak.lastActiveDate).toLocaleDateString('zh-CN')
                : '—'}
            </div>
            <div className="text-[var(--ink-400)] text-xs mt-1">最近活跃</div>
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
                  <tr className="text-[var(--ink-400)]">
                    <th className="text-left pb-2 font-medium">日期</th>
                    <th className="text-center pb-2 font-medium">考试</th>
                    <th className="text-center pb-2 font-medium">学时</th>
                    <th className="text-center pb-2 font-medium">视频</th>
                    <th className="text-center pb-2 font-medium">练习</th>
                  </tr>
                </thead>
                <tbody>
                  {last7Days.map((day, idx) => (
                    <tr key={day.date} className="border-t border-[rgba(139,129,116,0.12)]" >
                      <td className="text-[var(--ink-600)] py-2 pr-2 font-medium">
                        {day.label}
                      </td>
                      <td className="text-[var(--ink-400)] py-2 text-center">
                        {day.activity && day.activity.examCount > 0 ? day.activity.examCount : '—'}
                      </td>
                      <td className="text-[var(--ink-400)] py-2 text-center">
                        {day.activity && day.activity.studyHours > 0 ? `${day.activity.studyHours}h` : '—'}
                      </td>
                      <td className="text-[var(--ink-400)] py-2 text-center">
                        {day.activity && day.activity.videoHours > 0 ? `${day.activity.videoHours}h` : '—'}
                      </td>
                      <td className="text-[var(--ink-400)] py-2 text-center">
                        {day.activity && day.activity.practiceCount > 0 ? day.activity.practiceCount : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[var(--ink-400)] mt-3 text-right text-xs">
              + 近30天共活跃 <strong className="text-[var(--ink-600)]">{recent30DayActive}</strong> 天
            </div>
          </>
        )}
      </div>
    </div>
  );
}
