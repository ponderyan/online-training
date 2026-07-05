'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';

interface AnswerDetail {
  questionId: number;
  yourAnswer: any;
  correctAnswer: any;
  isCorrect: boolean | null;
  score: number | null;
  graderNote: string | null;
  questionContent: string;
  questionType: string;
  options: { label: string; content: string }[];
  analysis: string | null;
}

interface ExamResult {
  examTitle: string;
  paperName: string;
  totalScore: number | null;
  subjectiveScore: number | null;
  finalScore: number | null;
  isPassed: boolean | null;
  submittedAt: string;
  published?: boolean;
  message?: string;
  answers: AnswerDetail[];
}

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};

function DonutChart({ correct, wrong, pending }: { correct: number; wrong: number; pending: number }) {
  const total = correct + wrong + pending;
  if (total === 0) return null;
  const c = (correct / total) * 100;
  const w = (wrong / total) * 100;
  const p = (pending / total) * 100;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        {/* Background */}
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e8e5df" strokeWidth="2.5" />
        {/* Correct */}
        {correct > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2e7d32" strokeWidth="2.5"
            strokeDasharray={`${c} ${100 - c}`}
            strokeDashoffset="0"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {/* Wrong */}
        {wrong > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="2.5"
            strokeDasharray={`${w} ${100 - w}`}
            strokeDashoffset={String(-c)}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: 'var(--ink-700)' }}>{total}</span>
        <span className="text-[9px]" style={{ color: 'var(--ink-300)' }}>总题数</span>
      </div>
    </div>
  );
}

function formatAnswer(a: AnswerDetail): string {
  if (a.questionType === 'MULTIPLE_CHOICE' && Array.isArray(a.yourAnswer)) return a.yourAnswer.join(', ');
  if (a.questionType === 'FILL_BLANK' && Array.isArray(a.yourAnswer)) return a.yourAnswer.map((v: string, i: number) => `空${i + 1}: ${v}`).join('; ');
  return String(a.yourAnswer ?? '未作答');
}

function formatCorrect(a: AnswerDetail): string {
  if (a.questionType === 'MULTIPLE_CHOICE' && Array.isArray(a.correctAnswer)) return a.correctAnswer.join(', ');
  if (a.questionType === 'FILL_BLANK' && Array.isArray(a.correctAnswer)) return a.correctAnswer.map((v: string, i: number) => `空${i + 1}: ${v}`).join('; ');
  return String(a.correctAnswer ?? '-');
}

export default function ExamResult() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch(`/api/student/exams/${params.id}/result`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      setResult(data);
      setLoading(false);
    }).catch(() => router.push('/exam'));
  }, [params.id, router]);

  // 成绩尚未发布
  if (result && result.published === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--paper)' }}>
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-700)' }}>成绩尚未发布</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>你的答卷已提交，请等待管理员发布成绩</p>
          {result.submittedAt && <p className="text-xs mb-6" style={{ color: 'var(--ink-300)' }}>交卷时间：{new Date(result.submittedAt).toLocaleString('zh-CN')}</p>}
          <button onClick={() => router.push('/exam')} className="px-6 py-2.5 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'var(--fox)', color: '#fff' }}>← 返回考试列表</button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-4xl mb-4 animate-pulse">🦊</div>
      <p style={{ color: 'var(--ink-300)' }}>加载中…</p>
    </div>
  );
  if (!result) return null;

  const correctCount = result.answers.filter(a => a.isCorrect === true).length;
  const wrongCount = result.answers.filter(a => a.isCorrect === false).length;
  const pendingCount = result.answers.filter(a => a.isCorrect === null).length;
  const isPassed = result.isPassed === true;
  const showCertEntry = result.isPassed === true && result.published === true;
  const subjectivePending = result.finalScore === null && result.subjectiveScore === null;

  // 主观题类型
  const subjectiveTypes = ['SHORT_ANSWER', 'CASE_STUDY'];

  return (
    <>
      <title>考试结果 · 狐学</title>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        {/* Header - hidden in print */}
        <div className="sticky top-0 z-10 backdrop-blur-md no-print" style={{ background: 'rgba(246,241,232,0.92)', borderBottom: '1px solid var(--ink-100)' }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FoxLogo.Light size={32} />
            <span className="font-semibold" style={{ color: 'var(--ink-700)' }}>考试结果</span>
          </div>
          <button onClick={() => router.push('/exam')}
            className="text-xs px-3 py-1.5 rounded-md bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-400)' }}>
            ← 返回考试列表
          </button>
        </div>
      </div>

      <div className="print-area max-w-4xl mx-auto px-6 py-8">
        {/* Score Card */}
        <div className="rounded-xl p-8 mb-8" style={{
          background: isPassed
            ? 'linear-gradient(135deg, #f0faf0, #e8f5e9)'
            : 'linear-gradient(135deg, #fff8f0, #fff3e0)',
          border: `1px solid ${isPassed ? '#c8e6c9' : '#ffe0b2'}`,
        }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{isPassed ? '🎉' : '😅'}</span>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--ink-700)' }}>{result.examTitle}</h2>
                  <p className="text-xs" style={{ color: 'var(--ink-400)' }}>{result.paperName}</p>
                </div>
              </div>

              <div className="flex items-end gap-6 mt-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-400)' }}>最终得分</p>
                  <p className="text-4xl font-bold" style={{ color: isPassed ? '#2e7d32' : '#ef4444' }}>
                    {result.finalScore ?? '-'}
                    <span className="text-base font-normal" style={{ color: 'var(--ink-300)' }}> / {result.totalScore ?? '-'}</span>
                  </p>
                </div>
                <div className="w-px h-10" style={{ background: 'var(--ink-100)' }} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-400)' }}>结果</p>
                  <p className="text-lg font-semibold" style={{ color: isPassed ? '#2e7d32' : '#ef4444' }}>
                    {isPassed ? '✅ 通过' : result.isPassed === false ? '❌ 未通过' : '⏳ 待阅卷'}
                  </p>
                </div>
                {result.submittedAt && (
                  <>
                    <div className="w-px h-10" style={{ background: 'var(--ink-100)' }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-400)' }}>交卷时间</p>
                      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
                        {new Date(result.submittedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Donut chart */}
            <div className="flex flex-col items-center">
              <DonutChart correct={correctCount} wrong={wrongCount} pending={pendingCount} />
              <div className="flex gap-3 mt-3 text-[10px]">
                <span style={{ color: '#2e7d32' }}>● {correctCount} 正确</span>
                <span style={{ color: '#ef4444' }}>● {wrongCount} 错误</span>
                {pendingCount > 0 && <span style={{ color: '#f59e0b' }}>● {pendingCount} 待判</span>}
              </div>
              <div className="flex gap-2 mt-3 no-print">
                <button onClick={() => window.print()}
                  className="btn btn-sm text-xs px-3 py-1.5"
                  style={{ background: 'var(--fox)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  🖨️ 打印成绩单
                </button>
                {showCertEntry && (
                  <button onClick={() => window.location.href = '/my-certificates'}
                    className="btn btn-sm text-xs px-3 py-1.5"
                    style={{ background: '#7b1fa2', color: 'white', border: 'none', cursor: 'pointer' }}>
                    🎓 查看证书
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {subjectivePending && (
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3"
            style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#f57f17' }}>
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold text-sm">主观题阅卷中</p>
              <p className="text-xs mt-0.5" style={{ color: '#b8860b' }}>客观题得分已出，主观题由人工判分中，请耐心等待</p>
            </div>
          </div>
        )}
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: '正确率', value: correctCount + wrongCount > 0 ? `${Math.round((correctCount / (correctCount + wrongCount)) * 100)}%` : '-', color: '#2e7d32' },
            { label: '客观题得分', value: result.finalScore !== null ? `${result.finalScore - (result.subjectiveScore || 0)}` : '-', color: 'var(--fox)' },
            { label: '主观题得分', value: result.subjectiveScore !== null ? String(result.subjectiveScore) : '待判', color: '#1565c0' },
            { label: '总题数', value: String(result.answers.length), color: 'var(--ink-500)' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Answer Details */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--ink-100)' }}>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>逐题解析</span>
              <div className="flex gap-1">
                {result.answers.map((a, i) => (
                  <span key={i} className="w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-medium" style={{
                    background: a.isCorrect === true ? '#2e7d3218' : a.isCorrect === false ? '#ef444418' : '#f59e0b18',
                    color: a.isCorrect === true ? '#2e7d32' : a.isCorrect === false ? '#ef4444' : '#f59e0b',
                  }}>{i + 1}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowAll(!showAll)}
              className="text-xs px-3 py-1.5 rounded-md border-none cursor-pointer font-medium"
              style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)' }}>
              {showAll ? '收起部分' : '展开全部'}
            </button>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {result.answers.map((a, i) => {
              const visible = showAll || a.isCorrect === false || a.isCorrect === null;
              if (!visible) return null;

              return (
                <div key={a.questionId} className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Status badge */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{
                      background: a.isCorrect === true ? '#2e7d3218' : a.isCorrect === false ? '#ef444418' : '#f59e0b18',
                    }}>
                      {a.isCorrect === true ? '✅' : a.isCorrect === false ? '❌' : '⏳'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Question header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
                          #{i + 1}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                          {TYPE_NAMES[a.questionType] || a.questionType}
                        </span>
                        {a.score !== null && (
                          <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                            得分：{a.score}
                          </span>
                        )}
                      </div>

                      {/* Question content */}
                      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ink-700)' }}>{a.questionContent}</p>

                      {/* Options display */}
                      {a.options?.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          {a.options.map((o: any) => {
                            const isUserAnswer = String(a.yourAnswer) === o.label ||
                              (Array.isArray(a.yourAnswer) && a.yourAnswer.includes(o.label));
                            const isCorrectOption = String(a.correctAnswer) === o.label ||
                              (Array.isArray(a.correctAnswer) && a.correctAnswer.includes(o.label));
                            let bg = 'transparent';
                            let border = '1px solid transparent';
                            if (isUserAnswer && isCorrectOption && a.isCorrect === true) { bg = '#f0faf0'; border = '1px solid #c8e6c9'; }
                            else if (isUserAnswer && !isCorrectOption) { bg = '#fef2f2'; border = '1px solid #fecaca'; }
                            else if (!isUserAnswer && isCorrectOption && a.isCorrect === false) { bg = '#f0faf0'; border = '1px solid #c8e6c9'; }

                            return (
                              <div key={o.label} className="p-2.5 rounded-lg text-xs flex items-center gap-2"
                                style={{ background: bg, border }}>
                                <span className="w-5 h-5 rounded-full flex items-center justify-center font-medium flex-shrink-0 text-[10px]"
                                  style={{ background: isUserAnswer ? 'var(--fox)' : '#e8e5df', color: isUserAnswer ? 'white' : 'var(--ink-400)' }}>
                                  {o.label}
                                </span>
                                <span style={{ color: isUserAnswer ? 'var(--ink-700)' : 'var(--ink-500)' }}>{o.content}</span>
                                {isUserAnswer && <span className="text-[9px]" style={{ color: 'var(--ink-300)' }}>你的选择</span>}
                                {!isUserAnswer && isCorrectOption && a.isCorrect === false && (
                                  <span className="text-[9px]" style={{ color: '#2e7d32' }}>正确答案</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Answers */}
                      <div className="text-xs space-y-1 mb-3" style={{ color: 'var(--ink-500)' }}>
                        {a.yourAnswer !== null && (
                          <p>
                            <span className="font-medium">你的答案：</span>
                            <span style={{ color: a.isCorrect === true ? '#2e7d32' : a.isCorrect === false ? '#ef4444' : 'var(--ink-500)' }}>
                              {formatAnswer(a)}
                            </span>
                          </p>
                        )}
                        {a.correctAnswer && a.isCorrect === false && (
                          <p>
                            <span className="font-medium">正确答案：</span>
                            <span style={{ color: '#2e7d32' }}>{formatCorrect(a)}</span>
                          </p>
                        )}
                        {a.graderNote && (
                          <p className="mt-1 p-2 rounded" style={{ background: '#f5f3ef' }}>
                            <span className="font-medium">评语：</span>{a.graderNote}
                          </p>
                        )}
                      </div>

                      {/* Analysis */}
                      {a.analysis && (
                        <details className="group">
                          <summary className="text-xs cursor-pointer inline-flex items-center gap-1 font-medium"
                            style={{ color: 'var(--fox)' }}>
                            <span className="transition-transform group-open:rotate-90">▶</span> 查看解析
                          </summary>
                          <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid var(--ink-100)', color: 'var(--ink-500)' }}>
                            {a.analysis}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
