'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import ScoreReportModal from './ScoreReportModal';

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

interface KpInfo {
  id: number;
  name: string;
  code: string | null;
}

interface KpAnalysisItem {
  kpId: number;
  kpName: string;
  kpCode: string;
  totalQuestions: number;
  correct: number;
  rate: number;
  level: string;
}

interface KpAnalysisData {
  kpResults: KpAnalysisItem[];
  questionKps: Record<number, KpInfo[]>;
  overallRate: number;
  weakest: { kpId: number; kpName: string; rate: number } | null;
  strongest: { kpId: number; kpName: string; rate: number } | null;
}

const LEVEL_COLORS: Record<string, string> = {
  '优秀': 'var(--sage)',
  '良好': 'var(--sage-light)',
  '一般': 'var(--gold)',
  '薄弱': 'var(--verm)',
  '危险': 'var(--verm)',
};

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
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--ink-50)" strokeWidth="2.5" />
        {/* Correct */}
        {correct > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--sage)" strokeWidth="2.5"
            strokeDasharray={`${c} ${100 - c}`}
            strokeDashoffset="0"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {/* Wrong */}
        {wrong > 0 && (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--verm)" strokeWidth="2.5"
            strokeDasharray={`${w} ${100 - w}`}
            strokeDashoffset={String(-c)}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--ink-700)]">{total}</span>
        <span className="text-[9px] text-[var(--ink-300)]">总题数</span>
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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showScoreChanges, setShowScoreChanges] = useState(false);
  const [scoreChanges, setScoreChanges] = useState<any[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [kpAnalysis, setKpAnalysis] = useState<KpAnalysisData | null>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [maxRecHeight, setMaxRecHeight] = useState(0);
  const kpSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    fetch(`/api/student/exams/${params.id}/result`, { headers })
      .then(r => r.json()).then(data => {
        setResult(data);
        setLoading(false);
      }).catch(() => router.push('/exam'));

    // Fetch knowledge analysis
    fetch(`/api/student/exams/${params.id}/knowledge-analysis`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.kpResults && data.kpResults.length > 0) {
          setKpAnalysis(data);
        }
      })
      .catch(() => {});

    // Fetch recommendations
    fetch('/api/student/recommendations', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => setRecommendations(data))
      .catch(() => {});
  }, [params.id, router]);

  // Measure KP section height for recommendations ratio
  useEffect(() => {
    if (kpSectionRef.current && kpAnalysis) {
      setMaxRecHeight(Math.round(kpSectionRef.current.offsetHeight * 0.4));
    }
  }, [kpAnalysis]);

  // 成绩尚未发布
  if (result && result.published === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--paper)]">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold mb-2 text-[var(--ink-700)]">成绩尚未发布</h1>
          <p className="text-sm mb-4 text-[var(--ink-400)]">你的答卷已提交，请等待管理员发布成绩</p>
          {result.submittedAt && <p className="text-xs mb-6 text-[var(--ink-300)]">交卷时间：{new Date(result.submittedAt).toLocaleString('zh-CN')}</p>}
          <button onClick={() => router.push('/exam')} className="px-6 py-2.5 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all hover:brightness-110 active:scale-95 bg-[var(--fox)] text-white">← 返回考试列表</button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--paper)]">
      <div className="text-4xl mb-4 animate-pulse">🦊</div>
      <p className="text-[var(--ink-300)]">加载中…</p>
    </div>
  );
  if (!result) return null;

  // 加载成绩变动记录（脱敏版，不含操作人）
  const loadScoreChanges = async () => {
    setLoadingChanges(true);
    setShowScoreChanges(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/student/scores/${params.id}/changes`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setScoreChanges(data.changes || []);
    } catch { setScoreChanges([]); }
    setLoadingChanges(false);
  };

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
      <div className="min-h-screen bg-[var(--paper)]">
        {/* Header - hidden in print */}
        <div className="sticky top-0 z-10 backdrop-blur-md no-print bg-[rgba(246,241,232,0.92)] border-b border-[var(--ink-100)]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FoxLogo.Light size={32} />
            <span className="font-semibold text-[var(--ink-700)]">考试结果</span>
          </div>
          <button onClick={() => router.push('/exam')}
            className="text-xs px-3 py-1.5 rounded-md bg-transparent border-none cursor-pointer text-[var(--ink-400)]">
            ← 返回考试列表
          </button>
        </div>
      </div>

      <div className="print-area max-w-4xl mx-auto px-6 py-8">
        {/* Score Card */}
        <div className="rounded-xl p-8 mb-8" style={{
          background: isPassed
            ? 'linear-gradient(135deg, var(--sage-glow), rgba(46,125,50,0.03))'
            : 'linear-gradient(135deg, var(--fox-pale), var(--fox-glow))',
          border: `1px solid ${isPassed ? 'var(--sage)' : 'var(--fox)'}`,
        }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{isPassed ? '🎉' : '😅'}</span>
                <div>
                  <h2 className="text-lg font-bold text-[var(--ink-700)]">{result.examTitle}</h2>
                  <p className="text-xs text-[var(--ink-400)]">{result.paperName}</p>
                </div>
              </div>

              <div className="flex items-end gap-6 mt-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--ink-400)]">最终得分</p>
                  <p className={`text-4xl font-bold ${isPassed ? 'text-[var(--sage)]' : 'text-[var(--verm)]'}`}>
                    {result.finalScore ?? '-'}
                    <span className="text-base font-normal text-[var(--ink-300)]"> / {result.totalScore ?? '-'}</span>
                  </p>
                </div>
                <div className="w-px h-10 bg-[var(--ink-100)]" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--ink-400)]">结果</p>
                  <p className={`text-lg font-semibold ${isPassed ? 'text-[var(--sage)]' : 'text-[var(--verm)]'}`}>
                    {isPassed ? '✅ 通过' : result.isPassed === false ? '❌ 未通过' : '⏳ 待阅卷'}
                  </p>
                </div>
                {result.submittedAt && (
                  <>
                    <div className="w-px h-10 bg-[var(--ink-100)]" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--ink-400)]">交卷时间</p>
                      <p className="text-sm text-[var(--ink-500)]">
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
                <span style={{ color: 'var(--sage)' }}>● {correctCount} 正确</span>
                <span style={{ color: 'var(--verm)' }}>● {wrongCount} 错误</span>
                {pendingCount > 0 && <span style={{ color: 'var(--gold)' }}>● {pendingCount} 待判</span>}
              </div>
              <div className="flex gap-2 mt-3 no-print">
                <button onClick={() => setShowPrintModal(true)}
                  className="btn btn-sm text-xs px-3 py-1.5 bg-[var(--fox)] text-white border-none cursor-pointer">
                  🖨️ 打印成绩单
                </button>
                <button onClick={loadScoreChanges}
                  className="btn btn-sm text-xs px-3 py-1.5 bg-[var(--paper-dark)] text-[var(--ink-500)] border border-[var(--ink-200)] cursor-pointer">
                  📊 成绩变动记录
                </button>
                {showCertEntry && (
                  <button onClick={() => window.location.href = '/my-certificates'}
                    className="btn btn-sm text-xs px-3 py-1.5 bg-[var(--gold)] text-[var(--ink-900)] border-none cursor-pointer">
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
            style={{ background: 'var(--gold-glow)', border: '1px solid #ffe082', color: 'var(--gold-dark)' }}>
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold text-sm">主观题阅卷中</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gold-dark)' }}>客观题得分已出，主观题由人工判分中，请耐心等待</p>
            </div>
          </div>
        )}
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: '正确率', value: correctCount + wrongCount > 0 ? `${Math.round((correctCount / (correctCount + wrongCount)) * 100)}%` : '-', color: 'var(--sage)' },
            { label: '客观题得分', value: result.finalScore !== null ? `${result.finalScore - (result.subjectiveScore || 0)}` : '-', color: 'var(--fox)' },
            { label: '主观题得分', value: result.subjectiveScore !== null ? String(result.subjectiveScore) : '待判', color: 'var(--cyan)' },
            { label: '总题数', value: String(result.answers.length), color: 'var(--ink-500)' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-0.5 text-[var(--ink-400)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ═══ 考点画像 ═══ */}
        {kpAnalysis && kpAnalysis.kpResults.length > 0 && (
          <div ref={kpSectionRef} className="rounded-xl p-6 mb-8 card">
            <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">📊 我的考点画像</h3>

            {/* Overall rate */}
            <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--ink-100)' }}>
              <span className="text-xs text-[var(--ink-400)]">综合掌握率</span>
              <div className="flex-1 h-2.5 rounded-full bg-[var(--ink-100)]">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${kpAnalysis.overallRate}%`,
                  background: kpAnalysis.overallRate >= 80 ? 'var(--sage)' : kpAnalysis.overallRate >= 60 ? 'var(--gold)' : 'var(--verm)',
                }} />
              </div>
              <span className="text-sm font-bold text-[var(--ink-600)]">{kpAnalysis.overallRate}%</span>
            </div>

            {/* Individual KP bars */}
            {kpAnalysis.kpResults.map(kp => (
              <div key={kp.kpId} className="flex items-center gap-3 mb-2.5">
                <div className="w-28 text-xs font-medium truncate flex-shrink-0 text-[var(--ink-600)]"
                  title={kp.kpName}>
                  {kp.kpCode || kp.kpName}
                </div>
                <div className="flex-1 h-2 rounded-full bg-[var(--ink-100)]">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${kp.rate}%`,
                    background: LEVEL_COLORS[kp.level] || 'var(--gold)',
                  }} />
                </div>
                <div className="w-9 text-right text-xs font-medium text-[var(--ink-500)]">
                  {kp.rate}%
                </div>
                <div className="w-12 text-right">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap" style={{
                    background: `${(LEVEL_COLORS[kp.level] || 'var(--gold)')}18`,
                    color: LEVEL_COLORS[kp.level] || 'var(--gold)',
                  }}>
                    {kp.level}
                  </span>
                </div>
              </div>
            ))}

            {/* Strongest / Weakest hints */}
            <div className="mt-4 pt-3 flex items-center gap-6 text-xs" style={{ borderTop: '1px solid var(--ink-100)' }}>
              {kpAnalysis.strongest && (
                <div>
                  <span className="text-[var(--ink-400)]">💪 最强：</span>
                  <span style={{ color: 'var(--sage)', fontWeight: 600 }}>
                    {kpAnalysis.strongest.kpName}
                  </span>
                  <span className="text-[var(--ink-300)]"> — 继续保持</span>
                </div>
              )}
              {kpAnalysis.weakest && (
                <div>
                  <span className="text-[var(--ink-400)]">⚠️ 最弱：</span>
                  <span style={{ color: 'var(--verm)', fontWeight: 600 }}>
                    {kpAnalysis.weakest.kpName}
                  </span>
                  <span className="text-[var(--ink-300)]"> — 建议回看相关课程</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 薄弱考点推荐课程 ═══ */}
        {recommendations?.recommendedCourses?.length > 0 && (
          <div className="rounded-xl p-6 mb-8" style={{
            background: 'white',
            border: '1px solid var(--ink-100)',
            maxHeight: maxRecHeight > 0 ? maxRecHeight : undefined,
            overflowY: 'auto',
          }}>
            <h3 className="text-sm font-semibold mb-4 text-[var(--ink-700)]">📺 针对薄弱考点推荐课程</h3>
            {recommendations.recommendedCourses.map((group: any) => (
              <div key={group.kpId} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[var(--ink-700)]">{group.kpName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{
                    background: `${(LEVEL_COLORS[group.level] || 'var(--gold)')}18`,
                    color: LEVEL_COLORS[group.level] || 'var(--gold)',
                  }}>
                    {group.level}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.courses.map((course: any) => (
                    <div key={course.id} className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--ink-100)',
                    }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-[var(--ink-600)]">{course.title}</span>
                        {course.duration != null && (
                          <span className="flex-shrink-0 text-[var(--ink-300)]">{course.duration}分钟</span>
                        )}
                      </div>
                      <button onClick={() => router.push(`/video/${course.id}`)}
                        className="text-xs px-2.5 py-1 rounded-md border-none cursor-pointer font-medium flex-shrink-0 ml-2 bg-[var(--fox)] text-white">
                        去学习
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answer Details */}
        <div className="rounded-xl overflow-hidden card">
          <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--ink-100)]">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm text-[var(--ink-700)]">逐题解析</span>
              <div className="flex gap-1">
                {result.answers.map((a, i) => (
                  <span key={i} className="w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-medium" style={{
                    background: a.isCorrect === true ? 'var(--sage-glow)' : a.isCorrect === false ? 'var(--verm-glow)' : 'var(--gold-glow)',
                    color: a.isCorrect === true ? 'var(--sage)' : a.isCorrect === false ? 'var(--verm)' : 'var(--gold)',
                  }}>{i + 1}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowAll(!showAll)}
              className="text-xs px-3 py-1.5 rounded-md border-none cursor-pointer font-medium bg-[var(--paper-dark)] text-[var(--ink-500)]">
              {showAll ? '收起部分' : '展开全部'}
            </button>
          </div>

          <div className="divide-y border-[var(--ink-100)]">
            {result.answers.map((a, i) => {
              const visible = showAll || a.isCorrect === false || a.isCorrect === null;
              if (!visible) return null;

              return (
                <div key={a.questionId} className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Status badge */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{
                      background: a.isCorrect === true ? 'var(--sage-glow)' : a.isCorrect === false ? 'var(--verm-glow)' : 'var(--gold-glow)',
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
                        {kpAnalysis?.questionKps?.[a.questionId]?.map(kp => (
                          <span key={kp.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
                            {kp.code || kp.name}
                          </span>
                        ))}
                        {a.score !== null && (
                          <span className="text-[10px] text-[var(--ink-300)]">
                            得分：{a.score}
                          </span>
                        )}
                      </div>

                      {/* Question content */}
                      <p className="text-sm mb-4 leading-relaxed text-[var(--ink-700)]">{a.questionContent}</p>

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
                            if (isUserAnswer && isCorrectOption && a.isCorrect === true) { bg = 'var(--sage-glow)'; border = '1px solid #c8e6c9'; }
                            else if (isUserAnswer && !isCorrectOption) { bg = 'var(--verm-glow)'; border = '1px solid #fecaca'; }
                            else if (!isUserAnswer && isCorrectOption && a.isCorrect === false) { bg = 'var(--sage-glow)'; border = '1px solid #c8e6c9'; }

                            return (
                              <div key={o.label} className="p-2.5 rounded-lg text-xs flex items-center gap-2"
                                style={{ background: bg, border }}>
                                <span className="w-5 h-5 rounded-full flex items-center justify-center font-medium flex-shrink-0 text-[10px]"
                                  style={{ background: isUserAnswer ? 'var(--fox)' : 'var(--ink-50)', color: isUserAnswer ? 'white' : 'var(--ink-400)' }}>
                                  {o.label}
                                </span>
                                <span style={{ color: isUserAnswer ? 'var(--ink-700)' : 'var(--ink-500)' }}>{o.content}</span>
                                {isUserAnswer && <span className="text-[9px] text-[var(--ink-300)]">你的选择</span>}
                                {!isUserAnswer && isCorrectOption && a.isCorrect === false && (
                                  <span className="text-[9px]" style={{ color: 'var(--sage)' }}>正确答案</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Answers */}
                      <div className="text-xs space-y-1 mb-3 text-[var(--ink-500)]">
                        {a.yourAnswer !== null && (
                          <p>
                            <span className="font-medium">你的答案：</span>
                            <span style={{ color: a.isCorrect === true ? 'var(--sage)' : a.isCorrect === false ? 'var(--verm)' : 'var(--ink-500)' }}>
                              {formatAnswer(a)}
                            </span>
                          </p>
                        )}
                        {a.correctAnswer && a.isCorrect === false && (
                          <p>
                            <span className="font-medium">正确答案：</span>
                            <span style={{ color: 'var(--sage)' }}>{formatCorrect(a)}</span>
                          </p>
                        )}
                        {a.graderNote && (
                          <p className="mt-1 p-2 rounded" style={{ background: 'var(--paper)' }}>
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
                          <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: 'var(--paper-alt)', border: '1px solid var(--ink-100)', color: 'var(--ink-500)' }}>
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

      <ScoreReportModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        result={result}
      />

      {/* 成绩变动记录 Modal（脱敏版，不含操作人） */}
      {showScoreChanges && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowScoreChanges(false)}>
          <div className="rounded-2xl p-6 max-w-md w-[90%] max-h-[80vh] overflow-y-auto" style={{ background: 'var(--paper-bright, #fff)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold m-0" style={{ color: 'var(--ink-700)' }}>📊 成绩变动记录</h3>
              <button onClick={() => setShowScoreChanges(false)}
                className="bg-transparent border-none cursor-pointer text-lg" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>

            {loadingChanges ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--ink-300)' }}>加载中…</p>
            ) : scoreChanges.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">📭</p>
                <p className="text-sm" style={{ color: 'var(--ink-400)' }}>暂无成绩变动记录</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>成绩未被调整过</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scoreChanges.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--paper-dark, #f5f0eb)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono font-bold" style={{ color: 'var(--fox)' }}>
                        {c.fromScore ?? '?'} → {c.toScore ?? '?'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                        {new Date(c.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {c.reason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                        <span className="text-[10px] px-1.5 py-0.5 rounded mr-1" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>{c.action}</span>
                        {c.reason}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-center pt-2" style={{ color: 'var(--ink-300)' }}>
                  ※ 仅展示分数变化与原因，不显示操作人信息
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
