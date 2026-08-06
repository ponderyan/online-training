'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function AdminExamResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const result = await api.exams.admin.getExamResults(examId);
      setData(result);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [examId]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📊 考试结果</h1>
          <p className="page-subtitle">管理端 · 查看所有考生成绩</p>
        </div>
        <button onClick={() => router.push('/exams')} className="btn btn-outline btn-sm">← 返回</button>
      </div>

      {loading ? (
        <div className="text-[var(--ink-300)] text-center py-16">加载中… 🦊</div>
      ) : !data ? (
        <div className="card p-12 text-center"><p className="text-[var(--ink-300)]">考试不存在</p></div>
      ) : (
        <>
          {/* Exam info */}
          <div className="bg-[var(--paper)] card p-4 mb-6 text-sm">
            <p><strong>{data.examTitle}</strong> {data.paperName ? `· ${data.paperName}` : ''}</p>
            <p className="text-[var(--ink-300)] text-xs mt-1">共 {data.students?.length || 0} 名考生</p>
          </div>

          {/* Publish button */}
          {data.students?.some((s: any) => s.scoringStatus !== 'PUBLISHED' && s.scoringStatus !== 'ADJUSTED') && (
            <div className="mb-4">
              <button onClick={async () => {
                if (!confirm('确认发布所有未发布的成绩？')) return;
                await api.exams.admin.publishScores(examId);
                window.location.reload();
              }} className="px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all"
                style={{ background: 'var(--fox)', color: '#fff' }}>
                📢 发布成绩
              </button>
            </div>
          )}

          {/* Student list */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="list-table">
              <thead><tr>
                <th>姓名</th><th>成绩</th><th>结果</th><th>评分状态</th><th>申诉</th><th>操作</th>
              </tr></thead>
              <tbody>
                {data.students?.sort((a: any, b: any) => (b.finalScore || 0) - (a.finalScore || 0)).map((s: any) => (
                  <tr key={s.studentId}>
                    <td className="font-medium">{s.studentName}</td>
                    <td>{s.finalScore != null ? `${s.finalScore}分` : '—'}</td>
                    <td>{s.isPassed ? <span className="text-[var(--sage)]">✅ 通过</span> : <span className="text-[var(--error)]">❌ 未通过</span>}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded" style={{ background: s.scoringStatus === 'PUBLISHED' ? 'var(--sage-glow)' : 'var(--fox-glow)', color: s.scoringStatus === 'PUBLISHED' ? 'var(--sage)' : 'var(--ink-300)' }}>{s.scoringStatus}</span></td>
                    <td>{s.appealStatus ? <span style={{ color: s.appealStatus === 'PENDING' ? 'var(--fox-dark)' : 'var(--sage)' }}>{s.appealStatus === 'PENDING' ? '🔴 待处理' : '✅ 已处理'}</span> : '—'}</td>
                    <td><button onClick={() => router.push(`/admin/exam-results/${examId}/student/${s.studentId}`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>查看</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
