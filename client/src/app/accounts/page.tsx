'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { validatePhone, validateEmail, validateIdCard } from '@/lib/validators';
import { useDebounce } from '@/hooks/use-debounce';
import UserSidePanel from './components/user-side-panel';
import UserFormModal from './components/user-form-modal';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员',
  LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'var(--error)', ORG_ADMIN: 'var(--fox)',
  LECTURER: 'var(--blue)', PROCTOR: 'var(--warning)', STUDENT: 'var(--sage)',
};

function relativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}

export default function AccountsPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword);
  const [filterRole, setFilterRole] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['STUDENT']);
  const [form, setForm] = useState({
    username: '', displayName: '', password: '123456',
    phone: '', email: '', organization: '', title: '',
    studentNumber: '', gender: '', batchId: '',
    idCard: '', education: '', educationSchool: '', major: '', graduationDate: '',
    professionalTitle: '', professionalLevel: '',
  });
  const [saving, setSaving] = useState(false);

  // Side panel
  const [sideUser, setSideUser] = useState<any>(null);
  const [sideTab, setSideTab] = useState<'exams' | 'certs' | 'fees'>('exams');
  const [sideData, setSideData] = useState<any>(null);
  const [sideLoading, setSideLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '50', allRoles: 'true' };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      const data = await api.students.list(params);
      const mapped = (data.items || []).map((u: any) => ({
        ...u,
        roles: u.roleAssignments?.map((ra: any) => ra.role.code) || [u.role || 'STUDENT'],
      }));
      setUsers(mapped);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.permissions.getRoles().then(setAllRoles).catch(() => {});
  }, []);

  const filtered = filterRole ? users.filter(u => (u.roles || [u.role]).includes(filterRole)) : users;

  // Stats
  const stats = {
    total: total,
    admins: users.filter(u => (u.roles || []).some((r: string) => r !== 'STUDENT')).length,
    students: users.filter(u => (u.roles || []).includes('STUDENT')).length,
    active: users.filter(u => u.isActive).length,
  };

  const openSide = async (u: any) => {
    setSideUser(u);
    setSideTab('exams');
    setSideLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [exams, certs, fees] = await Promise.all([
        fetch(`/api/students/${u.id}/exam-history`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`/api/students/${u.id}/certificates`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`/api/students/${u.id}/fee-records`, { headers }).then(r => r.json()).catch(() => []),
      ]);
      setSideData({ exams: Array.isArray(exams) ? exams : [], certs: Array.isArray(certs) ? certs : [], fees: Array.isArray(fees) ? fees : [] });
    } catch {}
    setSideLoading(false);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    const r = u.roles || [u.role || 'STUDENT'];
    setSelectedRoles(r);
    setForm({
      username: u.username, displayName: u.displayName, password: '',
      phone: u.phone || '', email: u.email || '', organization: u.organization || '',
      title: u.title || '', studentNumber: u.studentNumber || '',
      gender: u.gender || '', batchId: u.batchId ? String(u.batchId) : '',
      idCard: u.idCard || '', education: u.education || '', educationSchool: u.educationSchool || '',
      major: u.major || '', graduationDate: u.graduationDate || '',
      professionalTitle: u.professionalTitle || '', professionalLevel: u.professionalLevel || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.username || !form.displayName) { toast.warning('用户名和姓名不能为空'); return; }
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { toast.warning(phoneErr); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr) { toast.warning(emailErr); return; }
    const idErr = validateIdCard(form.idCard);
    if (idErr) { toast.warning(idErr); return; }
    setSaving(true);
    try {
      const payload: any = {
        displayName: form.displayName,
        phone: form.phone, email: form.email,
        organization: form.organization, title: form.title,
        studentNumber: form.studentNumber, gender: form.gender,
        batchId: form.batchId ? Number(form.batchId) : undefined,
        roles: selectedRoles,
        idCard: form.idCard || undefined,
        education: form.education || undefined,
        educationSchool: form.educationSchool || undefined,
        major: form.major || undefined,
        graduationDate: form.graduationDate || undefined,
        professionalTitle: form.professionalTitle || undefined,
        professionalLevel: form.professionalLevel || undefined,
      };
      if (form.password && (form.password !== '123456' || !editUser)) payload.password = form.password;
      if (editUser) {
        await api.students.update(editUser.id, payload);
      } else {
        payload.username = form.username;
        await api.students.create(payload);
      }
      setShowModal(false); setEditUser(null); load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleResetPwd = async (id: number) => {
    if (!confirm('确认重置此用户的密码？')) return;
    try {
      const data = await api.students.resetPassword(id);
      toast.success(`密码已重置为：${data.password}\n请记录并告知用户。`);
    } catch (e: any) { toast.error('重置失败：' + e.message); }
  };

  const handleToggleActive = async (u: any) => {
    try { await api.students.update(u.id, { isActive: !u.isActive }); load(); } catch {}
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="page-title">账户管理</h1>
          <p className="page-subtitle">共 {total} 个用户</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditUser(null); setForm({ username: '', displayName: '', password: '123456', phone: '', email: '', organization: '', title: '', studentNumber: '', gender: '', batchId: '', idCard: '', education: '', educationSchool: '', major: '', graduationDate: '', professionalTitle: '', professionalLevel: '' }); setSelectedRoles(['STUDENT']); }}
          className="btn btn-fox btn-sm">➕ 创建用户</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { value: stats.total, label: '总用户', icon: '👥', color: 'var(--fox)' },
          { value: stats.active, label: '活跃用户', icon: '🟢', color: 'var(--sage)' },
          { value: stats.students, label: '学员', icon: '🎓', color: 'var(--blue)' },
          { value: stats.admins, label: '管理员/讲师', icon: '⚙️', color: 'var(--purple)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[var(--ink-400)] text-[10px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="搜索用户名/姓名/手机号…" className="input" style={{ maxWidth: 320 }}
          onKeyDown={e => e.key === 'Enter' && load()} />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input select" style={{ maxWidth: 150 }}>
          <option value="">全部角色</option>
          {Object.entries(ROLE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载… 🦊</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="list-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>姓名</th>
                <th>手机号</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>最后登录</th>
                <th>状态</th>
                <th>注册时间</th>
                <th style={{ width: 200 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id} onDoubleClick={() => openSide(u)} className="cursor-pointer hover:bg-[var(--fox-glow)]" style={{ cursor: 'pointer' }}>
                  <td className="text-[var(--ink-400)]">{u.username}</td>
                  <td className="font-medium">{u.displayName}</td>
                  <td className="text-[var(--ink-400)] text-xs">{u.phone || '—'}</td>
                  <td className="text-[var(--ink-400)] text-xs">{u.email || '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || [u.role || 'STUDENT']).map((r: string) => (
                        <span key={r} className="tag" style={{
                          background: `color-mix(in srgb, ${ROLE_COLORS[r] || 'var(--neutral-400)'} 10%, transparent)`, color: ROLE_COLORS[r] || 'var(--neutral-400)',
                          border: `1px solid ${ROLE_COLORS[r] || 'var(--neutral-400)'}30`, fontSize: '10px',
                        }}>{ROLE_NAMES[r] || r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-[var(--ink-300)] text-xs" title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN') : ''}>
                    {u.lastLoginAt ? relativeTime(u.lastLoginAt) : '—'}
                  </td>
                  <td>
                    <span className={`tag ${u.isActive ? 'tag-cyan' : 'tag-ink'}`}>{u.isActive ? '正常' : '已停用'}</span>
                  </td>
                  <td className="text-[var(--ink-300)] text-xs">
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openSide(u)} className="btn btn-ghost btn-xs">查看</button>
                      <button onClick={() => openEdit(u)} className="btn btn-ghost btn-xs">编辑</button>
                      <button onClick={() => handleResetPwd(u.id)} className="btn btn-ghost btn-xs text-[var(--gold)]" >改密</button>
                      <button onClick={() => handleToggleActive(u)} className="btn btn-ghost btn-xs"
                        style={{ color: u.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
                        {u.isActive ? '停用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-[var(--ink-300)] text-center py-8 text-xs">暂无用户</td></tr>
              )}
            </tbody>
          </table>
          </div>
          {/* Pagination */}
          {total > 50 && (
            <div className="border-[var(--ink-100)] flex items-center justify-between px-5 py-3 border-t">
              <span className="text-[var(--ink-300)] text-xs">
                共 {total} 条，第 {page}/{Math.ceil(total / 50)} 页
              </span>
              <div className="flex gap-1">
                <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }}
                  disabled={page <= 1}
                  className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.4 : 1 }}>← 上一页</button>
                {Array.from({ length: Math.min(5, Math.ceil(total / 50)) }, (_, i) => {
                  const start = Math.max(1, page - 2);
                  const p = start + i;
                  if (p > Math.ceil(total / 50)) return null;
                  return (
                    <button key={p} onClick={() => { setPage(p); load(p); }}
                      className={`btn btn-xs ${p === page ? 'btn-fox' : 'btn-ghost'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => { const p = Math.min(Math.ceil(total / 50), page + 1); setPage(p); load(p); }}
                  disabled={page >= Math.ceil(total / 50)}
                  className="btn btn-ghost btn-xs" style={{ opacity: page >= Math.ceil(total / 50) ? 0.4 : 1 }}>下一页 →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 用户详情侧栏（拆分组件） */}
      {sideUser && (
        <UserSidePanel user={sideUser} data={sideData} loading={sideLoading} tab={sideTab}
          onTabChange={setSideTab} onClose={() => setSideUser(null)}
          onEdit={() => { setSideUser(null); openEdit(sideUser); }}
          onResetPwd={() => handleResetPwd(sideUser.id)}
          onToggleActive={() => handleToggleActive(sideUser)} />
      )}

      {/* 用户创建/编辑弹窗（拆分组件） */}
      {showModal && (
        <UserFormModal editUser={editUser} form={form} onFormChange={setForm}
          allRoles={allRoles} selectedRoles={selectedRoles} onRolesChange={setSelectedRoles}
          saving={saving} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditUser(null); }} />
      )}
    </AppLayout>
  );
}
