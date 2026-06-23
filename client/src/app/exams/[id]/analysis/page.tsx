'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
  FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例',
};

export default function ExamAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string);

  const [exam, setExam] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.exams.get(examId).catch(() => null),
      api.examAnalysis.overview(examId).catch(() => null),
      api.examAnalysis.distribution(examId).catch(() => null),
      api.examAnalysis.questionAccuracy(examId).catch(() => null),
    ]).then(([e, ov, dist, acc]) => {
      setExam(e);
      setOverview(ov);
      setDistribution(dist);
      setQuestions(acc?.questions || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  const maxDistribution = distribution?.buckets ? Math.max(...distribution.buckets.map((b: any) => b.count), 1) : 1;

  return (
    <AppLayout>
      <button onClick={() => router.back()} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回</button>
      <h1 className="page-title">📊 成绩分析 · {exam?.title || ''}</h1>
      <p className="page-subtitle mb-6">试卷总分：{overview?.totalScore || '—'}</p>

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '参考/应考', value: `${overview.submittedCount}/${overview.totalEnrolled}`, sub: `出勤率 ${overview.attendanceRate}%`, color: 'var(--ink-600)' },
            { label: '平均分', value: overview.avgScore, sub: `最高 ${overview.maxScore} / 最低 ${overview.minScore}`, color: 'var(--fox)' },
            { label: '中位数', value: overview.medianScore, sub: `标准差 —`, color: 'var(--cyan)' },
            { label: '通过率', value: `${overview.passRate}%`, sub: `${overview.passCount}人通过 / ${overview.failCount}人未通过`, color: overview.passRate >= 60 ? 'var(--sage)' : 'var(--verm)' },
          ].map((s, i) => (
            <div key={i} className="card p-5">
              <div className="text-xs mb-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Distribution bar chart */}
      {distribution?.buckets && (
        <div className="card p-5 mb-8">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-700)' }}>分数分布</h3>
          <div className="space-y-3">
            {distribution.buckets.map((b: any) => {
              const pct = maxDistribution > 0 ? b.count / maxDistribution * 100 : 0;
              const isFail = b.range === '0-59';
              return (
                <div key={b.range}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: isFail ? 'var(--verm)' : 'var(--ink-500)' }}>{b.range} 分</span>
                    <span style={{ color: 'var(--ink-400)' }}>{b.count} 人</span>
                  </div>
                  <div className="h-6 rounded-lg overflow-hidden" style={{ background: 'var(--paper-dark)' }}>
                    <div className="h-full rounded-lg flex items-center justify-end px-2 text-[10px] text-white font-medium transition-all"
                      style={{ width: `${Math.max(pct, 3)}%`, background: isFail ? '#e53935' : b.range === '60-69' ? '#f5a061' : b.range === '70-79' ? '#e87a30' : b.range === '80-89' ? '#00897b' : '#2e7d32' }}>
                      {pct > 15 ? `${b.count}人` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Question accuracy */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-700)' }}>逐题正确率（按正确率升序）</h3>
        <div className="space-y-2">
          {questions.map((q: any, idx: number) => (
            <div key={q.questionId} className="rounded-lg p-3" style={{ background: 'var(--paper-dark)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono" style={{ color: 'var(--ink-300)' }}>#{idx + 1}</span>
                <span className="tag text-[10px]" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>{TYPE_NAMES[q.type] || q.type}</span>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--ink-500)' }}>{q.content}</span>
                <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{q.score}分</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--ink-100)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${q.accuracy}%`,
                    background: q.accuracy >= 80 ? 'var(--sage)' : q.accuracy >= 60 ? 'var(--fox)' : '#e53935',
                  }} />
                </div>
                <span className="text-xs font-medium whitespace-nowrap" style={{
                  color: q.accuracy >= 80 ? 'var(--sage)' : q.accuracy >= 60 ? 'var(--fox)' : '#e53935',
                }}>
                  {q.correctCount}/{q.totalAnswers} ({q.accuracy}%)
                </span>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无数据</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
