'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员',
  LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#ef4444', ORG_ADMIN: '#e87a30',
  LECTURER: '#1565c0', PROCTOR: '#f59e0b', STUDENT: '#2e7d32',
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
      if (keyword) params.keyword = keyword;
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
          <h1 className="page-title">👤 账户管理</h1>
          <p className="page-subtitle">共 {total} 个用户</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditUser(null); setForm({ username: '', displayName: '', password: '123456', phone: '', email: '', organization: '', title: '', studentNumber: '', gender: '', batchId: '', idCard: '', education: '', educationSchool: '', major: '', graduationDate: '', professionalTitle: '', professionalLevel: '' }); setSelectedRoles(['STUDENT']); }}
          className="btn btn-fox btn-sm">➕ 创建用户</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { value: stats.total, label: '总用户', icon: '👥', color: 'var(--fox)' },
          { value: stats.active, label: '活跃用户', icon: '🟢', color: '#2e7d32' },
          { value: stats.students, label: '学员', icon: '🎓', color: '#1565c0' },
          { value: stats.admins, label: '管理员/讲师', icon: '⚙️', color: '#7b1fa2' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
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
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : (
        <div className="card overflow-hidden">
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
                  <td style={{ color: 'var(--ink-400)' }}>{u.username}</td>
                  <td className="font-medium">{u.displayName}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{u.phone || '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{u.email || '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || [u.role || 'STUDENT']).map((r: string) => (
                        <span key={r} className="tag" style={{
                          background: `${ROLE_COLORS[r] || '#888'}18`, color: ROLE_COLORS[r] || '#888',
                          border: `1px solid ${ROLE_COLORS[r] || '#888'}30`, fontSize: '10px',
                        }}>{ROLE_NAMES[r] || r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }} title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN') : ''}>
                    {u.lastLoginAt ? relativeTime(u.lastLoginAt) : '—'}
                  </td>
                  <td>
                    <span className={`tag ${u.isActive ? 'tag-cyan' : 'tag-ink'}`}>{u.isActive ? '正常' : '已停用'}</span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openSide(u)} className="btn btn-ghost btn-xs">查看</button>
                      <button onClick={() => openEdit(u)} className="btn btn-ghost btn-xs">编辑</button>
                      <button onClick={() => handleResetPwd(u.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--gold)' }}>改密</button>
                      <button onClick={() => handleToggleActive(u)} className="btn btn-ghost btn-xs"
                        style={{ color: u.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
                        {u.isActive ? '停用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无用户</td></tr>
              )}
            </tbody>
          </table>
          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
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

      {/* Side Panel */}
      {sideUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setSideUser(null)}>
          <div className="w-[660px] max-h-[80vh] overflow-y-auto rounded-xl p-6 shadow-xl" style={{ background: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                  {sideUser.displayName?.[0] || '🦊'}
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--ink-700)' }}>{sideUser.displayName}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-400)' }}>@{sideUser.username}</div>
                </div>
              </div>
              <button onClick={() => setSideUser(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-lg" style={{ background: 'var(--paper)' }}>
                <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--ink-400)' }}>基本信息</div>
                <div className="text-xs space-y-1.5">
                  <div><span style={{ color: 'var(--ink-300)' }}>姓名：</span>{sideUser.displayName}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>性别：</span>{sideUser.gender === 'M' ? '男' : sideUser.gender === 'F' ? '女' : '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>身份证：</span>{sideUser.idCard || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>手机：</span>{sideUser.phone || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>邮箱：</span>{sideUser.email || '—'}</div>
                </div>
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--paper)' }}>
                <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--ink-400)' }}>教育/职称信息</div>
                <div className="text-xs space-y-1.5">
                  <div><span style={{ color: 'var(--ink-300)' }}>学历：</span>{sideUser.education || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>毕业院校：</span>{sideUser.educationSchool || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>专业：</span>{sideUser.major || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>毕业时间：</span>{sideUser.graduationDate ? new Date(sideUser.graduationDate).toLocaleDateString('zh-CN') : '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>职称：</span>{sideUser.professionalTitle || '—'} {sideUser.professionalLevel ? `(${sideUser.professionalLevel})` : ''}</div>
                </div>
              </div>
              <div className="col-span-2 p-4 rounded-lg" style={{ background: 'var(--paper)' }}>
                <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--ink-400)' }}>账号信息</div>
                <div className="text-xs space-y-1.5">
                  <div><span style={{ color: 'var(--ink-300)' }}>角色：</span>{(sideUser.roles || [sideUser.role || 'STUDENT']).map((r: string) => ROLE_NAMES[r] || r).join('、')}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>单位/职务：</span>{[sideUser.organization, sideUser.title].filter(Boolean).join(' · ') || '—'}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>注册：</span>{new Date(sideUser.createdAt).toLocaleDateString('zh-CN')}</div>
                  <div><span style={{ color: 'var(--ink-300)' }}>登录：</span>{sideUser.lastLoginAt ? new Date(sideUser.lastLoginAt).toLocaleString('zh-CN') : '从未'}</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-4 border-b" style={{ borderColor: 'var(--ink-100)' }}>
              {[
                { key: 'exams', label: '📚 考试', count: sideData?.exams?.length || 0 },
                { key: 'certs', label: '🏅 证书', count: sideData?.certs?.length || 0 },
                { key: 'fees', label: '💰 缴费', count: sideData?.fees?.length || 0 },
              ].map(tab => (
                <button key={tab.key} onClick={() => setSideTab(tab.key as any)}
                  className="px-4 py-2 text-xs font-medium border-none bg-transparent cursor-pointer transition-all"
                  style={{
                    color: sideTab === tab.key ? 'var(--fox)' : 'var(--ink-400)',
                    borderBottom: sideTab === tab.key ? '2px solid var(--fox)' : '2px solid transparent',
                  }}>
                  {tab.label} {tab.count > 0 && `(${tab.count})`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {sideLoading ? (
              <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>加载中…</div>
            ) : sideTab === 'exams' ? (
              <div className="space-y-2">
                {(sideData?.exams || []).length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无考试记录</p>
                ) : (
                  sideData.exams.map((e: any) => (
                    <div key={e.id} className="p-3 rounded-lg" style={{ background: 'var(--paper)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{e.exam?.title || '—'}</span>
                        {e.isPassed === true && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#2e7d3218', color: '#2e7d32' }}>✅ {e.finalScore}分</span>}
                        {e.isPassed === false && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#ef444418', color: '#ef4444' }}>❌ {e.finalScore}分</span>}
                        {e.isPassed === null && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>⏳ 待阅卷</span>}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>
                        {e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : sideTab === 'certs' ? (
              <div className="space-y-2">
                {(sideData?.certs || []).length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无证书</p>
                ) : (
                  sideData.certs.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-lg" style={{ background: 'var(--paper)' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{c.courseName}</div>
                          <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{c.certificateNo}</div>
                        </div>
                        {c.isRevoked ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#ef444418', color: '#ef4444' }}>已撤销</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#2e7d3218', color: '#2e7d32' }}>有效</span>
                        )}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>
                        发证：{c.issueDate ? new Date(c.issueDate).toLocaleDateString('zh-CN') : '—'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(sideData?.fees || []).length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无缴费记录</p>
                ) : (
                  sideData.fees.map((f: any) => (
                    <div key={f.id} className="p-3 rounded-lg" style={{ background: 'var(--paper)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{f.type === 'TRAINING_FEE' ? '培训费' : f.type === 'EXAM_FEE' ? '考试费' : f.type === 'CERTIFICATE_FEE' ? '证书费' : f.type}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--fox)' }}>¥{f.amount}</span>
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>
                        {f.status === 'PAID' ? '✅ 已缴费' : f.status === 'UNPAID' ? '⏳ 未缴费' : '❌ ' + f.status} · {f.createdAt ? new Date(f.createdAt).toLocaleDateString('zh-CN') : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <button onClick={() => { setSideUser(null); openEdit(sideUser); }}
                className="btn btn-fox btn-xs">✏️ 编辑资料</button>
              <button onClick={() => handleResetPwd(sideUser.id)} className="btn btn-outline btn-xs" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                🔑 重置密码
              </button>
              <button onClick={() => handleToggleActive(sideUser)} className="btn btn-outline btn-xs"
                style={{ color: sideUser.isActive ? 'var(--verm)' : 'var(--cyan)', borderColor: sideUser.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
                {sideUser.isActive ? '停用' : '启用'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditUser(null); } }}>
          <div className="modal-card max-w-[560px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{editUser ? '编辑用户' : '创建用户'}</h3>
              <button onClick={() => { setShowModal(false); setEditUser(null); }} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>用户名 *</label>
                  <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="input" disabled={!!editUser} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>姓名 *</label>
                  <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>手机号</label>
                  <input value={form.phone} onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setForm({...form, phone: v});
                  }} className="input" placeholder="11位手机号" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>邮箱</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>单位</label>
                  <input value={form.organization} onChange={e => setForm({...form, organization: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>职务</label>
                  <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>学号</label>
                  <input value={form.studentNumber} onChange={e => setForm({...form, studentNumber: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>性别</label>
                  <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input select">
                    <option value="">—</option>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>身份证号</label>
                  <input value={form.idCard} onChange={e => setForm({...form, idCard: e.target.value})} className="input" placeholder="18位" maxLength={18} disabled={!!editUser} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>学历</label>
                  <select value={form.education} onChange={e => setForm({...form, education: e.target.value})} className="input select">
                    <option value="">—</option>
                    <option value="本科">本科</option><option value="硕士">硕士</option>
                    <option value="博士">博士</option><option value="其他">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>毕业院校</label>
                  <input value={form.educationSchool} onChange={e => setForm({...form, educationSchool: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>专业</label>
                  <input value={form.major} onChange={e => setForm({...form, major: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>毕业时间</label>
                  <input type="month" value={form.graduationDate} onChange={e => setForm({...form, graduationDate: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>职称</label>
                  <input value={form.professionalTitle} onChange={e => setForm({...form, professionalTitle: e.target.value})} className="input" placeholder="如：高级工程师" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>职称等级</label>
                  <select value={form.professionalLevel} onChange={e => setForm({...form, professionalLevel: e.target.value})} className="input select">
                    <option value="">—</option>
                    <option value="正高级">正高级</option><option value="副高级">副高级</option>
                    <option value="中级">中级</option><option value="初级">初级</option>
                  </select>
                </div>
              </div>

              {/* Roles */}
              <div className="mt-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>角色（可多选）</label>
                {(() => {
                  const sysRoles = allRoles.filter((r: any) => r.isSystem);
                  const customRoles = allRoles.filter((r: any) => !r.isSystem);
                  return (
                    <div className="space-y-2">
                      {sysRoles.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--ink-300)' }}>系统角色</div>
                          <div className="flex flex-wrap gap-1.5">
                            {sysRoles.map((r: any) => (
                              <label key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-all"
                                style={{
                                  background: selectedRoles.includes(r.code) ? `${r.color || '#e87a30'}18` : 'var(--paper)',
                                  border: '1px solid ' + (selectedRoles.includes(r.code) ? (r.color || '#e87a30') : 'var(--ink-100)'),
                                }}>
                                <input type="checkbox" checked={selectedRoles.includes(r.code)}
                                  onChange={e => { e.target.checked ? setSelectedRoles([...selectedRoles, r.code]) : setSelectedRoles(selectedRoles.filter(c => c !== r.code)); }}
                                  className="cursor-pointer accent-[var(--fox)]" />
                                {r.color && <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.color }} />}
                                {r.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {customRoles.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--ink-300)' }}>自定义角色（{customRoles.length}个）</div>
                          <div className="flex flex-wrap gap-1.5">
                            {customRoles.map((r: any) => (
                              <label key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-all"
                                style={{
                                  background: selectedRoles.includes(r.code) ? `${r.color || '#e87a30'}18` : 'var(--paper)',
                                  border: '1px solid ' + (selectedRoles.includes(r.code) ? (r.color || '#e87a30') : 'var(--ink-100)'),
                                }}>
                                <input type="checkbox" checked={selectedRoles.includes(r.code)}
                                  onChange={e => { e.target.checked ? setSelectedRoles([...selectedRoles, r.code]) : setSelectedRoles(selectedRoles.filter(c => c !== r.code)); }}
                                  className="cursor-pointer accent-[var(--fox)]" />
                                {r.color && <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.color }} />}
                                {r.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Password */}
              <div className="mt-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                  密码 {editUser ? '（留空不修改）' : '*'}
                </label>
                <input value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="input" type="password" placeholder={editUser ? '留空则不修改密码' : '默认密码'} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowModal(false); setEditUser(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
                {saving ? '保存中…' : '💾 保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
