'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ProgramStat {
  studentId: number;
  displayName: string;
  studentNumber: string;
  totalHours: number;
  videoHours: number;
  offlineHours: number;
  pendingHours: number;
  approvedHours: number;
  rejectedHours: number;
  videos: number;
}

export default function HoursTab({ programId }: { programId: string }) {
  const [stats, setStats] = useState<ProgramStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = parseInt(programId);
    if (isNaN(id)) return;
    api.learningHours.programStats(id)
      .then((data: any) => setStats(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [programId]);

  if (loading) return <div className="card p-8 text-center"><p className="text-[var(--ink-300)]">小狐狸正在加载… 🦊</p></div>;
  if (stats.length === 0) return <div className="card p-8 text-center"><p className="text-[var(--ink-300)]">暂无学时记录</p></div>;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="border-[var(--ink-200)] px-5 py-3 border-b text-sm font-semibold">学员学时统计</div>
      <div className="overflow-x-auto">
      <table className="list-table">
        <thead><tr><th>序号</th><th>姓名</th><th>学号</th><th>🎬 视频</th><th>🏢 线下</th><th>⏳ 待审核</th><th>✅ 已通过</th><th>❌ 已驳回</th><th>合计</th></tr></thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.studentId}>
              <td className="text-[var(--ink-300)] text-xs">{i + 1}</td>
              <td className="font-medium text-sm">{s.displayName}</td>
              <td className="text-[var(--ink-400)] text-xs">{s.studentNumber || '—'}</td>
              <td>{s.videoHours}</td><td>{s.offlineHours}</td>
              <td>{s.pendingHours > 0 ? <span className="text-[var(--fox)] text-xs font-medium">{s.pendingHours}</span> : <span className="text-[var(--ink-300)] text-xs">0</span>}</td>
              <td className="text-[var(--sage)]">{s.approvedHours}</td>
              <td className="text-[var(--error)]">{s.rejectedHours}</td>
              <td className="text-[var(--fox)] font-bold">{s.totalHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
