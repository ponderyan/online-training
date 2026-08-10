// 角色新建/编辑弹窗（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import { PRESET_COLORS } from './perm-tree';

export function RoleModal({ roles, editRoleData, roleForm, setRoleForm, onClose, onSave }: {
  roles: any[];
  editRoleData: any | null;
  roleForm: { name: string; code: string; description: string; color: string; copyFromRoleId: number };
  setRoleForm: (f: any) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[460px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">{editRoleData ? '编辑角色' : '新建角色'}</h3>
          <button onClick={onClose}
            className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">角色名称 *</label>
              <input value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} className="input" placeholder="如：巡考官" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">角色标识 *</label>
              <input value={roleForm.code} onChange={e => setRoleForm({...roleForm, code: e.target.value.toUpperCase()})} className="input"
                placeholder="如：PATROL" disabled={!!editRoleData} />
            </div>
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">描述</label>
            <textarea value={roleForm.description} onChange={e => setRoleForm({...roleForm, description: e.target.value})} className="input textarea" rows={2} />
          </div>
          <div>
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">颜色</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setRoleForm({...roleForm, color: c})}
                  className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer"
                  style={{ background: c, borderColor: roleForm.color === c ? 'var(--neutral-700)' : 'transparent' }} />
              ))}
            </div>
          </div>
          {!editRoleData && (
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">复制权限自（可选）</label>
              <select value={roleForm.copyFromRoleId} onChange={e => setRoleForm({...roleForm, copyFromRoleId: parseInt(e.target.value)})}
                className="input select">
                <option value={0}>不复制</option>
                {roles.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                ))}
              </select>
              {roleForm.copyFromRoleId > 0 && (
                <p className="text-[var(--fox)] text-[10px] mt-1">新建的角色将获得与所选角色相同的权限</p>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={onSave} className="btn btn-fox btn-sm">保存</button>
        </div>
      </div>
    </div>
  );
}
