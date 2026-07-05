'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function ExamResultsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/student/exams', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      const submitted = (Array.isArray(data) ? data : []).filter((e: any) =>
        e.scoringStatus === 'PUBLISHED' || e.scoringStatus === 'ADJUSTED'
      );
      setExams(submitted.sort((a: any, b: any) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📊 考试成绩</h1>
        <p className="page-subtitle">已公布成绩的考试</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : exams.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无已公布的考试成绩</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="list-table">
            <thead><tr>
              <th>考试名称</th><th>试卷</th><th>总分</th><th>得分</th><th>结果</th><th>提交时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              {exams.map((e: any) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.title}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{e.paperName || '—'}</td>
                  <td>{e.totalScore ?? '—'}</td>
                  <td><strong style={{ color: e.isPassed ? '#2e7d32' : '#ef4444' }}>{e.myFinalScore ?? e.myScore ?? '—'}</strong></td>
                  <td>{e.isPassed ? <span style={{ color: '#2e7d32' }}>✅ 通过</span> : <span style={{ color: '#ef4444' }}>❌ 未通过</span>}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : '—'}</td>
                  <td>
                    <button onClick={() => router.push(`/exam/result/${e.id}`)}
                      className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
