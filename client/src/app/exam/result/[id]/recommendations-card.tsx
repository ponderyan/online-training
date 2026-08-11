'use client';

import { useRouter } from 'next/navigation';
import { LEVEL_COLORS } from './result-constants';

export function RecommendationsCard({ recommendations, maxHeight }: { recommendations: any; maxHeight: number }) {
  const router = useRouter();
  return (
    <div className="rounded-xl p-6 mb-8 bg-[var(--paper-bright)]" style={{
      
      border: '1px solid var(--ink-100)',
      maxHeight: maxHeight > 0 ? maxHeight : undefined,
      overflowY: 'auto',
    }}>
      <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">📺 针对薄弱考点推荐课程</h3>
      {recommendations.recommendedCourses.map((group: any) => (
        <div key={group.kpId} className="mb-4 last:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--ink-700)]">{group.kpName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{
              background: `color-mix(in srgb, ${(LEVEL_COLORS[group.level] || 'var(--gold)')} 10%, transparent)`,
              color: LEVEL_COLORS[group.level] || 'var(--gold)',
            }}>
              {group.level}
            </span>
          </div>
          <div className="space-y-1.5">
            {group.courses.map((course: any) => (
              <div key={course.id} className="flex items-center justify-between p-2.5 rounded-lg text-xs bg-[var(--paper)]" style={{
                
                border: '1px solid var(--ink-100)',
              }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[var(--ink-600)]">{course.title}</span>
                  {course.duration != null && (
                    <span className="flex-shrink-0 text-[var(--ink-300)]">{course.duration}分钟</span>
                  )}
                </div>
                <button onClick={() => router.push(`/video/${course.id}`)}
                  className="text-xs px-2.5 py-1 rounded-md border-none cursor-pointer font-medium flex-shrink-0 ml-2 bg-[var(--fox)] text-white">
                  去学习
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
