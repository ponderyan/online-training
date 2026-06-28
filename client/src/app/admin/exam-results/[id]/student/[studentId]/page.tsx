'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function AdminStudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.id);
  const studentId = Number(params.studentId);
  const [result, setResult] = useState<any>(null);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState('');
  const [adjustScore, setAdjustScore] = useState('');

  useEffect(() => {
    Promise.all([
      api.exams.admin.getStudentResult(examId, studentId),
      api.exams.admin.getAppeals(examId),
    ]).then(([r, a]) => {
      setResult(r);
      setAppeals(a.filter((ap: any) => ap.studentId === studentId));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [examId, studentId]);

  const handleResolve = async (appealId: number, status: string) => {
    try {
      await api.exams.admin.resolveAppeal(examId, appealId, { status, adminNote: adminNote || undefined, newScore: adjustScore ? parseInt(adjustScore) : undefined });
      window.location.reload();
    } catch (e: any) { alert('操作失败：' + e.message); }
  };

  return (
    <AppLayout>
      <button onClick={() => router.push(`/admin/exam-results/${examId}`)} className="text-xs bg-transparent border-none cursor-pointer mb-3" style={{ color: 'var(--fox)' }}>← 返回</button>
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : !result ? (
        <div className="card p-12 text-center"><p style={{ color: 'var(--ink-300)' }}>记录不存在</p></div>
      ) : (
        <>
          <h1 className="page-title mb-4">📋 考生答题详情</h1>
          <div className="card p-4 mb-6 text-sm" style={{ background: 'var(--paper)' }}>
            <p><strong>{result.examTitle}</strong> · 总分: {result.finalScore ?? '—'} · {result.isPassed ? '✅ 通过' : '❌ 未通过'}</p>
          </div>

          {result.answers?.length > 0 && (
            <div className="space-y-3 mb-6">
              <h2 className="section-title">逐题解析</h2>
              {result.answers.map((a: any, i: number) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: a.isCorrect ? '#2e7d3218' : '#ef444418', color: a.isCorrect ? '#2e7d32' : '#ef4444' }}>{a.isCorrect ? '✅' : '❌'} {a.score ?? '?'}/{a.maxScore}分</span>
                    <span className="text-xs" style={{ color: 'var(--ink-300)' }}>{a.type}</span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: 'var(--ink-700)' }}>{a.content}</p>
                  {a.options?.map((o: any) => (<div key={o.id} className="text-xs py-0.5" style={{ color: o.isCorrect ? '#2e7d32' : 'var(--ink-400)' }}>{o.label}. {o.content} {o.isCorrect ? '✓' : ''}</div>))}
                  <div className="text-xs mt-2" style={{ color: 'var(--ink-400)' }}>你的答案：{JSON.stringify(a.yourAnswer)} · 正确答案：{JSON.stringify(a.correctAnswer)}</div>
                  {a.analysis && <div className="text-xs mt-1 p-2 rounded" style={{ background: 'var(--paper)', color: 'var(--ink-500)' }}>解析：{a.analysis}</div>}
                </div>
              ))}
            </div>
          )}

          {appeals.map((ap: any) => (
            <div key={ap.id} className="card p-4">
              <h3 className="section-title mb-3">📝 申诉处理</h3>
              <div className="text-sm mb-3 p-3 rounded" style={{ background: '#fff8e1' }}><p className="font-medium">考生申诉理由：</p><p className="text-xs mt-1">{ap.reason}</p></div>
              {ap.status === 'PENDING' ? (
                <>
                  <div className="mb-3"><label className="text-xs mb-1 block">调整分数</label><input value={adjustScore} onChange={e => setAdjustScore(e.target.value)} type="number" className="input" style={{ width: 120 }} placeholder="新分数" /></div>
                  <div className="mb-3"><label className="text-xs mb-1 block">处理备注</label><textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} className="input" rows={2} /></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleResolve(ap.id, 'APPROVED')} className="btn btn-fox btn-sm">✅ 已处理，更新分数</button>
                    <button onClick={() => handleResolve(ap.id, 'REJECTED')} className="btn btn-outline btn-sm" style={{ color: '#ef4444' }}>❌ 驳回</button>
                  </div>
                </>
              ) : <p className="text-sm p-3 rounded" style={{ background: ap.status === 'APPROVED' ? '#e8f5e9' : '#fef2f2' }}>状态：{ap.status === 'APPROVED' ? '✅ 已处理' : '❌ 驳回'}</p>}
            </div>
          ))}
        </>
      )}
    </AppLayout>
  );
}
