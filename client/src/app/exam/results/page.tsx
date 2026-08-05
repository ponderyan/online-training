'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonTable } from '@/components/Skeleton';

export default function ExamResultsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    setError(null);
    fetch('/api/student/exams', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      if (!r.ok) throw new Error('加载失败');
      return r.json();
    }).then(data => {
      const submitted = (Array.isArray(data) ? data : []).filter((e: any) =>
        e.scoringStatus === 'PUBLISHED' || e.scoringStatus === 'ADJUSTED'
      );
      setExams(submitted.sort((a: any, b: any) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()));
    }).catch(e => setError(e.message || '加载考试成绩失败')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📊 考试成绩</h1>
        <p className="page-subtitle">已公布成绩的考试</p>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonTable rows={5} cols={7} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={load} /></div>
      ) : exams.length === 0 ? (
        <div className="card"><EmptyState icon="📊" title="还没有已公布的考试成绩" description="参加考试并公布成绩后，结果会出现在这里" /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto">
            <table className="list-table">
            <thead><tr>
              <th>考试名称</th><th>试卷</th><th>总分</th><th>得分</th><th>结果</th><th>提交时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              {exams.map((e: any) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.title}{e.examMode === 'OFFLINE' && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--warning-pale)', color: 'var(--warning)' }}>线下</span>}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{e.paperName || '—'}</td>
                  <td>{e.totalScore ?? '—'}</td>
                  <td><strong style={{ color: e.isPassed ? 'var(--sage)' : 'var(--error)' }}>{e.myFinalScore ?? e.myScore ?? '—'}</strong></td>
                  <td>{e.absent ? <span style={{ color: 'var(--warning)' }}>缺考</span> : e.isPassed ? <span style={{ color: 'var(--sage)' }}>✅ 通过</span> : <span style={{ color: 'var(--error)' }}>❌ 未通过</span>}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : '—'}</td>
                  <td>
                    {e.examMode !== 'OFFLINE' ? (
                      <button onClick={() => router.push(`/exam/result/${e.id}`)}
                        className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                        查看详情
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--ink-300)' }}>线下笔试</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
