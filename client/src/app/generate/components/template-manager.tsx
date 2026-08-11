'use client';

/**
 * 智能组卷 · 模板管理区块（自 generate/page.tsx 拆分，2026-08-11）
 */

interface Props {
  templates: any[];
  saving: boolean;
  onSave: () => void;
  onApply: (tpl: any) => void;
  onDelete: (id: number, name: string) => void;
}

export default function TemplateManager({ templates, saving, onSave, onApply, onDelete }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title mb-0">模板管理</h3>
        <button onClick={onSave} disabled={saving} className="btn btn-outline btn-xs">{saving ? '保存…' : '+ 保存当前'}</button>
      </div>
      {templates.length === 0 ? (
        <p className="text-[var(--ink-300)] text-xs">暂无模板</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded text-xs bg-[var(--paper)] text-[var(--ink-500)]">
              <span className="truncate flex-1">{t.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => onApply(t)} className="btn btn-ghost btn-xs text-[var(--gold)]">应用</button>
                <button onClick={() => onDelete(t.id, t.name)} className="btn btn-ghost btn-xs text-[var(--ink-300)]"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[var(--ink-300)] text-xs mt-3">模板不含试卷名称，应用后可按需调整。</p>
    </div>
  );
}
