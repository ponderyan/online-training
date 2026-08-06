'use client';

import { OrgNode } from '../lib';

// ── 新建/编辑组织 Modal ──
export function OrgFormModal({ open, editOrg, modalParent, orgForm, saving, onClose, onFormChange, onSave }: {
  open: boolean;
  editOrg: OrgNode | null;
  modalParent: OrgNode | null;
  orgForm: { name: string; code: string; contactName: string; contactPhone: string; contactEmail: string; orgType: string };
  saving: boolean;
  onClose: () => void;
  onFormChange: (form: any) => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[460px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">
            {editOrg ? '编辑组织' : '新建组织'}
            {modalParent && <span className="text-[var(--ink-400)] text-xs font-normal ml-2">（父级：{modalParent.name}）</span>}
          </h3>
          <button onClick={onClose} className="text-[var(--ink-300)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">组织名称 *</label>
              <input value={orgForm.name} onChange={e => onFormChange({ ...orgForm, name: e.target.value })} className="input" placeholder="如：符合性评估部" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">组织编码 *</label>
              <input value={orgForm.code} onChange={e => onFormChange({ ...orgForm, code: e.target.value.toUpperCase() })} className="input" placeholder="大写字母+数字+连字符" disabled={!!editOrg} maxLength={20} />
              {!editOrg && <p className="text-[var(--ink-300)] text-[10px] mt-0.5">自动生成，可手动覆盖</p>}
            </div>
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">组织类型</label>
            <select value={orgForm.orgType} onChange={e => onFormChange({ ...orgForm, orgType: e.target.value })} className="input select">
              <option value="ASSOCIATION">协会（总会）</option>
              <option value="BRANCH">分会</option>
              <option value="DEPARTMENT">部门 / 业务线</option>
            </select>
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">联系人</label>
            <input value={orgForm.contactName} onChange={e => onFormChange({ ...orgForm, contactName: e.target.value })} className="input" placeholder="联系人姓名" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">联系电话</label>
              <input value={orgForm.contactPhone} onChange={e => onFormChange({ ...orgForm, contactPhone: e.target.value.replace(/[^\d+\-\s]/g, '') })} className="input" placeholder="如 13800138000" maxLength={20} />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">联系邮箱</label>
              <input value={orgForm.contactEmail} onChange={e => onFormChange({ ...orgForm, contactEmail: e.target.value.replace(/[^a-zA-Z0-9._%+@\-]/g, '') })} className="input" placeholder="邮箱" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={onSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

// ── 批量导入 Modal ──
export function ImportModal({ open, importRows, importing, importResult, onClose, onDownloadTemplate, onFileSelect, onImport }: {
  open: boolean;
  importRows: { name: string; parentName?: string; sortOrder?: number }[];
  importing: boolean;
  importResult: { imported: number; skipped: number; errors: string[] } | null;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onFileSelect: (file: File) => void;
  onImport: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[560px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📥 批量导入组织</h3>
          <button onClick={onClose} className="text-[var(--ink-300)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="modal-body space-y-4">
          <button onClick={onDownloadTemplate} className="btn btn-outline btn-sm">📥 下载导入模板</button>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">选择文件（支持 .xlsx / .xls，最大 2MB）</label>
            <input type="file" accept=".xlsx,.xls" className="input" style={{ padding: 6 }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
          </div>
          <div className="text-xs space-y-1 p-3 rounded-lg" style={{ background: 'var(--paper)', color: 'var(--ink-400)' }}>
            <div className="text-[var(--ink-500)] font-medium">导入说明：</div>
            <div>· 第一列：组织名称（必填）</div>
            <div>· 第二列：上级组织名称（可选，留空=根组织）</div>
            <div>· 第三列：排序号（可选）</div>
          </div>
          {importRows.length > 0 && (
            <div>
              <div className="text-[var(--ink-500)] text-xs font-medium mb-2">预览（前 5 行，共 {importRows.length} 行）</div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ink-100)' }}>
                <div className="overflow-x-auto">
                <table className="list-table">
                  <thead><tr><th>组织名称</th><th>上级组织</th><th>排序</th></tr></thead>
                  <tbody>
                    {importRows.slice(0, 5).map((r, i) => (
                      <tr key={i}><td>{r.name}</td><td className="text-xs">{r.parentName || '—'}</td><td>{r.sortOrder ?? '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
          {importResult && (
            <div className="p-3 rounded-lg" style={{ background: importResult.imported > 0 ? 'var(--sage-glow)' : 'var(--verm-glow)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: importResult.imported > 0 ? 'var(--sage)' : 'var(--verm)' }}>
                导入 {importResult.imported} 个，跳过 {importResult.skipped} 个
              </div>
              {importResult.errors.length > 0 && (
                <div className="text-[var(--ink-500)] text-xs space-y-0.5">
                  {importResult.errors.map((err, i) => <div key={i}>· {err}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={onImport} disabled={importing || importRows.length === 0} className="btn btn-fox btn-sm">
            {importing ? '导入中…' : `导入 ${importRows.length} 行`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 迁移学员 Modal ──
function MigrateOrgPicker({ node, depth, selectedId, onSelect, excludeId }: {
  node: OrgNode; depth: number; selectedId: number | null; onSelect: (id: number) => void; excludeId: number;
}) {
  if (node.id === excludeId) return null;
  const isSelected = selectedId === node.id;
  return (
    <div>
      <div onClick={() => onSelect(node.id)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors"
        style={{ marginLeft: depth * 16, background: isSelected ? 'var(--fox-pale)' : 'transparent' }}>
        <span className="text-xs" style={{ color: isSelected ? 'var(--fox-dark)' : 'var(--ink-600)' }}>{node.name}</span>
        {isSelected && <span className="text-[var(--fox)] text-[10px]">✓</span>}
      </div>
      {node.children.map(child => (
        <MigrateOrgPicker key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} excludeId={excludeId} />
      ))}
    </div>
  );
}

export function MigrateModal({ open, source, tree, targetId, options, migrating, totalUsers, onClose, onTargetChange, onOptionsChange, onMigrate }: {
  open: boolean;
  source: OrgNode | null;
  tree: OrgNode[];
  targetId: number | null;
  options: { moveHours: boolean; moveExams: boolean };
  migrating: boolean;
  totalUsers: number | null;
  onClose: () => void;
  onTargetChange: (id: number) => void;
  onOptionsChange: (opts: { moveHours: boolean; moveExams: boolean }) => void;
  onMigrate: () => void;
}) {
  if (!open || !source) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[520px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">🔄 迁移学员</h3>
          <button onClick={onClose} className="text-[var(--ink-300)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="bg-[var(--paper)] p-3 rounded-lg">
            <div className="text-[var(--ink-400)] text-xs">从</div>
            <div className="text-[var(--ink-700)] text-sm font-medium">{source.name}</div>
            <div className="text-[var(--ink-300)] text-xs mt-1">当前学员数：{totalUsers ?? '加载中…'} 人（含下属组织）</div>
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">迁移到</label>
            <div className="rounded-lg p-2 max-h-[240px] overflow-y-auto" style={{ border: '1px solid var(--ink-100)', background: 'var(--paper-bright)' }}>
              {tree.map(node => (
                <MigrateOrgPicker key={node.id} node={node} depth={0} selectedId={targetId} onSelect={onTargetChange} excludeId={source.id} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[var(--ink-500)] text-xs font-medium">迁移选项</div>
            <label className="text-[var(--ink-600)] flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={options.moveHours} onChange={e => onOptionsChange({ ...options, moveHours: e.target.checked })} className="accent-[var(--fox)]" />
              ☑ 学时记录随学员迁移
            </label>
            <label className="text-[var(--ink-600)] flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={options.moveExams} onChange={e => onOptionsChange({ ...options, moveExams: e.target.checked })} className="accent-[var(--fox)]" />
              考试记录随学员迁移
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={onMigrate} disabled={migrating || !targetId} className="btn btn-fox btn-sm">
            {migrating ? '迁移中…' : '确认迁移'}
          </button>
        </div>
      </div>
    </div>
  );
}
