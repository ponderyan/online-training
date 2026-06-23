'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function ExamTranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.exams.transcript(examId).then(setData).finally(() => setLoading(false));
  }, [examId]);

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div></AppLayout>;
  if (!data) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>暂无成绩数据</div></AppLayout>;

  const passRate = data.totalStudents > 0 ? ((data.passCount / data.totalStudents) * 100).toFixed(0) : 0;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">📊 成绩单 · {data.examTitle || ''}</h1>
          <p className="page-subtitle">
            共 {data.totalStudents || 0} 人 · 平均分 {(data.averageScore || 0).toFixed(1)} · 通过率 {passRate}%
          </p>
        </div>
        <button onClick={() => router.push(`/exams/${examId}`)} className="btn btn-outline btn-sm">← 返回考试</button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '参考人数', value: data.totalStudents || 0, color: 'var(--fox)' },
          { label: '平均分', value: (data.averageScore || 0).toFixed(1), color: 'var(--cyan)' },
          { label: '通过', value: data.passCount || 0, color: 'var(--gold)' },
          { label: '未通过', value: data.failCount || 0, color: 'var(--verm)' },
        ].map((s, i) => (
          <div key={i} className="card p-5 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 text-xs font-medium" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
          成绩排名
        </div>
        {data.scores?.map((s: any, i: number) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
            <span className="text-sm w-8 text-center" style={{ color: i < 3 ? 'var(--gold)' : 'var(--ink-300)' }}>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
            </span>
            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--ink-600)' }}>{s.student?.displayName || '—'}</span>
            <span className="text-sm font-mono" style={{ color: 'var(--ink-500)' }}>{s.finalScore ?? '-'} 分</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${s.isPassed ? 'tag-cyan' : 'tag-verm'}`}>
              {s.isPassed ? '通过' : '未通过'}
            </span>
          </div>
        ))}
        {(!data.scores || data.scores.length === 0) && (
          <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无数据</div>
        )}
      </div>
    </AppLayout>
  );
}
