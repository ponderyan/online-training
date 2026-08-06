'use client';

interface ExamPreCheckProps {
  exam: {
    title: string;
    durationMinutes: number;
    questions: any[];
    isOpenBook?: boolean;
    openBookRules?: string;
    tabSwitchLimit?: number;
    timeMode: 'FIXED' | 'FLEXIBLE';
    rules?: { lateEntryMinutes: number; earlyExitMinutes: number; countdownWarningMinutes: number };
  };
  onStart: () => void;
}

/**
 * 考前须知页 — 展示考试规则，确认后开始
 */
export default function ExamPreCheck({ exam, onStart }: ExamPreCheckProps) {
  return (
    <div className="min-h-dvh-fb flex items-center justify-center p-4 bg-[var(--paper)]">
      <div className="max-w-lg w-full bg-[var(--paper-bright)] rounded-2xl border border-[var(--ink-100)] shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-xl font-bold text-[var(--ink-700)] font-serif">{exam.title}</h1>
          <p className="text-xs text-[var(--ink-400)] mt-1">请仔细阅读以下考试规则</p>
        </div>

        <div className="space-y-3 mb-6 text-sm">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
            <span className="text-lg">⏱</span>
            <div>
              <span className="font-medium text-[var(--ink-700)]">考试时长</span>
              <span className="ml-2 text-[var(--ink-500)]">{exam.durationMinutes} 分钟</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
            <span className="text-lg">📝</span>
            <div>
              <span className="font-medium text-[var(--ink-700)]">题目数量</span>
              <span className="ml-2 text-[var(--ink-500)]">{exam.questions.length} 题</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
            <span className="text-lg">{exam.isOpenBook ? '📖' : '🔒'}</span>
            <div>
              <span className="font-medium text-[var(--ink-700)]">考试形式</span>
              <span className="ml-2 text-[var(--ink-500)]">{exam.isOpenBook ? '开卷考试' : '闭卷考试'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
            <span className="text-lg">🖥</span>
            <div>
              <span className="font-medium text-[var(--ink-700)]">切屏限制</span>
              <span className="ml-2 text-[var(--ink-500)]">最多 {exam.tabSwitchLimit || 5} 次，超出将强制交卷</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
            <span className="text-lg">🕐</span>
            <div>
              <span className="font-medium text-[var(--ink-700)]">开考模式</span>
              <span className="ml-2 text-[var(--ink-500)]">{exam.timeMode === 'FIXED' ? '统一开考（不可暂停）' : '灵活模式（可断点续考）'}</span>
            </div>
          </div>
          {exam.rules && exam.rules.lateEntryMinutes > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
              <span className="text-lg">🚫</span>
              <div>
                <span className="font-medium text-[var(--ink-700)]">迟到禁入</span>
                <span className="ml-2 text-[var(--ink-500)]">开考 {exam.rules.lateEntryMinutes} 分钟后不可入场</span>
              </div>
            </div>
          )}
          {exam.rules && exam.rules.earlyExitMinutes > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--paper)]">
              <span className="text-lg">⏳</span>
              <div>
                <span className="font-medium text-[var(--ink-700)]">最早交卷</span>
                <span className="ml-2 text-[var(--ink-500)]">开考 {exam.rules.earlyExitMinutes} 分钟后方可交卷</span>
              </div>
            </div>
          )}
        </div>

        {exam.isOpenBook && exam.openBookRules && (
          <div className="mb-6 p-3 rounded-lg bg-[var(--sage-glow)] border border-[var(--sage)] text-xs text-[var(--ink-600)]">
            <span className="font-medium">📖 开卷规则：</span>{exam.openBookRules}
          </div>
        )}

        <div className="mb-6 p-3 rounded-lg bg-[var(--gold-glow)] border border-[var(--gold)] text-xs text-[var(--ink-600)] space-y-1">
          <p>⚠️ 注意事项：</p>
          <p>· 考试期间需保持全屏模式，禁止切屏</p>
          <p>· 答案自动保存，如遇断网请勿关闭页面</p>
          <p>· 时间结束后系统将自动交卷</p>
        </div>

        <button onClick={onStart}
          className="w-full py-3 rounded-xl text-base font-semibold text-white bg-[var(--fox)] border-none cursor-pointer hover:bg-[var(--fox-dark)] hover:shadow-[0_4px_16px_var(--fox-glow)] transition-all">
          我已了解，开始考试 →
        </button>
      </div>
    </div>
  );
}
