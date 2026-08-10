// 添加成员弹窗（自 page.tsx 迁出，纯重构零行为变化）
'use client';

export function AddMemberModal({ roleName, query, results, loading, savingId, onSearch, onAdd, onClose }: {
  roleName: string;
  query: string;
  results: any[];
  loading: boolean;
  savingId: number | null;
  onSearch: (q: string) => void;
  onAdd: (userId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[480px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">➕ 添加成员到「{roleName}」</h3>
          <button onClick={onClose}
            className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
        </div>
        <div className="modal-body space-y-3">
          <input value={query} onChange={e => onSearch(e.target.value)}
            autoFocus placeholder="🔍 输入用户名或姓名搜索…" className="input" />
          {loading && (
            <div className="text-[var(--ink-300)] text-center py-4 text-xs">搜索中…</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="text-[var(--ink-300)] text-center py-4 text-xs">未找到匹配用户</div>
          )}
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {results.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--paper)]"
                style={{  border: '1px solid var(--ink-100)' }}>
                <div className="min-w-0">
                  <div className="text-[var(--ink-700)] text-sm font-medium truncate">
                    {u.displayName} <span className="text-[var(--ink-300)] text-xs font-normal">({u.username})</span>
                  </div>
                  <div className="text-[var(--ink-300)] text-[11px]">{u.orgName}</div>
                </div>
                {u.hasRole ? (
                  <span className="text-[11px] px-2 py-1 rounded text-[var(--sage)] bg-[var(--sage-glow)]" >✓ 已是该角色</span>
                ) : (
                  <button onClick={() => onAdd(u.id)} disabled={savingId === u.id}
                    className="btn btn-fox btn-xs">{savingId === u.id ? '添加中…' : '添加'}</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">完成</button>
        </div>
      </div>
    </div>
  );
}
