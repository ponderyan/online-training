export function ScoreChangesModal({ changes, loading, onClose }: {
  changes: any[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.45)]" 
      onClick={onClose}>
      <div className="rounded-2xl p-6 max-w-md w-[90%] max-h-[80vh] overflow-y-auto" style={{ background: 'var(--paper-bright, #fff)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--ink-700)] text-base font-bold m-0">📊 成绩变动记录</h3>
          <button onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-lg text-[var(--ink-300)]" >✕</button>
        </div>

        {loading ? (
          <p className="text-[var(--ink-300)] text-sm text-center py-8">加载中…</p>
        ) : changes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-[var(--ink-400)] text-sm">暂无成绩变动记录</p>
            <p className="text-[var(--ink-300)] text-xs mt-1">成绩未被调整过</p>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((c, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--paper-dark, #f5f0eb)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[var(--fox)] text-sm font-mono font-bold">
                    {c.fromScore ?? '?'} → {c.toScore ?? '?'}
                  </span>
                  <span className="text-[var(--ink-300)] text-[10px]">
                    {new Date(c.timestamp).toLocaleString('zh-CN')}
                  </span>
                </div>
                {c.reason && (
                  <p className="text-[var(--ink-500)] text-xs mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded mr-1 bg-[var(--fox-glow)] text-[var(--fox)]" >{c.action}</span>
                    {c.reason}
                  </p>
                )}
              </div>
            ))}
            <p className="text-[var(--ink-300)] text-[10px] text-center pt-2">
              ※ 仅展示分数变化与原因，不显示操作人信息
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
