// 学习画像摘要 + 四项摘要卡片（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import type { LearningReport, WeakAreaItem } from './report-types';

export function ProfileSummaryCard({ data, practiceTrend, weakAreas }: {
  data: LearningReport;
  practiceTrend: any[];
  weakAreas: WeakAreaItem[];
}) {
  const streak = data.streak;
  const summary = data.summary;
  // 从 practiceTrend 汇总练习数量与平均正确率
  const practiceCount = practiceTrend.reduce(
    (sum, d) => sum + (d.totalQuestions || 0), 0,
  );
  const totalCorrect = practiceTrend.reduce(
    (sum, d) => sum + (d.correctCount || 0), 0,
  );
  const avgAccuracy = practiceCount > 0
    ? Math.round((totalCorrect / practiceCount) * 100)
    : (summary?.passRate ?? 0);
  const weakName = weakAreas[0]?.kpName || '无';
  return (
    <div
      className="card p-5"
      style={{ background: 'linear-gradient(135deg, var(--paper-bright) 0%, var(--paper-light) 100%)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🦊</span>
          <span className="text-[var(--ink-700)] text-sm font-semibold">
            学习画像摘要
          </span>
        </div>
        <span className="text-[var(--ink-300)] text-xs">
          最近30天 · {data.recent30DayActive} 天活跃
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-3 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">📅</span>
            <span className="text-[var(--ink-400)] text-xs">累计学习天数</span>
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
            {streak?.totalActiveDays ?? 0}
            <span className="text-[var(--ink-400)] text-xs font-normal ml-1">天</span>
          </div>
        </div>
        <div className="rounded-lg p-3 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">✏️</span>
            <span className="text-[var(--ink-400)] text-xs">练习数量</span>
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
            {practiceCount}
            <span className="text-[var(--ink-400)] text-xs font-normal ml-1">题</span>
          </div>
        </div>
        <div className="rounded-lg p-3 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">🎯</span>
            <span className="text-[var(--ink-400)] text-xs">平均正确率</span>
          </div>
          <div className="stat-card-value text-[var(--fox)]" style={{ fontSize: '1.5rem',  }}>
            {avgAccuracy}
            <span className="text-[var(--ink-400)] text-xs font-normal ml-1">%</span>
          </div>
        </div>
        <div className="rounded-lg p-3 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">⚠️</span>
            <span className="text-[var(--ink-400)] text-xs">薄弱环节</span>
          </div>
          <div className="text-sm font-semibold truncate" style={{ color: weakAreas[0] ? 'var(--verm)' : 'var(--ink-400)' }} title={weakName}>
            {weakName}
          </div>
          {weakAreas[0] && (
            <div className="text-[var(--ink-300)] text-xs mt-0.5">
              掌握率 {weakAreas[0].rate}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SummaryCards({ summary, onGoCertificates }: {
  summary: LearningReport['summary'] | undefined;
  onGoCertificates: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 考试通过率 */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
            📋
          </div>
          <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
            考试通过率
          </span>
        </div>
        <div className="stat-card-value">
          {summary ? summary.passRate : 0}%
        </div>
        <div className="text-[var(--ink-400)] flex gap-3 mt-2 text-xs">
          <span>通过 <strong className="text-[var(--sage)]">{summary?.passed || 0}</strong></span>
          <span>未通过 <strong className="text-[var(--error)]">{summary?.failed || 0}</strong></span>
          <span>待评分 <strong className="text-[var(--fox)]">{summary?.pending || 0}</strong></span>
        </div>
      </div>

      {/* 总学时 */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
            🕐
          </div>
          <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
            总学时
          </span>
        </div>
        <div className="stat-card-value">
          {summary?.totalHours || 0}
          <span className="text-[var(--ink-400)] text-base font-normal ml-1">h</span>
        </div>
        <div className="text-[var(--ink-400)] flex gap-3 mt-2 text-xs">
          <span>已审核 <strong className="text-[var(--sage)]">{summary?.approvedHours || 0}</strong></span>
          <span>待审核 <strong className="text-[var(--fox)]">{summary?.pendingHours || 0}</strong></span>
          <span>已驳回 <strong className="text-[var(--error)]">{summary?.rejectedHours || 0}</strong></span>
        </div>
      </div>

      {/* 证书 */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
            🏅
          </div>
          <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
            证书数
          </span>
        </div>
        <div className="stat-card-value">
          {summary?.certificateCount || 0}
        </div>
        <div className="mt-2">
          <button onClick={onGoCertificates}
            className="text-xs text-[var(--fox)]" style={{  textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
            查看全部证书 →
          </button>
        </div>
      </div>

      {/* 平均分 */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
            📊
          </div>
          <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
            平均分
          </span>
        </div>
        <div className="stat-card-value">
          {summary?.avgScore ?? 0}
          <span className="text-[var(--ink-400)] text-base font-normal ml-1">分</span>
        </div>
      </div>
    </div>
  );
}
