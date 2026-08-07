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
          <h1 className="text-[var(--ink-800)] text-xl font-bold tracking-wide">
            考试成绩单
          </h1>
          <p className="text-[var(--ink-400)] text-[10px] mt-0.5">
            Examination Score Report
          </p>
        </div>
      </div>

      {/* ===== 考试信息 ===== */}
      <div className="mb-6">
        <h2 className="text-[var(--ink-600)] text-sm font-semibold mb-3">
          考试信息
        </h2>
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="text-[var(--ink-400)] py-1.5 pr-4 w-24">考试名称</td>
              <td className="text-[var(--ink-700)] py-1.5 font-medium">{result.examTitle}</td>
            </tr>
            <tr>
              <td className="text-[var(--ink-400)] py-1.5 pr-4">试卷名称</td>
              <td className="text-[var(--ink-600)] py-1.5">{result.paperName}</td>
            </tr>
            <tr>
              <td className="text-[var(--ink-400)] py-1.5 pr-4">交卷时间</td>
              <td className="text-[var(--ink-600)] py-1.5">
                {result.submittedAt
                  ? new Date(result.submittedAt).toLocaleString('zh-CN')
                  : '—'}
              </td>
            </tr>
            <tr>
              <td className="text-[var(--ink-400)] py-1.5 pr-4">打印日期</td>
              <td className="text-[var(--ink-600)] py-1.5">{today}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== 成绩明细 ===== */}
      <div className="mb-6">
        <h2 className="text-[var(--ink-600)] text-sm font-semibold mb-3">
          成绩明细
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--paper-dark)]">
              <th className="text-[var(--ink-500)] text-left py-2.5 px-3 font-medium">项目</th>
              <th className="text-[var(--ink-500)] text-right py-2.5 px-3 font-medium">得分</th>
              <th className="text-[var(--ink-500)] text-right py-2.5 px-3 font-medium">满分</th>
              <th className="text-[var(--ink-500)] text-right py-2.5 px-3 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--ink-100)' }}>
              <td className="text-[var(--ink-600)] py-2.5 px-3">客观题得分</td>
              <td className="text-[var(--ink-700)] py-2.5 px-3 text-right font-medium">
                {objScore !== null ? objScore : '—'}
              </td>
              <td className="text-[var(--ink-400)] py-2.5 px-3 text-right">
                {result.totalScore ?? '—'}
              </td>
              <td className="text-[var(--ink-300)] py-2.5 px-3 text-right text-[10px]">
                共 {correctCount + wrongCount} 题
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--ink-100)' }}>
              <td className="text-[var(--ink-600)] py-2.5 px-3">主观题得分</td>
              <td className="text-[var(--ink-700)] py-2.5 px-3 text-right font-medium">
                {result.subjectiveScore !== null ? result.subjectiveScore : '—'}
              </td>
              <td className="text-[var(--ink-400)] py-2.5 px-3 text-right">
                {result.totalScore ?? '—'}
              </td>
              <td className="text-[var(--ink-300)] py-2.5 px-3 text-right text-[10px]">
                {result.subjectiveScore !== null ? '已评分' : '待评分'}
              </td>
            </tr>
            <tr style={{
              background: isPassed ? 'var(--success-pale)' : 'var(--error-pale)',
              borderTop: '2px solid var(--ink-200)',
            }}>
              <td className="text-[var(--ink-700)] py-3 px-3 font-bold">总分</td>
              <td className="py-3 px-3 text-right font-bold text-base"
                style={{ color: isPassed ? 'var(--sage)' : 'var(--error)' }}>
                {result.finalScore ?? '—'}
              </td>
              <td className="text-[var(--ink-400)] py-3 px-3 text-right font-medium">
                {result.totalScore ?? '—'}
              </td>
              <td className="py-3 px-3 text-right">
                <span className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: isPassed ? 'var(--sage)' : 'var(--error)' }}>
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
          { label: '正确率', value: accuracy !== null ? `${accuracy}%` : '—', color: 'var(--sage)' },
          { label: '答对', value: String(correctCount), color: 'var(--ink-700)' },
          { label: '答错', value: String(wrongCount), color: 'var(--ink-700)' },
          { label: '待判', value: String(pendingCount), color: 'var(--warning)' },
          { label: '总题数', value: String(result.answers.length), color: 'var(--ink-500)' },
          { label: '判分状态',
            value: result.finalScore !== null ? '已发布' : '待发布',
            color: result.finalScore !== null ? 'var(--sage)' : 'var(--warning)' },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--paper-dark)] text-center py-3 rounded-lg">
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[var(--ink-400)] text-[10px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ===== 页脚 ===== */}
      <div className="mt-8 pt-4 text-center text-[9px] leading-relaxed text-[var(--ink-300)]"
        style={{ borderTop: '1px solid var(--ink-100)',  }}>
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
          body * { visibility: hidden; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .score-report-print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20mm 15mm !important;
            box-sizing: border-box !important;
            visibility: visible !important;
          }
          .score-report-print-only * {
            visibility: visible !important;
          }
          .score-report-card {
            max-width: 720px !important;
            margin: 0 auto !important;
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
        <div className="score-report-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(26,23,18,0.45)]"
          style={{  backdropFilter: 'blur(2px)' }}>
          <div className="bg-[var(--paper-bright)] relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            
            {/* 预览 */}
            <div className="p-8">
              <ReportCard result={result} />
            </div>

            {/* 按钮栏 */}
            <div className="score-report-no-print flex items-center justify-end gap-3 px-8 pb-6 pt-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-95 active:scale-95 bg-[var(--paper-dark)] text-[var(--ink-500)]"
                style={{   border: 'none' }}>
                关闭
              </button>
              <button onClick={() => window.print()}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:brightness-110 active:scale-95 bg-[var(--fox)] text-[#fff]"
                style={{   border: 'none' }}>
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
