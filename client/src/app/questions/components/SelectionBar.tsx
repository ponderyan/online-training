import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Props {
  selectedIds: Set<number>;
  onGenerate: () => void;
  onClear: () => void;
  onDone: () => void;
}

export default function SelectionBar({ selectedIds, onGenerate, onClear, onDone }: Props) {
  const toast = useToast();

  if (selectedIds.size === 0) return null;

  const handleBatch = async (val: string) => {
    if (!val) return;
    const ids = Array.from(selectedIds);
    try {
      if (val === 'archive' || val === 'publish') {
        const status = val === 'archive' ? 'ARCHIVED' : 'PUBLISHED';
        await Promise.all(ids.map(id => api.questions.update(id, { status })));
        toast.success(`已${val === 'archive' ? '停用' : '启用'} ${ids.length} 道试题`);
      } else {
        await Promise.all(ids.map(id => api.questions.update(id, { difficulty: val })));
        toast.success(`已修改 ${ids.length} 道试题难度`);
      }
      onClear();
      onDone();
    } catch (err: any) { toast.error('批量操作失败：' + err.message); }
  };

  return (
    <div className="bg-[var(--fox-glow)] flex items-center justify-center gap-3 mt-4 p-3 rounded-lg animate-fadeSlide flex-wrap">
      <span className="text-[var(--fox-dark)] text-sm font-medium">
        已选 <strong>{selectedIds.size}</strong> 道试题
      </span>
      <button onClick={onGenerate} className="btn btn-fox btn-sm">选题组卷 →</button>
      <select
        onChange={(e) => { const val = e.target.value; e.target.value = ''; handleBatch(val); }}
        className="input select btn-sm" style={{ width: '130px', fontSize: '12px' }}>
        <option value="">批量操作…</option>
        <option value="archive">批量停用</option>
        <option value="publish">批量启用</option>
        <option value="EASY">难度→易</option>
        <option value="MEDIUM_EASY">难度→较易</option>
        <option value="MEDIUM_HARD">难度→较难</option>
        <option value="HARD">难度→难</option>
      </select>
      <button onClick={onClear} className="btn btn-ghost btn-xs">取消选择</button>
    </div>
  );
}
