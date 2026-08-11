'use client';

// 关联知识点选择器：已选标签 + 搜索 + 复选列表
export default function KpSelector({ kpTree, kpLoading, kpSearch, setKpSearch, selectedKPIds, setSelectedKPIds }: {
  kpTree: any[];
  kpLoading: boolean;
  kpSearch: string;
  setKpSearch: (v: string) => void;
  selectedKPIds: number[];
  setSelectedKPIds: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  return (
    <div className="border-[var(--ink-100)] border-t pt-3 mt-4">
      <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">
        关联知识点 <span className="text-[var(--ink-300)]">（可选）</span>
      </label>
      {kpLoading ? (
        <p className="text-[var(--ink-300)] text-xs py-2">加载中…</p>
      ) : kpTree.length === 0 ? (
        <p className="text-[var(--ink-300)] text-xs py-2">
          暂无知识点，请先在「知识点管理」中添加
        </p>
      ) : (
        <div>
          {/* Selected tags */}
          {selectedKPIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedKPIds.map(id => {
                const kp = kpTree.find(k => k.id === id);
                return kp ? (
                  <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--fox-glow)] text-[var(--fox-dark)]"
                    >
                    {kp.name}
                    <button onClick={() => setSelectedKPIds(prev => prev.filter(x => x !== id))}
                      className="bg-transparent border-none cursor-pointer text-xs leading-none text-[var(--fox)]"
                      >✕</button>
                  </span>
                ) : null;
              })}
            </div>
          )}
          {/* Search */}
          <input value={kpSearch} onChange={e => setKpSearch(e.target.value)}
            className="input text-xs mb-1.5" placeholder="搜索知识点…"
            style={{ padding: '4px 8px', width: '100%' }} />
          {/* Checkbox list */}
          <div className="max-h-[120px] overflow-y-auto space-y-0.5">
            {kpTree
              .filter(kp => !kpSearch || kp.name.toLowerCase().includes(kpSearch.toLowerCase()) || (kp.code && kp.code.toLowerCase().includes(kpSearch.toLowerCase())))
              .map(kp => (
                <label key={kp.id} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5 px-1 rounded"
                  style={{ color: selectedKPIds.includes(kp.id) ? 'var(--fox-dark)' : 'var(--ink-500)' }}>
                  <input type="checkbox" checked={selectedKPIds.includes(kp.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedKPIds(prev => [...prev, kp.id]);
                      else setSelectedKPIds(prev => prev.filter(x => x !== kp.id));
                    }}
                    style={{ accentColor: 'var(--fox)' }} />
                  <span className="truncate flex-1">{kp.name}</span>
                  {kp.code && <span className="text-[var(--ink-300)] text-[10px]">{kp.code}</span>}
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
