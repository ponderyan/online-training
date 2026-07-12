'use client';

export default function ExamInfoBar({
  examTitle,
  isOpenBook,
  openBookRules,
  studentDisplayName,
  studentNumber,
  avatar,
  timeLeft,
  onShowSubmitModal,
}: {
  examTitle: string;
  isOpenBook?: boolean;
  openBookRules?: string;
  studentDisplayName: string;
  studentNumber: string | null;
  avatar: string | null;
  timeLeft: number;
  onShowSubmitModal: () => void;
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between flex-shrink-0 h-16 px-6 text-white bg-gradient-to-r from-[var(--ink-900)] to-[var(--ink-800)]">
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
        <span className={`font-serif text-2xl font-bold tabular-nums tracking-wide ${
          timeLeft < 60 ? 'text-[var(--verm-light)] animate-pulse-fast'
          : timeLeft < 300 ? 'text-[var(--gold-light)]'
          : 'text-white'
        }`}>
          {formatTime(timeLeft)}
        </span>
        <button onClick={onShowSubmitModal}
          className="text-sm font-semibold px-5 py-2 rounded-lg border-none cursor-pointer text-white bg-[var(--fox)] hover:bg-[var(--fox-dark)] transition-all hover:shadow-[0_4px_12px_var(--fox-glow)]">
          交卷
        </button>
      </div>
    </div>
  );
}
