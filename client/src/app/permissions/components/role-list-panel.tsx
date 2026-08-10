// 左侧角色列表面板（自 page.tsx 迁出，纯重构零行为变化）
'use client';

export function RoleListPanel({ matrix, roles, selectedRoleId, onSelect, onNew, onEdit, onDelete }: {
  matrix: any[];
  roles: any[];
  selectedRoleId: number | null;
  onSelect: (roleId: number) => void;
  onNew: () => void;
  onEdit: (role: any) => void;
  onDelete: (roleId: number) => void;
}) {
  return (
    <div className="w-56 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[var(--ink-700)] font-bold text-sm">🔐 角色</h2>
        <button onClick={onNew} className="btn btn-fox btn-xs">+ 新建</button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-2">
        {matrix.map((row: any) => {
          const role = roles.find((r: any) => r.id === row.roleId);
          const isSelected = row.roleId === selectedRoleId;
          const grantedCount = row.permissions?.filter((p: any) => p.granted).length || 0;
          const color = row.color || 'var(--neutral-400)';
          return (
            <div key={row.roleId}
              className="px-3 py-2.5 rounded-lg transition-all cursor-pointer"
              style={{ background: isSelected ? `${color}15` : 'transparent', border: `1px solid ${isSelected ? color : 'transparent'}` }}
              onClick={() => onSelect(row.roleId)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-sm font-medium truncate" style={{ color: isSelected ? color : 'var(--ink-600)' }}>
                    {row.roleName || row.role}
                  </span>
                </div>
                {!role?.isSystem && (
                  <button onClick={e => { e.stopPropagation(); onDelete(row.roleId); }}
                    className="text-[10px] bg-transparent border-none cursor-pointer flex-shrink-0 hover:opacity-70 text-[var(--ink-300)]" >
                    🗑️
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[var(--ink-300)] text-[10px]">
                  {role?.userCount ?? 0} 人 · {grantedCount} 权限
                </span>
                <button onClick={e => { e.stopPropagation(); onEdit(role); }}
                  className="text-[10px] bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >
                  ✏️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
