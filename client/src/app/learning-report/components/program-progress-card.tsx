// 培训班进度卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import type { ProgramProgressItem } from './report-types';

export function ProgramProgressCard({ programProgress }: {
  programProgress: ProgramProgressItem[];
}) {
  if (programProgress.length === 0) return null;
  return (
    <div className="card p-5">
      <h2 className="section-title">培训班进度</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {programProgress.map((prog) => (
          <div
            key={prog.programId}
            className="p-4 rounded-lg bg-[var(--paper)]"
            style={{  border: '1px solid var(--ink-100)' }}
          >
            <div className="text-[var(--ink-700)] text-sm font-medium mb-2">
              {prog.programName}
            </div>
            <div className="bg-[var(--paper-dark)] w-full h-2 rounded-full mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${prog.progressRate}%`,
                  background: prog.progressRate >= 80
                    ? 'linear-gradient(90deg, var(--sage-light), var(--sage))'
                    : prog.progressRate >= 50
                      ? 'linear-gradient(90deg, var(--gold-light), var(--fox))'
                      : 'linear-gradient(90deg, var(--fox), var(--fox-dark))',
                }}
              />
            </div>
            <div className="text-[var(--ink-400)] flex justify-between text-xs">
              <span>进度 {prog.progressRate}%</span>
              <span>
                <strong className="text-[var(--ink-600)]">{prog.completedCourses}</strong> / {prog.totalCourses} 课程
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
