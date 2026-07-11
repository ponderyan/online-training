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
    <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ height: '64px' }}>
      {/* 左区：考生信息 */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            studentDisplayName?.charAt(0) || '?'
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{studentDisplayName}</div>
          {studentNumber && <div className="text-xs text-slate-400">{studentNumber}</div>}
        </div>
      </div>

      {/* 中区：考试名称 */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold hidden md:block">{examTitle}</h1>
        {isOpenBook !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpenBook ? 'bg-green-100 text-green-800' : 'bg-slate-600 text-slate-200'}`}>
            {isOpenBook ? '开卷' : '闭卷'}
          </span>
        )}
      </div>

      {/* 右区：计时 + 交卷 */}
      <div className="flex items-center gap-4">
        <span className={`font-mono text-2xl font-bold tabular-nums ${timeLeft < 60 ? 'text-red-400 animate-pulse' : timeLeft < 300 ? 'text-amber-400' : 'text-white'}`}>
          {formatTime(timeLeft)}
        </span>
        <button onClick={onShowSubmitModal}
          className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg border-none cursor-pointer transition-colors">
          交卷
        </button>
      </div>
    </div>
  );
}
