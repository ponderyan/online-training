'use client';

interface Props {
  students: any[];
  isOffline: boolean;
  lastUpdated: string;
  examStatus: string;
  onRefresh: () => void;
}

export default function ExamStudentList({ students, isOffline, lastUpdated, examStatus, onRefresh }: Props) {
  const sessionStatusLabels: Record<string, string> = isOffline
    ? { ASSIGNED: '待录入', ACTIVE: '待录入', PAUSED: '待录入', SUBMITTED: '已录入' }
    : { ASSIGNED: '未开始', ACTIVE: '考试中', PAUSED: '已断线', SUBMITTED: '已提交' };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--paper-bright)', border: '1px solid var(--ink-100)' }}>
      <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
        <span>考生状态 · 共{students.length}人</span>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span>更新于 {lastUpdated}
              {examStatus !== 'FINISHED' && examStatus !== 'CANCELLED' && ' · 自动刷新中'}
            </span>
          )}
          <button onClick={onRefresh} className="px-2 py-1 rounded hover:bg-[var(--fox-glow)] transition-colors"
            style={{ border: '1px solid var(--ink-200)' }}>
            🔄 刷新
          </button>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
        {students.map(s => (
          <div key={s.id} className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                {s.student?.displayName?.[0] || '?'}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>{s.student?.displayName || '未知'}</p>
                <p className="text-xs" style={{ color: 'var(--ink-300)' }}>{s.student?.organization || ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {s.totalScore !== null && <span className="text-xs font-medium" style={{ color: 'var(--sage)' }}>{s.totalScore}分</span>}
              <span className="text-xs px-2.5 py-1 rounded-full" style={{
                background: s.absent ? 'var(--warning-pale)' : s.status === 'SUBMITTED' ? 'var(--success-pale)' : s.status === 'ACTIVE' ? 'var(--fox-pale)' : 'var(--neutral-50)',
                color: s.absent ? 'var(--warning)' : s.status === 'SUBMITTED' ? 'var(--sage)' : s.status === 'ACTIVE' ? 'var(--fox-dark)' : 'var(--ink-400)',
              }}>
                {s.absent ? '缺考' : (sessionStatusLabels[s.status] || s.status)}
              </span>
              {s.suspicionLevel > 0 && <span className="text-xs">⚠️ 异常{s.suspicionLevel}</span>}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无考生</div>
        )}
      </div>
    </div>
  );
}
