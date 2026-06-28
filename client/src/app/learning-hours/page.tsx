'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function LearningHoursPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.learningHours.list(),
      api.learningHours.stats(),
    ]).then(([recordsData, statsData]) => {
      setRecords(recordsData.items || []);
      setStats(statsData);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const sourceLabel = (source: string) => {
    if (source === 'VIDEO') return { icon: '📺', text: '视频', color: '#00897b', bg: '#00897b18' };
    return { icon: '✏️', text: '申报', color: '#e87a30', bg: '#e87a3018' };
  };

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="text-xs" style={{ color: '#2e7d32' }}>✅ 已审核</span>;
    if (status === 'REJECTED') return <span className="text-xs" style={{ color: '#ef4444' }}>❌ 已驳回</span>;
    return <span className="text-xs" style={{ color: '#e87a30' }}>⏳ 待审核</span>;
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📊 我的学时</h1>
        <p className="page-subtitle">查看学习记录和学时统计</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{stats.totalHours}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>总学时（小时）</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: '#00897b' }}>{stats.completedVideos}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>已完成视频</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: '#1565c0' }}>{stats.programStats?.length || 0}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>关联培训班</div>
              </div>
            </div>
          )}

          {stats?.programStats?.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>培训班汇总</div>
              <table className="list-table">
                <thead><tr><th>培训班</th><th>学时</th></tr></thead>
                <tbody>
                  {stats.programStats.map((ps: any) => (
                    <tr key={ps.programId}>
                      <td className="font-medium">{ps.programName}</td>
                      <td>{ps.hours} 小时</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>学习记录</div>
            {records.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无学习记录</div>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>来源</th><th>内容</th><th>培训班</th><th>学时</th><th>状态</th><th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => {
                    const sl = sourceLabel(r.source);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="tag" style={{ background: sl.bg, color: sl.color, fontSize: '11px' }}>
                            {sl.icon} {sl.text}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--ink-600)' }}>
                          {r.source === 'VIDEO' ? (r.videoName || '视频学习') : (r.note || '人工申报')}
                        </td>
                        <td className="text-xs">{r.program?.name || '—'}</td>
                        <td>{r.hours} 小时</td>
                        <td>{statusBadge(r.status)}</td>
                        <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                          {new Date(r.recordedAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
