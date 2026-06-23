'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function InstructorEvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [instructor, setInstructor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.instructors.get(Number(params.id)).catch(() => null),
      api.evaluations.instructorStats(Number(params.id)).catch(() => null),
    ]).then(([inst, stats]) => {
      setInstructor(inst);
      setData(stats);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push(`/instructors/${params.id}/edit`)} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回讲师信息</button>
      <h1 className="page-title">⭐ {instructor?.realName || '讲师'} · 评价汇总</h1>

      {data ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: '总评价数', value: data.count, color: 'var(--ink-600)' },
              { label: '教学评分', value: `${'★'.repeat(Math.floor(data.instructorRating))} ${data.instructorRating}`, color: 'var(--fox)' },
              { label: '总体评分', value: `${'★'.repeat(Math.floor(data.overallRating))} ${data.overallRating}`, color: 'var(--sage)' },
            ].map((s, i) => (
              <div key={i} className="card p-4 text-center">
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead><tr><th>学员</th><th>教学评分</th><th>总体评分</th><th>评语</th><th>时间</th></tr></thead>
              <tbody>
                {data.evaluations?.map((e: any, i: number) => (
                  <tr key={i}>
                    <td>{e.isAnonymous ? '匿名' : e.student?.displayName || '—'}</td>
                    <td>{'★'.repeat(e.instructorRating)}</td>
                    <td>{'★'.repeat(e.overallRating)}</td>
                    <td className="text-xs max-w-[200px]" style={{ color: 'var(--ink-400)' }}>{e.comment || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
                {(!data.evaluations || data.evaluations.length === 0) && <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无评价</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">⭐</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无评价数据</p>
        </div>
      )}
    </AppLayout>
  );
}
