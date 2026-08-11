'use client';

/**
 * 账户管理 · 用户创建/编辑弹窗（自 accounts/page.tsx 拆分，2026-08-11）
 */

export interface UserFormState {
  username: string; displayName: string; password: string;
  phone: string; email: string; organization: string; title: string;
  studentNumber: string; gender: string; batchId: string;
  idCard: string; education: string; educationSchool: string; major: string; graduationDate: string;
  professionalTitle: string; professionalLevel: string;
}

interface Props {
  editUser: any;
  form: UserFormState;
  onFormChange: (f: UserFormState) => void;
  allRoles: any[];
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function UserFormModal({ editUser, form, onFormChange, allRoles, selectedRoles, onRolesChange, saving, onSave, onClose }: Props) {
  const set = (patch: Partial<UserFormState>) => onFormChange({ ...form, ...patch });

  const renderRoleGroup = (roles: any[], title?: string) => roles.length === 0 ? null : (
    <div>
      {title && <div className="text-[var(--ink-300)] text-[10px] font-medium mb-1">{title}</div>}
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r: any) => (
          <label key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-all"
            style={{
              background: selectedRoles.includes(r.code) ? `color-mix(in srgb, ${r.color || 'var(--fox)'} 10%, transparent)` : 'var(--paper)',
              border: '1px solid ' + (selectedRoles.includes(r.code) ? (r.color || 'var(--fox)') : 'var(--ink-100)'),
            }}>
            <input type="checkbox" checked={selectedRoles.includes(r.code)}
              onChange={e => onRolesChange(e.target.checked ? [...selectedRoles, r.code] : selectedRoles.filter(c => c !== r.code))}
              className="cursor-pointer accent-[var(--fox)]" />
            {r.color && <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.color }} />}
            {r.name}
          </label>
        ))}
      </div>
    </div>
  );

  const sysRoles = allRoles.filter((r: any) => r.isSystem);
  const customRoles = allRoles.filter((r: any) => !r.isSystem);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[560px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">{editUser ? '编辑用户' : '创建用户'}</h3>
          <button onClick={onClose} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]">✕</button>
        </div>
        <div className="modal-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">用户名 *</label>
              <input value={form.username} onChange={e => set({ username: e.target.value })} className="input" disabled={!!editUser} />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">姓名 *</label>
              <input value={form.displayName} onChange={e => set({ displayName: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">手机号</label>
              <input value={form.phone} onChange={e => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} className="input" placeholder="11位手机号" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">邮箱</label>
              <input value={form.email} onChange={e => set({ email: e.target.value.replace(/[^a-zA-Z0-9._%+@\-]/g, '') })} className="input" placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">单位</label>
              <input value={form.organization} onChange={e => set({ organization: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">职务</label>
              <input value={form.title} onChange={e => set({ title: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">学号</label>
              <input value={form.studentNumber} onChange={e => set({ studentNumber: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">性别</label>
              <select value={form.gender} onChange={e => set({ gender: e.target.value })} className="input select">
                <option value="">—</option>
                <option value="M">男</option>
                <option value="F">女</option>
              </select>
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">身份证号</label>
              <input value={form.idCard} onChange={e => set({ idCard: e.target.value })} className="input" placeholder="18位" maxLength={18} disabled={!!editUser} />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">学历</label>
              <select value={form.education} onChange={e => set({ education: e.target.value })} className="input select">
                <option value="">—</option>
                <option value="本科">本科</option><option value="硕士">硕士</option>
                <option value="博士">博士</option><option value="其他">其他</option>
              </select>
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">毕业院校</label>
              <input value={form.educationSchool} onChange={e => set({ educationSchool: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">专业</label>
              <input value={form.major} onChange={e => set({ major: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">毕业时间</label>
              <input type="month" value={form.graduationDate} onChange={e => set({ graduationDate: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">职称</label>
              <input value={form.professionalTitle} onChange={e => set({ professionalTitle: e.target.value })} className="input" placeholder="如：高级工程师" />
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">职称等级</label>
              <select value={form.professionalLevel} onChange={e => set({ professionalLevel: e.target.value })} className="input select">
                <option value="">—</option>
                <option value="正高级">正高级</option><option value="副高级">副高级</option>
                <option value="中级">中级</option><option value="初级">初级</option>
              </select>
            </div>
          </div>

          {/* Roles */}
          <div className="mt-4">
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">角色（可多选）</label>
            <div className="space-y-2">
              {renderRoleGroup(sysRoles, '系统角色')}
              {renderRoleGroup(customRoles, `自定义角色（${customRoles.length}个）`)}
            </div>
          </div>

          {/* Password */}
          <div className="mt-4">
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">
              密码 {editUser ? '（留空不修改）' : '*'}
            </label>
            <input value={form.password} onChange={e => set({ password: e.target.value })}
              className="input" type="password" placeholder={editUser ? '留空则不修改密码' : '默认密码'} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={onSave} disabled={saving} className="btn btn-fox btn-sm">
            {saving ? '保存中…' : '💾 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
