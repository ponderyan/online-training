'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = { INTERNAL: '内部讲师', EXTERNAL: '外聘讲师' };
const TYPE_COLORS: Record<string, string> = { INTERNAL: '#1565c0', EXTERNAL: '#e87a30' };
const LEVEL_NAMES: Record<string, string> = { JUNIOR: '初级', MIDDLE: '中级', SENIOR: '高级', EXPERT: '专家' };

export default function InstructorDetail() {
  const params = useParams();
  const router = useRouter();
  const [inst, setInst] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.instructors.get(Number(params.id)),
      api.instructors.getStats(Number(params.id)).catch(() => null),
    ]).then(([i, s]) => { setInst(i); setStats(s); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;
  if (!inst) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>讲师不存在</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push('/instructors')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回讲师列表</button>

      {/* Info card */}
      <div className="card p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold flex-shrink-0" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
            {inst.realName?.[0] || '👨‍🏫'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--ink-700)' }}>{inst.realName}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[inst.type] || '#888'}18`, color: TYPE_COLORS[inst.type] || '#888' }}>
                {TYPE_NAMES[inst.type] || inst.type}
              </span>
              {inst.instructorNo && <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>#{inst.instructorNo}</span>}
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs mt-3">
              {[
                { label: '工作单位', value: inst.workUnit },
                { label: '职称', value: inst.title },
                { label: '级别', value: LEVEL_NAMES[inst.level] || inst.level },
                { label: '学历', value: inst.education || '—' },
                { label: '毕业院校', value: inst.school || '—' },
                { label: '手机', value: inst.phone || inst.user?.phone || '—' },
                { label: '邮箱', value: inst.email || inst.user?.email || '—' },
                { label: '性别', value: inst.gender || '—' },
                { label: '状态', value: inst.status === 'ACTIVE' ? '✅ 正常' : '⛔ 停用' },
                { label: '可阅卷', value: inst.isGrader ? '✅ 是' : '❌ 否' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ color: 'var(--ink-400)' }}>{item.label}</div>
                  <div className="font-medium" style={{ color: 'var(--ink-600)' }}>{item.value || '—'}</div>
                </div>
              ))}
            </div>
            {inst.bio && <p className="text-xs mt-3" style={{ color: 'var(--ink-400)' }}>{inst.bio}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { value: stats.totalSchedules, label: '累计授课', color: 'var(--fox)' },
            { value: stats.totalHours, label: '累计课时', color: '#2e7d32' },
            { value: stats.avgInstructorRating ? stats.avgInstructorRating.toFixed(1) + '⭐' : '—', label: '讲师评分', color: '#f59e0b' },
            { value: stats.schedules?.length || 0, label: '课程数', color: '#1565c0' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule list */}
      {stats?.schedules?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-100)' }}>📅 授课记录</div>
          <table className="list-table">
            <thead><tr><th>课程</th><th>培训班</th><th>时间</th><th>课时</th></tr></thead>
            <tbody>
              {stats.schedules.map((s: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{s.courseName || '—'}</td>
                  <td>{s.programName || '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {new Date(s.startTime).toLocaleDateString('zh-CN')}
                  </td>
                  <td>{s.hours || '—'}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
