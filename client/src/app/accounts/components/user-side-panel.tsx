'use client';

/**
 * 账户管理 · 用户详情侧栏（自 accounts/page.tsx 拆分，2026-08-11）
 * 基本信息/教育职称/账号信息 + 考试/证书/缴费三 Tab + 快捷操作
 */

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员',
  LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员',
};

interface Props {
  user: any;
  data: { exams: any[]; certs: any[]; fees: any[] } | null;
  loading: boolean;
  tab: 'exams' | 'certs' | 'fees';
  onTabChange: (t: 'exams' | 'certs' | 'fees') => void;
  onClose: () => void;
  onEdit: () => void;
  onResetPwd: () => void;
  onToggleActive: () => void;
}

export default function UserSidePanel({ user, data, loading, tab, onTabChange, onClose, onEdit, onResetPwd, onToggleActive }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-[var(--paper-bright)] w-[660px] max-h-[80vh] overflow-y-auto rounded-xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg bg-[var(--fox-pale)] text-[var(--fox)]">
              {user.displayName?.[0] || '🦊'}
            </div>
            <div>
              <div className="text-[var(--ink-700)] font-bold text-sm">{user.displayName}</div>
              <div className="text-[var(--ink-400)] text-xs">@{user.username}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]">✕</button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[var(--paper)] p-4 rounded-lg">
            <div className="text-[var(--ink-400)] text-[10px] font-medium mb-2">基本信息</div>
            <div className="text-xs space-y-1.5">
              <div><span className="text-[var(--ink-300)]">姓名：</span>{user.displayName}</div>
              <div><span className="text-[var(--ink-300)]">性别：</span>{user.gender === 'M' ? '男' : user.gender === 'F' ? '女' : '—'}</div>
              <div><span className="text-[var(--ink-300)]">身份证：</span>{user.idCard || '—'}</div>
              <div><span className="text-[var(--ink-300)]">手机：</span>{user.phone || '—'}</div>
              <div><span className="text-[var(--ink-300)]">邮箱：</span>{user.email || '—'}</div>
            </div>
          </div>
          <div className="bg-[var(--paper)] p-4 rounded-lg">
            <div className="text-[var(--ink-400)] text-[10px] font-medium mb-2">教育/职称信息</div>
            <div className="text-xs space-y-1.5">
              <div><span className="text-[var(--ink-300)]">学历：</span>{user.education || '—'}</div>
              <div><span className="text-[var(--ink-300)]">毕业院校：</span>{user.educationSchool || '—'}</div>
              <div><span className="text-[var(--ink-300)]">专业：</span>{user.major || '—'}</div>
              <div><span className="text-[var(--ink-300)]">毕业时间：</span>{user.graduationDate ? new Date(user.graduationDate).toLocaleDateString('zh-CN') : '—'}</div>
              <div><span className="text-[var(--ink-300)]">职称：</span>{user.professionalTitle || '—'} {user.professionalLevel ? `(${user.professionalLevel})` : ''}</div>
            </div>
          </div>
          <div className="bg-[var(--paper)] col-span-2 p-4 rounded-lg">
            <div className="text-[var(--ink-400)] text-[10px] font-medium mb-2">账号信息</div>
            <div className="text-xs space-y-1.5">
              <div><span className="text-[var(--ink-300)]">角色：</span>{(user.roles || [user.role || 'STUDENT']).map((r: string) => ROLE_NAMES[r] || r).join('、')}</div>
              <div><span className="text-[var(--ink-300)]">单位/职务：</span>{[user.organization, user.title].filter(Boolean).join(' · ') || '—'}</div>
              <div><span className="text-[var(--ink-300)]">注册：</span>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</div>
              <div><span className="text-[var(--ink-300)]">登录：</span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未'}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-[var(--ink-100)] flex gap-0 mb-4 border-b">
          {[
            { key: 'exams', label: '📚 考试', count: data?.exams?.length || 0 },
            { key: 'certs', label: '🏅 证书', count: data?.certs?.length || 0 },
            { key: 'fees', label: '💰 缴费', count: data?.fees?.length || 0 },
          ].map(t => (
            <button key={t.key} onClick={() => onTabChange(t.key as any)}
              className="px-4 py-2 text-xs font-medium border-none bg-transparent cursor-pointer transition-all"
              style={{ color: tab === t.key ? 'var(--fox)' : 'var(--ink-400)', borderBottom: tab === t.key ? '2px solid var(--fox)' : '2px solid transparent' }}>
              {t.label} {t.count > 0 && `(${t.count})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="text-[var(--ink-300)] text-center py-8">加载中…</div>
        ) : tab === 'exams' ? (
          <div className="space-y-2">
            {(data?.exams || []).length === 0 ? (
              <p className="text-[var(--ink-300)] text-xs text-center py-8">暂无考试记录</p>
            ) : (
              data!.exams.map((e: any) => (
                <div key={e.id} className="bg-[var(--paper)] p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ink-600)] text-xs font-medium">{e.exam?.title || '—'}</span>
                    {e.isPassed === true && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--sage-glow)] text-[var(--sage)]">✅ {e.finalScore}分</span>}
                    {e.isPassed === false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--verm-glow)] text-[var(--error)]">❌ {e.finalScore}分</span>}
                    {e.isPassed === null && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold-glow)] text-[var(--warning)]">⏳ 待阅卷</span>}
                  </div>
                  <div className="text-[var(--ink-300)] text-[10px] mt-1">{e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : ''}</div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'certs' ? (
          <div className="space-y-2">
            {(data?.certs || []).length === 0 ? (
              <p className="text-[var(--ink-300)] text-xs text-center py-8">暂无证书</p>
            ) : (
              data!.certs.map((c: any) => (
                <div key={c.id} className="bg-[var(--paper)] p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[var(--ink-600)] text-xs font-medium">{c.courseName}</div>
                      <div className="text-[var(--ink-300)] text-[10px]">{c.certificateNo}</div>
                    </div>
                    {c.isRevoked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--verm-glow)] text-[var(--error)]">已撤销</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--sage-glow)] text-[var(--sage)]">有效</span>
                    )}
                  </div>
                  <div className="text-[var(--ink-300)] text-[10px] mt-1">发证：{c.issueDate ? new Date(c.issueDate).toLocaleDateString('zh-CN') : '—'}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.fees || []).length === 0 ? (
              <p className="text-[var(--ink-300)] text-xs text-center py-8">暂无缴费记录</p>
            ) : (
              data!.fees.map((f: any) => (
                <div key={f.id} className="bg-[var(--paper)] p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ink-600)] text-xs font-medium">{f.type === 'TRAINING_FEE' ? '培训费' : f.type === 'EXAM_FEE' ? '考试费' : f.type === 'CERTIFICATE_FEE' ? '证书费' : f.type}</span>
                    <span className="text-[var(--fox)] text-xs font-bold">¥{f.amount}</span>
                  </div>
                  <div className="text-[var(--ink-300)] text-[10px] mt-1">
                    {f.status === 'PAID' ? '✅ 已缴费' : f.status === 'UNPAID' ? '⏳ 未缴费' : '❌ ' + f.status} · {f.createdAt ? new Date(f.createdAt).toLocaleDateString('zh-CN') : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Actions */}
        <div className="border-[var(--ink-100)] flex gap-2 mt-5 pt-4 border-t">
          <button onClick={onEdit} className="btn btn-fox btn-xs">✏️ 编辑资料</button>
          <button onClick={onResetPwd} className="btn btn-outline btn-xs text-[var(--gold)] border-[var(--gold)]">🔑 重置密码</button>
          <button onClick={onToggleActive} className="btn btn-outline btn-xs"
            style={{ color: user.isActive ? 'var(--verm)' : 'var(--cyan)', borderColor: user.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
            {user.isActive ? '停用' : '启用'}
          </button>
        </div>
      </div>
    </div>
  );
}
