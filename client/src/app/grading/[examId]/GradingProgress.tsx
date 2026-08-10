"use client";

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import CircularProgress from '@/components/charts/CircularProgress';

interface GradingProgressProps {
  examId: number;
  exam: any;
  students: any[];
}

export default function GradingProgress({ examId, exam, students }: GradingProgressProps) {
  const toast = useToast();
  const [progress, setProgress] = useState<any>(null);
  const [statusSummary, setStatusSummary] = useState<any>(null);
  const [questionStats, setQuestionStats] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [p, ss, qs] = await Promise.all([
          fetch(`/api/exams/${examId}/grading-progress`, { headers }).then(r => r.json()),
          fetch(`/api/exams/${examId}/sessions/status-summary`, { headers }).then(r => r.json()),
          fetch(`/api/grading/${examId}/question-stats`, { headers }).then(r => r.json()),
        ]);
        setProgress(p);
        setStatusSummary(ss);
        setQuestionStats(qs.stats || []);
      } catch (e: any) { console.error('加载进度失败:', e); toast.error('加载进度失败：' + (e.message || '未知错误')); }
    };
    load();
  }, [examId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {progress ? [
          { value: progress.total, label: '总交卷', color: 'var(--ink-600)' },
          { value: progress.graded, label: '已判', color: 'var(--sage)' },
          { value: progress.remaining, label: '待判', color: progress.remaining > 0 ? 'var(--fox)' : 'var(--sage)' },
          { value: `${progress.percentage}%`, label: '完成率', color: progress.percentage === 100 ? 'var(--sage)' : 'var(--fox)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-2xl font-bold num" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[var(--ink-400)] text-xs mt-1">{s.label}</div>
          </div>
        )) : [
          { value: students.length, label: '总交卷', color: 'var(--ink-600)' },
          { value: students.filter(s => s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED' || s.scoringStatus === 'GRADED').length, label: '已判', color: 'var(--sage)' },
          { value: students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length, label: '待判', color: 'var(--fox)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-2xl font-bold num" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[var(--ink-400)] text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 整体进度 — 圆环图 */}
      <div className="card p-5">
        <div className="text-[var(--ink-400)] text-xs font-medium mb-3">整体进度</div>
        <div className="flex items-center gap-6">
          <CircularProgress
            percentage={progress?.percentage ?? Math.round(students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length / Math.max(students.length, 1) * 100)}
            size={130}
          />
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-400)]">已批改</span>
              <span className="text-[var(--sage)] num font-medium">
                {progress?.graded ?? students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-400)]">待批改</span>
              <span className="text-[var(--fox)] num font-medium">
                {progress?.remaining ?? students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-400)]">总提交</span>
              <span className="text-[var(--ink-600)] num font-medium">
                {progress?.total ?? students.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 各阅卷员进度 */}
      {progress?.perGrader?.length > 0 && (
        <div className="card p-4">
          <div className="text-[var(--ink-400)] text-xs font-medium mb-3">各阅卷员进度</div>
          <div className="space-y-3">
            {progress.perGrader.map((g: any) => {
              const gpct = g.assigned > 0 ? Math.round(g.submitted / g.assigned * 100) : 0;
              const gDone = g.remaining === 0;
              return (
                <div key={g.graderId}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--ink-600)] flex items-center gap-1.5">
                      {gDone && <span className="text-[var(--sage)]">✓</span>}
                      {g.graderName}
                    </span>
                    <span className="text-[var(--ink-400)] num">{g.submitted}/{g.assigned} ({gpct}%)</span>
                  </div>
                  <div className="bg-[var(--paper-dark)] h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${gDone ? 'progress-done' : 'progress-striped'}`}
                      style={{ width: `${gpct}%`, background: gDone ? 'var(--sage)' : 'var(--fox)' }}
                    />
                  </div>
                  {g.details && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {g.details.map((d: any, idx: number) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: d.submitted >= d.total ? 'rgba(46,125,50,0.1)' : 'rgba(222,115,30,0.1)', color: d.submitted >= d.total ? 'var(--sage)' : 'var(--gold)' }}>
                          {d.label}: {d.submitted}/{d.total}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 成绩分布直方图 */}
      {(() => {
        const maxScore = exam?.totalScore || 100;
        const scored = students
          .map(s => s.finalScore ?? s.totalScore)
          .filter((v: any) => typeof v === 'number' && v !== null);
        if (scored.length === 0) return null;
        const buckets = [
          { range: '0-59', min: 0, max: 59, count: 0 },
          { range: '60-69', min: 60, max: 69, count: 0 },
          { range: '70-79', min: 70, max: 79, count: 0 },
          { range: '80-89', min: 80, max: 89, count: 0 },
          { range: '90-100', min: 90, max: 100, count: 0 },
        ];
        scored.forEach((raw: number) => {
          const pct = Math.round((raw / maxScore) * 100);
          const b = buckets.find(bk => pct >= bk.min && pct <= bk.max) || buckets[0];
          b.count++;
        });
        const maxCount = Math.max(...buckets.map(b => b.count), 1);
        const colorFor = (range: string) =>
          range === '0-59' ? 'var(--verm)' :
          range === '60-69' ? 'var(--gold)' :
          range === '70-79' ? 'var(--fox)' :
          range === '80-89' ? 'var(--cyan)' : 'var(--sage)';
        return (
          <div className="card p-5">
            <h3 className="text-[var(--ink-700)] text-sm font-semibold mb-4">成绩分布</h3>
            <div className="space-y-3">
              {buckets.map(b => {
                const w = (b.count / maxCount) * 100;
                return (
                  <div key={b.range}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: b.range === '0-59' ? 'var(--verm)' : 'var(--ink-500)' }}>{b.range} 分</span>
                      <span className="text-[var(--ink-400)] num">{b.count} 人</span>
                    </div>
                    <div className="bg-[var(--paper-dark)] h-6 rounded-lg overflow-hidden">
                      <div className="hist-bar h-full rounded-lg flex items-center justify-end px-2 text-[10px] text-white font-medium"
                        style={{ width: `${Math.max(w, b.count > 0 ? 4 : 0)}%`, background: colorFor(b.range), minWidth: b.count > 0 ? 'auto' : 0 }}>
                        {b.count > 0 && `${b.count}人`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {statusSummary && (
        <div className="card p-4">
          <div className="text-[var(--ink-400)] text-xs font-medium mb-2">状态分布</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusSummary).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
              <span key={k} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--paper-dark)] text-[var(--ink-500)]" >
                {k}: <strong className="num">{String(v)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 每题统计分析 */}
      {questionStats.length > 0 && (
        <div className="card p-5">
          <h3 className="text-[var(--ink-700)] text-sm font-semibold mb-4">📊 每题统计分析</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--ink-100)' }}>
                  <th className="text-[var(--ink-400)] text-left py-2 px-2">题目</th>
                  <th className="text-[var(--ink-400)] text-center py-2 px-2">满分</th>
                  <th className="text-[var(--ink-400)] text-center py-2 px-2">平均分</th>
                  <th className="text-[var(--ink-400)] text-center py-2 px-2">得分率</th>
                  <th className="text-[var(--ink-400)] text-center py-2 px-2">最高/最低</th>
                  <th className="text-[var(--ink-400)] text-center py-2 px-2">正确率</th>
                  <th className="text-[var(--ink-400)] text-left py-2 px-2">分布</th>
                </tr>
              </thead>
              <tbody>
                {questionStats.map((qs: any) => (
                  <tr key={qs.pqId} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                    <td className="py-2.5 px-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] mr-1.5 bg-[var(--fox-glow)] text-[var(--fox)]" >
                        {qs.type === 'SINGLE_CHOICE' ? '单选' : qs.type === 'MULTIPLE_CHOICE' ? '多选' : qs.type === 'TRUE_FALSE' ? '判断' : qs.type === 'FILL_BLANK' ? '填空' : qs.type === 'SHORT_ANSWER' ? '简答' : qs.type === 'ESSAY' ? '论文' : qs.type}
                      </span>
                      <span className="text-[var(--ink-600)]">{qs.content}</span>
                    </td>
                    <td className="text-[var(--ink-500)] text-center py-2.5 px-2 num">{qs.maxScore}</td>
                    <td className="text-center py-2.5 px-2 num font-medium" style={{ color: qs.scoreRate >= 80 ? 'var(--sage)' : qs.scoreRate >= 60 ? 'var(--fox)' : 'var(--verm)' }}>{qs.avgScore}</td>
                    <td className="text-center py-2.5 px-2">
                      <span className="num font-medium" style={{ color: qs.scoreRate >= 80 ? 'var(--sage)' : qs.scoreRate >= 60 ? 'var(--fox)' : 'var(--verm)' }}>{qs.scoreRate}%</span>
                    </td>
                    <td className="text-[var(--ink-500)] text-center py-2.5 px-2 num">{qs.maxScoreGot}/{qs.minScoreGot}</td>
                    <td className="text-[var(--ink-400)] text-center py-2.5 px-2 num">{qs.correctRate !== null ? `${qs.correctRate}%` : '-'}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex gap-0.5 items-end h-5">
                        {qs.distribution.map((d: number, i: number) => {
                          const maxD = Math.max(...qs.distribution, 1);
                          const h = Math.max((d / maxD) * 20, d > 0 ? 4 : 2);
                          const colors = ['var(--verm)', 'var(--gold)', 'var(--fox)', 'var(--sage)'];
                          return <div key={i} className="w-3 rounded-sm" title={`${['0-25%','26-50%','51-75%','76-100%'][i]}: ${d}人`} style={{ height: h, background: d > 0 ? colors[i] : 'var(--ink-100)' }} />;
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
