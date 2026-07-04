'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── 类型 ──
interface QuestionItem {
  id: number;
  index: number;
  type: string;
  content: string;
  correctRate: number;
  discrimination: number | null;
  avgTime: number;
  sampleCount: number;
}
interface QuestionDetail {
  id: number;
  content: string;
  type: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  correctRate: number;
  discrimination: number | null;
  avgTime: number;
  optionSelection: { label: string; count: number; rate: number }[];
  tierStats: {
    highGroup: { correct: number; total: number; rate: number };
    midGroup: { correct: number; total: number; rate: number };
    lowGroup: { correct: number; total: number; rate: number };
  };
  sampleCount: number;
}

// ── 常量 ──
const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
  FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例',
};

const DISCRIMINATION_COLORS = {
  great: '#2e7d32',
  good: '#558b2f',
  fair: '#f9a825',
  poor: '#e53935',
};

const INK_300 = '#999';
const INK_400 = '#777';
const INK_600 = '#444';

const CARD_STYLE = { background: 'var(--paper)', border: '1px solid var(--ink-200)', borderRadius: '10px' };

// ── 辅助函数 ──
function discLevel(d: number | null): { label: string; color: string; suggest: string } {
  if (d === null) return { label: '—', color: INK_300, suggest: '样本不足' };
  if (d >= 0.40) return { label: '优秀', color: DISCRIMINATION_COLORS.great, suggest: '好题' };
  if (d >= 0.30) return { label: '良好', color: DISCRIMINATION_COLORS.good, suggest: '可保留' };
  if (d >= 0.20) return { label: '尚可', color: DISCRIMINATION_COLORS.fair, suggest: '需修改' };
  return { label: '差', color: DISCRIMINATION_COLORS.poor, suggest: '建议淘汰' };
}

function scoreColor(val: number): string {
  if (val >= 80) return '#2e7d32';
  if (val >= 60) return '#e87a30';
  return '#e53935';
}

// ── 子组件 ──
function StatCard({ value, label, color, suffix }: { value: string | number; label: string; color?: string; suffix?: string }) {
  return (
    <div className="p-4 text-center" style={CARD_STYLE}>
      <div className="text-2xl font-bold" style={{ color: color || INK_600 }}>
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
        {suffix && <span className="text-sm font-normal ml-0.5" style={{ color: INK_400 }}>{suffix}</span>}
      </div>
      <div className="text-xs mt-1" style={{ color: INK_400 }}>{label}</div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="card p-10 text-center" style={CARD_STYLE}>
      <div className="text-sm" style={{ color: INK_300 }}>{message}</div>
      {sub && <div className="text-xs mt-1" style={{ color: INK_300 }}>{sub}</div>}
    </div>
  );
}

// ── 详情弹窗 ──
function QuestionDetailModal({
  questionId, examId, onClose,
}: {
  questionId: number; examId: number; onClose: () => void;
}) {
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.examAnalysis.questionDetail(examId, questionId)
      .then(setDetail)
      .catch((e: any) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [questionId, examId]);

  // 难度提示
  const difficultyHint = detail
    ? detail.correctRate >= 85 ? '此题偏简单'
    : detail.correctRate >= 50 ? '难度适中'
    : '此题偏难'
    : '';

  const sampleTooSmall = detail && detail.sampleCount < 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }}
        onClick={e => e.stopPropagation()}>

        {loading && <div className="p-12 text-center text-xs" style={{ color: INK_300 }}>加载中…</div>}

        {error && (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: '#e53935' }}>加载失败</p>
            <p className="text-xs mt-2" style={{ color: INK_400 }}>{error}</p>
            <button onClick={onClose} className="btn btn-outline btn-xs mt-3">关闭</button>
          </div>
        )}

        {detail && (
          <>
            {/* 负区分度红色警告 */}
            {detail.discrimination !== null && detail.discrimination < 0 && (
              <div className="p-3 mb-4 rounded-lg text-xs font-medium" style={{ background: '#e5393518', color: '#e53935', border: '1px solid #e5393544' }}>
                ⚠️ 此题区分度为负，高分段答对率低于低分段，请重点核查
              </div>
            )}

            {/* 样本量过小提示 */}
            {sampleTooSmall && (
              <div className="p-3 mb-4 rounded-lg text-xs" style={{ background: '#f9a82518', color: '#e87a30', border: '1px solid #f9a82544' }}>
                ℹ️ 样本量过小（{detail.sampleCount} 人），数据仅供参考
              </div>
            )}

            {/* 题目标题 */}
            <h3 className="text-sm font-semibold mb-3" style={{ color: INK_600 }}>
              #{questionId} · {TYPE_NAMES[detail.type] || detail.type}
            </h3>

            {/* 题干 */}
            <div className="p-3 rounded-lg mb-4 text-sm" style={{ background: 'var(--paper-dark)', whiteSpace: 'pre-wrap' }}>
              {detail.content}
            </div>

            {/* 选项 */}
            {detail.options.length > 0 && (
              <div className="mb-4 space-y-1.5 text-sm">
                {detail.options.map(o => (
                  <div key={o.label} className="flex items-center gap-2 p-1.5 rounded"
                    style={{ background: o.isCorrect ? '#2e7d3208' : 'transparent' }}>
                    <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                      style={{ background: o.isCorrect ? '#2e7d32' : 'var(--ink-200)', color: o.isCorrect ? '#fff' : INK_400 }}>
                      {o.label}
                    </span>
                    <span style={{ color: o.isCorrect ? '#2e7d32' : INK_600 }}>{o.text || '—'}</span>
                    {o.isCorrect && <span className="text-xs" style={{ color: '#2e7d32' }}>✓ 正确答案</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 基础指标行 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-2.5 rounded-lg text-center" style={{ background: 'var(--paper-dark)' }}>
                <div className="text-lg font-bold" style={{ color: scoreColor(detail.correctRate) }}>{detail.correctRate}%</div>
                <div className="text-xs mt-0.5" style={{ color: INK_400 }}>正确率 · {difficultyHint}</div>
              </div>
              <div className="p-2.5 rounded-lg text-center" style={{ background: 'var(--paper-dark)' }}>
                <div className="text-lg font-bold" style={{ color: discLevel(detail.discrimination).color }}>
                  {detail.discrimination !== null ? detail.discrimination.toFixed(2) : '—'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: INK_400 }}>
                  区分度 · {discLevel(detail.discrimination).label}
                  <span className="ml-1">· {discLevel(detail.discrimination).suggest}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg text-center" style={{ background: 'var(--paper-dark)' }}>
                <div className="text-lg font-bold" style={{ color: INK_600 }}>{detail.sampleCount}</div>
                <div className="text-xs mt-0.5" style={{ color: INK_400 }}>答题人数</div>
              </div>
            </div>

            {/* 选项选择率柱状图 */}
            {detail.optionSelection.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold mb-2" style={{ color: INK_600 }}>选项选择率</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={detail.optionSelection} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-200)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: INK_600 }} axisLine={{ stroke: 'var(--ink-200)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: INK_400 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--paper-dark)', border: '1px solid var(--ink-200)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: any) => [value, '选择人数']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {detail.optionSelection.map((opt, i) => {
                        const isCorrect = detail.options.find(o => o.label === opt.label)?.isCorrect;
                        return <Cell key={i} fill={isCorrect ? '#2e7d32' : opt.rate >= 20 ? '#f9a82588' : '#ccc'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 三分段答对率 */}
            <div className="mb-2">
              <h4 className="text-xs font-semibold mb-2" style={{ color: INK_600 }}>各分数段答对率</h4>
              <div className="space-y-2">
                {[
                  { label: '高分档（前27%）', data: detail.tierStats.highGroup, color: '#2e7d32' },
                  { label: '中档（中间46%）', data: detail.tierStats.midGroup, color: '#e87a30' },
                  { label: '低分档（后27%）', data: detail.tierStats.lowGroup, color: '#e53935' },
                ].map(tier => (
                  <div key={tier.label}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs" style={{ color: INK_400 }}>{tier.label}</span>
                      <span className="text-xs font-medium" style={{ color: tier.color }}>{tier.data.rate}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${Math.max(tier.data.rate, 2)}%`,
                        background: tier.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={onClose} className="btn btn-outline btn-sm">关闭</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 主页面 ──
export default function ExamQualityReportPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('discrimination');
  const [sortAsc, setSortAsc] = useState(true);

  // 详情弹窗
  const [detailQId, setDetailQId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.examAnalysis.qualityReport(examId);
      setReport(data);
    } catch (e: any) {
      setError(e.message || '加载质检报告失败');
    }
    setLoading(false);
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  // ── 排序 ──
  const sortedQuestions = report?.questions ? [...report.questions] : [];
  if (sortBy === 'discrimination') {
    sortedQuestions.sort((a: QuestionItem, b: QuestionItem) => {
      const da = a.discrimination ?? -999;
      const db = b.discrimination ?? -999;
      return sortAsc ? da - db : db - da;
    });
  } else if (sortBy === 'correctRate') {
    sortedQuestions.sort((a: QuestionItem, b: QuestionItem) =>
      sortAsc ? a.correctRate - b.correctRate : b.correctRate - a.correctRate
    );
  } else if (sortBy === 'index') {
    sortedQuestions.sort((a: QuestionItem, b: QuestionItem) =>
      sortAsc ? a.index - b.index : b.index - a.index
    );
  }

  // ── 检测边界状态 ──
  const hasNoData = !loading && report && report.overview.totalExaminees === 0;
  const allFullMarks = !loading && report && report.overview.totalExaminees > 0
    && report.overview.stdDev === 0 && report.overview.maxScore === report.overview.minScore;
  const allGoodDistinction = !loading && report?.questions
    && report.questions.length > 0
    && report.questions.every((q: QuestionItem) => q.discrimination !== null && q.discrimination >= 0.30);
  const smallSample = report?.overview.totalExaminees > 0 && report?.overview.totalExaminees < 10;

  // ── 切换排序 ──
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };
  const sortArrow = (field: string) => sortBy === field ? (sortAsc ? ' ↑' : ' ↓') : '';

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-xs" style={{ color: INK_300 }}>小狐狸正在分析试卷质量… 🦊</div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="card p-8 text-center max-w-md mx-auto mt-16" style={CARD_STYLE}>
          <div className="text-sm" style={{ color: '#e53935' }}>加载失败</div>
          <div className="text-xs mt-2" style={{ color: INK_400 }}>{error}</div>
          <button onClick={load} className="btn btn-fox btn-xs mt-3">重试</button>
          <button onClick={() => router.back()} className="btn btn-outline btn-xs mt-3 ml-2">返回</button>
        </div>
      </AppLayout>
    );
  }

  const { overview } = report;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>← 返回</button>
          <h1 className="page-title mb-0">📋 试卷质检报告</h1>
        </div>
        <button onClick={() => window.print()}
          className="btn btn-outline btn-sm">🖨️ 打印</button>
      </div>

      {/* 边界状态提示 */}
      {smallSample && (
        <div className="p-3 mb-4 rounded-lg text-xs" style={{ background: '#f9a82518', color: '#e87a30', border: '1px solid #f9a82544' }}>
          ℹ️ 样本量过小（{overview.totalExaminees} 人），数据仅供参考
        </div>
      )}
      {allFullMarks && (
        <div className="p-3 mb-4 rounded-lg text-xs" style={{ background: '#f9a82518', color: '#e87a30', border: '1px solid #f9a82544' }}>
          ℹ️ 所有学员成绩完全相同，成绩无区分度
        </div>
      )}
      {allGoodDistinction && (
        <div className="p-3 mb-4 rounded-lg text-xs font-medium" style={{ background: '#2e7d3208', color: '#2e7d32', border: '1px solid #2e7d3244' }}>
          ✅ 试卷质量良好，所有题目区分度 ≥ 0.30，无需调整
        </div>
      )}

      {/* ═══ 顶部 6 数字卡片 ═══ */}
      {hasNoData ? (
        <EmptyState message="考试进行中，暂无数据" sub="学员交卷后将自动生成质检报告" />
      ) : (
        <>
          <div className="grid grid-cols-6 gap-3 mb-6">
            <StatCard value={overview.totalExaminees} label="参考人数" color={INK_600} />
            <StatCard value={overview.avgScore} label="平均分" color={scoreColor(overview.avgScore)} suffix={`/${overview.totalScore}`} />
            <StatCard value={overview.maxScore} label="最高分" color="#2e7d32" suffix={`/${overview.totalScore}`} />
            <StatCard value={overview.minScore} label="最低分" color={overview.minScore < 60 ? '#e53935' : INK_600} suffix={`/${overview.totalScore}`} />
            <StatCard value={overview.passRate} label="及格率" color={scoreColor(overview.passRate)} suffix="%" />
            <StatCard value={overview.stdDev} label="标准差" color={overview.stdDev > 0 ? INK_600 : INK_300} />
          </div>

          {/* ═══ 题目质量列表 ═══ */}
          <div className="card overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-3 border-b text-xs font-medium" style={{ color: INK_400, borderColor: 'var(--ink-200)' }}>
              题目质量分析 · 共 {report.questions.length} 题 · 默认按区分度升序（问题最大排在前面）
            </div>

            {report.questions.length === 0 ? (
              <div className="p-10 text-center text-xs" style={{ color: INK_300 }}>暂无题目数据</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs border-b" style={{ color: INK_400, borderColor: 'var(--ink-200)' }}>
                      <th className="text-left px-4 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort('index')}>
                        序号{sortArrow('index')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ minWidth: 50 }}>题型</th>
                      <th className="text-left px-4 py-2.5 font-medium">题目内容</th>
                      <th className="text-right px-4 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort('correctRate')}>
                        正确率{sortArrow('correctRate')}
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort('discrimination')} style={{ minWidth: 90 }}>
                        区分度{sortArrow('discrimination')}
                      </th>
                      <th className="text-center px-4 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuestions.map((q: QuestionItem) => {
                      const disc = discLevel(q.discrimination);
                      const sampleWarn = q.sampleCount > 0 && q.sampleCount < 30;
                      return (
                        <tr key={q.id} className="border-t" style={{ borderColor: 'var(--ink-100)', opacity: sampleWarn ? 0.7 : 1 }}>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: INK_400 }}>{q.index}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: INK_400 }}>
                              {TYPE_NAMES[q.type] || q.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs truncate max-w-[280px]" style={{ color: INK_600 }}>{q.content}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium" style={{ color: scoreColor(q.correctRate) }}>
                            {q.correctRate}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-semibold" style={{ color: disc.color }}>
                              {q.discrimination !== null ? q.discrimination.toFixed(2) : '—'}
                            </span>
                            <span className="text-xs ml-1" style={{ color: disc.color }}>
                              {q.discrimination !== null ? `· ${disc.label}` : ''}
                            </span>
                            {sampleWarn && <span className="text-xs ml-1" style={{ color: INK_300 }}>({q.sampleCount}人)</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => setDetailQId(q.id)}
                              className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                              详情
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 详情弹窗 */}
      {detailQId !== null && (
        <QuestionDetailModal
          questionId={detailQId}
          examId={examId}
          onClose={() => setDetailQId(null)}
        />
      )}
    </AppLayout>
  );
}
