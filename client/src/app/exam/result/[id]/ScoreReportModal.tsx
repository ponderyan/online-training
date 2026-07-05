'use client';

/**
 * 专业版考试成绩单弹窗 / 打印组件 v2
 *
 * 设计理念：
 * - 正式成绩单排版，适合打印/存档
 * - 白底+暖色点缀，B&W 打印也清晰 
 * - 打印内容独立渲染在 DOM 顶层（不在遮罩内），避免 CSS 嵌套冲突
 * - 不含逐题解析（解析在页面里，不出现在成绩单上）
 */

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

interface Props {
  open: boolean;
  onClose: () => void;
  result: ExamResult;
}

/** 成绩单正文 — 屏幕和打印共用 */
function ReportCard({ result }: { result: ExamResult }) {
  const correctCount = result.answers.filter(a => a.isCorrect === true).length;
  const wrongCount = result.answers.filter(a => a.isCorrect === false).length;
  const pendingCount = result.answers.filter(a => a.isCorrect === null).length;
  const isPassed = result.isPassed === true;
  const objScore = result.finalScore !== null
    ? result.finalScore - (result.subjectiveScore || 0)
    : null;
  const accuracy = correctCount + wrongCount > 0
    ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
    : null;

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="score-report-card">
      {/* ===== 页眉 ===== */}
      <div className="flex items-center justify-between pb-6 mb-6"
        style={{ borderBottom: '2px solid var(--fox)' }}>
        <FoxLogo.Light size={36} />
        <div className="text-right">
          <h1 className="text-xl font-bold tracking-wide"
            style={{ color: 'var(--ink-800)' }}>
            考试成绩单
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>
            Examination Score Report
          </p>
        </div>
      </div>

      {/* ===== 考试信息 ===== */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>
          考试信息
        </h2>
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="py-1.5 pr-4 w-24" style={{ color: 'var(--ink-400)' }}>考试名称</td>
              <td className="py-1.5 font-medium" style={{ color: 'var(--ink-700)' }}>{result.examTitle}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4" style={{ color: 'var(--ink-400)' }}>试卷名称</td>
              <td className="py-1.5" style={{ color: 'var(--ink-600)' }}>{result.paperName}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4" style={{ color: 'var(--ink-400)' }}>交卷时间</td>
              <td className="py-1.5" style={{ color: 'var(--ink-600)' }}>
                {result.submittedAt
                  ? new Date(result.submittedAt).toLocaleString('zh-CN')
                  : '—'}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4" style={{ color: 'var(--ink-400)' }}>打印日期</td>
              <td className="py-1.5" style={{ color: 'var(--ink-600)' }}>{today}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== 成绩明细 ===== */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>
          成绩明细
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'var(--paper-dark)' }}>
              <th className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--ink-500)' }}>项目</th>
              <th className="text-right py-2.5 px-3 font-medium" style={{ color: 'var(--ink-500)' }}>得分</th>
              <th className="text-right py-2.5 px-3 font-medium" style={{ color: 'var(--ink-500)' }}>满分</th>
              <th className="text-right py-2.5 px-3 font-medium" style={{ color: 'var(--ink-500)' }}>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--ink-100)' }}>
              <td className="py-2.5 px-3" style={{ color: 'var(--ink-600)' }}>客观题得分</td>
              <td className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--ink-700)' }}>
                {objScore !== null ? objScore : '—'}
              </td>
              <td className="py-2.5 px-3 text-right" style={{ color: 'var(--ink-400)' }}>
                {result.totalScore ?? '—'}
              </td>
              <td className="py-2.5 px-3 text-right text-[10px]" style={{ color: 'var(--ink-300)' }}>
                共 {correctCount + wrongCount} 题
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--ink-100)' }}>
              <td className="py-2.5 px-3" style={{ color: 'var(--ink-600)' }}>主观题得分</td>
              <td className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--ink-700)' }}>
                {result.subjectiveScore !== null ? result.subjectiveScore : '—'}
              </td>
              <td className="py-2.5 px-3 text-right" style={{ color: 'var(--ink-400)' }}>
                {result.totalScore ?? '—'}
              </td>
              <td className="py-2.5 px-3 text-right text-[10px]" style={{ color: 'var(--ink-300)' }}>
                {result.subjectiveScore !== null ? '已评分' : '待评分'}
              </td>
            </tr>
            <tr style={{
              background: isPassed ? '#f0faf0' : '#fef2f2',
              borderTop: '2px solid var(--ink-200)',
            }}>
              <td className="py-3 px-3 font-bold" style={{ color: 'var(--ink-700)' }}>总分</td>
              <td className="py-3 px-3 text-right font-bold text-base"
                style={{ color: isPassed ? '#2e7d32' : '#ef4444' }}>
                {result.finalScore ?? '—'}
              </td>
              <td className="py-3 px-3 text-right font-medium" style={{ color: 'var(--ink-400)' }}>
                {result.totalScore ?? '—'}
              </td>
              <td className="py-3 px-3 text-right">
                <span className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: isPassed ? '#2e7d32' : '#ef4444' }}>
                  {isPassed ? '✓ 合格' : '✗ 不合格'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== 统计概览 ===== */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '正确率', value: accuracy !== null ? `${accuracy}%` : '—', color: '#2e7d32' },
          { label: '答对', value: String(correctCount), color: 'var(--ink-700)' },
          { label: '答错', value: String(wrongCount), color: 'var(--ink-700)' },
          { label: '待判', value: String(pendingCount), color: '#f59e0b' },
          { label: '总题数', value: String(result.answers.length), color: 'var(--ink-500)' },
          { label: '判分状态',
            value: result.finalScore !== null ? '已发布' : '待发布',
            color: result.finalScore !== null ? '#2e7d32' : '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="text-center py-3 rounded-lg"
            style={{ background: 'var(--paper-dark)' }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ===== 页脚 ===== */}
      <div className="mt-8 pt-4 text-center text-[9px] leading-relaxed"
        style={{ borderTop: '1px solid var(--ink-100)', color: 'var(--ink-300)' }}>
        <p>本成绩单由 狐学（FoxLearn）智能在线培训考试平台 自动生成</p>
        <p className="mt-0.5">仅供学习参考 · 如有疑问请联系培训机构</p>
      </div>
    </div>
  );
}

export default function ScoreReportModal({ open, onClose, result }: Props) {
  return (
    <>
      {/* ===== 全局打印 CSS ===== */}
      <style>{`
        /* 屏幕状态：打印内容隐藏 */
        .score-report-print-only {
          display: none;
        }

        /* 打印状态：隐藏屏幕内容，只显示成绩单 */
        @media print {
          body > *:not(.score-report-print-only):not(.score-report-print-only *) {
            display: none !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .score-report-print-only {
            display: block !important;
            position: static !important;
            width: 100% !important;
            padding: 20mm 15mm !important;
            box-sizing: border-box !important;
          }
          .score-report-card {
            max-width: 720px !important;
            margin: 0 auto !important;
          }
          .score-report-card * {
            visibility: visible !important;
          }
          .score-report-no-print {
            display: none !important;
          }
          .score-report-overlay {
            display: none !important;
          }
        }
      `}</style>

      {/* ===== 屏幕：遮罩弹窗 ===== */}
      {open && (
        <div className="score-report-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(26,23,18,0.45)', backdropFilter: 'blur(2px)' }}>
          <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{ background: '#fff' }}>
            
            {/* 预览 */}
            <div className="p-8">
              <ReportCard result={result} />
            </div>

            {/* 按钮栏 */}
            <div className="score-report-no-print flex items-center justify-end gap-3 px-8 pb-6 pt-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-95 active:scale-95"
                style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)', border: 'none' }}>
                关闭
              </button>
              <button onClick={() => window.print()}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:brightness-110 active:scale-95"
                style={{ background: 'var(--fox)', color: '#fff', border: 'none' }}>
                🖨️ 打印成绩单
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 打印内容（DOM顶层，屏幕隐藏，打印显示） ===== */}
      <div className="score-report-print-only">
        <ReportCard result={result} />
      </div>
    </>
  );
}
