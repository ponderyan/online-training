'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import ScoreReportModal from './ScoreReportModal';
import type { ExamResult as ExamResultData, KpAnalysisData } from './result-constants';
import { DonutChart } from './donut-chart';
import { KpAnalysisCard } from './kp-analysis-card';
import { RecommendationsCard } from './recommendations-card';
import { AnswerDetailList } from './answer-detail-list';
import { ScoreChangesModal } from './score-changes-modal';

export default function ExamResult() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<ExamResultData | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="min-h-dvh-fb flex items-center justify-center p-4 bg-[var(--paper)]">
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
    <div className="min-h-dvh-fb flex flex-col items-center justify-center bg-[var(--paper)]">
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

  return (
    <>
      <title>考试结果 · 狐学</title>
      <div className="min-h-dvh-fb bg-[var(--paper)]">
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
                <span className="text-[var(--sage)]">● {correctCount} 正确</span>
                <span className="text-[var(--verm)]">● {wrongCount} 错误</span>
                {pendingCount > 0 && <span className="text-[var(--gold)]">● {pendingCount} 待判</span>}
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
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3 bg-[var(--gold-glow)] text-[var(--gold-dark)]"
            style={{  border: '1px solid var(--gold-light)',  }}>
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold text-sm">主观题阅卷中</p>
              <p className="text-[var(--gold-dark)] text-xs mt-0.5">客观题得分已出，主观题由人工判分中，请耐心等待</p>
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
          <KpAnalysisCard kpAnalysis={kpAnalysis} sectionRef={kpSectionRef} />
        )}

        {/* ═══ 薄弱考点推荐课程 ═══ */}
        {recommendations?.recommendedCourses?.length > 0 && (
          <RecommendationsCard recommendations={recommendations} maxHeight={maxRecHeight} />
        )}

        {/* Answer Details */}
        <AnswerDetailList answers={result.answers} questionKps={kpAnalysis?.questionKps} />
      </div>
    </div>

      <ScoreReportModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        result={result}
      />

      {/* 成绩变动记录 Modal（脱敏版，不含操作人） */}
      {showScoreChanges && (
        <ScoreChangesModal
          changes={scoreChanges}
          loading={loadingChanges}
          onClose={() => setShowScoreChanges(false)}
        />
      )}
    </>
  );
}
