'use client';

const TYPE_ICONS: Record<string, string> = {
  SINGLE_CHOICE: '⭕',
  MULTIPLE_CHOICE: '☑️',
  TRUE_FALSE: '✓✕',
  FILL_BLANK: '＿＿',
  SHORT_ANSWER: '📝',
  CASE_STUDY: '📄',
};

export default function ExamInfoBar({
  examTitle,
  isOpenBook,
  openBookRules,
  studentDisplayName,
  studentNumber,
  avatar,
  timeLeft,
  totalDuration,
  currentQuestion,
  totalQuestions,
  currentQuestionType,
  currentQuestionScore,
  timeMode,
  onShowSubmitModal,
}: {
  examTitle: string;
  isOpenBook?: boolean;
  openBookRules?: string;
  studentDisplayName: string;
  studentNumber: string | null;
  avatar: string | null;
  timeLeft: number;
  totalDuration: number; // 总时长（秒），用于计算进度条
  currentQuestion: number; // 当前题号（1-based）
  totalQuestions: number;
  currentQuestionType?: string;
  currentQuestionScore?: number;
  timeMode?: 'FIXED' | 'FLEXIBLE';
  onShowSubmitModal: () => void;
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // 剩余时间百分比与颜色档位
  const pct = totalDuration > 0 ? Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100)) : 0;
  const urgent = pct < 10;       // <10% 紧急（红，闪烁）
  const warning = pct < 30;      // <30% 警告（橙）
  const barColor = urgent ? 'var(--verm)' : warning ? 'var(--gold)' : 'var(--fox)';
  const typeLabel = currentQuestionType
    ? (currentQuestionType === 'SINGLE_CHOICE' ? '单选题' :
       currentQuestionType === 'MULTIPLE_CHOICE' ? '多选题' :
       currentQuestionType === 'TRUE_FALSE' ? '判断题' :
       currentQuestionType === 'FILL_BLANK' ? '填空题' :
       currentQuestionType === 'SHORT_ANSWER' ? '简答题' :
       currentQuestionType === 'CASE_STUDY' ? '案例题' : currentQuestionType)
    : '';
  const typeIcon = currentQuestionType ? (TYPE_ICONS[currentQuestionType] || '❓') : '';

  return (
    <div className="flex-shrink-0 text-white bg-gradient-to-r from-[var(--ink-900)] to-[var(--ink-800)]">
      {/* 第一行：考生信息 / 考试名 / 计时+交卷 */}
      <div className="flex items-center justify-between h-16 px-6">
        {/* 左区：考生信息 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-[var(--fox-glow-strong)] text-[var(--fox-light)]">
            {avatar ? (
              <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              studentDisplayName?.charAt(0) || '?'
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{studentDisplayName}</div>
            {studentNumber && <div className="text-xs text-[var(--ink-300)]">{studentNumber}</div>}
          </div>
        </div>

        {/* 中区：考试名称 */}
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg font-bold tracking-wide hidden md:block">{examTitle}</h1>
          {isOpenBook !== undefined && (
            <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${isOpenBook ? 'bg-[rgba(46,125,50,0.2)] text-[#6ab76f]' : 'bg-[rgba(196,188,176,0.15)] text-[var(--ink-300)]'}`}>
              {isOpenBook ? '开卷' : '闭卷'}
            </span>
          )}
        </div>

        {/* 右区：计时 + 交卷 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🕐</span>
            <div className="flex flex-col items-end leading-none">
              <span className={`font-serif text-2xl font-bold tabular-nums tracking-wide ${
                timeLeft < 60 ? 'text-[var(--verm-light)] animate-pulse-fast'
                : timeLeft < 300 ? 'text-[var(--gold-light)]'
                : 'text-white'
              }`}>
                {formatTime(timeLeft)}
              </span>
              <span className="text-[10px] text-[var(--ink-300)] mt-0.5">
                {timeMode === 'FIXED' ? '统一开考' : '剩余时间'}
              </span>
            </div>
          </div>
          <button onClick={onShowSubmitModal}
            className="text-sm font-semibold px-5 py-2 rounded-lg border-none cursor-pointer text-white bg-[var(--fox)] hover:bg-[var(--fox-dark)] transition-all hover:shadow-[0_4px_12px_var(--fox-glow)]">
            交卷
          </button>
        </div>
      </div>

      {/* 第二行：计时进度条 + 题目信息 */}
      <div className="px-6 pb-2.5 flex items-center gap-4">
        {/* 计时进度条 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-28 h-1.5 rounded-full overflow-hidden bg-[rgba(255,255,255,0.12)]">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'animate-pulse-fast' : ''}`}
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <span className="text-[10px] tabular-nums w-9 text-right" style={{ color: barColor }}>
            {Math.round(pct)}%
          </span>
        </div>

        {/* 分隔点 */}
        <span className="text-[var(--ink-400)] text-xs">·</span>

        {/* 题目信息 */}
        <div className="flex items-center gap-2 text-xs text-[var(--ink-300)]">
          <span>
            题目 <span className="text-white font-semibold tabular-nums">{currentQuestion}</span>
            /<span className="tabular-nums">{totalQuestions}</span>
          </span>
          {typeLabel && (
            <>
              <span className="text-[var(--ink-400)]">·</span>
              <span className="flex items-center gap-1">
                <span className="text-[11px]">{typeIcon}</span>
                <span>{typeLabel}</span>
              </span>
            </>
          )}
          {currentQuestionScore != null && (
            <>
              <span className="text-[var(--ink-400)]">·</span>
              <span><span className="text-white font-semibold">{currentQuestionScore}</span>分</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
