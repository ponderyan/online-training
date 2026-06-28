'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ImportModal from './import-modal';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员',
  LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'var(--verm)', ORG_ADMIN: 'var(--fox)',
  LECTURER: 'var(--cyan)', PROCTOR: '#7b1fa2', STUDENT: 'var(--ink-400)',
};
const ROLE_BGS: Record<string, string> = {
  SUPER_ADMIN: 'var(--verm-glow)', ORG_ADMIN: 'var(--fox-pale)',
  LECTURER: 'var(--cyan-glow)', PROCTOR: '#7b1fa218', STUDENT: 'transparent',
};

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    username: '', displayName: '', password: '123456',
    studentNumber: '', phone: '', email: '', organization: '', groupId: '',
    role: 'STUDENT',
  });
  const [selectedRolesStu, setSelectedRolesStu] = useState<string[]>(['STUDENT']);
  const [allRolesStu, setAllRolesStu] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Group form
  const [groupForm, setGroupForm] = useState({ name: '', note: '' });
  const [groupSaving, setGroupSaving] = useState(false);

  // Batch import
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  const load = async (p: number = page) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (keyword) params.keyword = keyword;
      if (filterGroup) params.groupId = filterGroup;
      const data = await api.students.list(params);
      setStudents(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {}
    setLoading(false);
  };

  const loadGroups = async () => {
    try { setGroups(await api.students.groups()); } catch {}
  };

  useEffect(() => { load(1); loadGroups(); api.permissions.getRoles().then(setAllRolesStu).catch(() => {}); }, []);

  // ── 搜索 ──
  useEffect(() => {
    const timer = setTimeout(() => { load(1); }, 400);
    return () => clearTimeout(timer);
  }, [keyword, filterGroup]);

  const resetForm = () => setForm({
    username: '', displayName: '', password: '123456',
    studentNumber: '', phone: '', email: '', organization: '', groupId: '',
    role: 'STUDENT',
  });

  const handleSave = async () => {
    if (!form.username || !form.displayName) { alert('用户名和姓名不能为空'); return; }
    setSaving(true);
    try {
      const payload = { ...form, roles: selectedRolesStu, groupId: form.groupId ? Number(form.groupId) : undefined };
      if (editStudent) {
        await api.students.update(editStudent.id, payload);
      } else {
        await api.students.create(payload);
      }
      setShowAdd(false); setEditStudent(null); resetForm(); load();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleToggleActive = async (s: any) => {
    await api.students.update(s.id, { isActive: !s.isActive });
    load();
  };

  const handleBatchImport = async () => {
    const lines = batchText.trim().split('\n').filter(Boolean);
    const students = lines.map(line => {
      const parts = line.split(/[,，\t]/).map((s: string) => s.trim());
      return { username: parts[0], displayName: parts[1], password: parts[2] || '123456', studentNumber: parts[3] || '', phone: parts[4] || '', organization: parts[5] || '' };
    }).filter(s => s.username && s.displayName);
    if (students.length === 0) { alert('请填写有效的学员数据（每行：用户名,姓名,密码,学号,手机号,单位）'); return; }
    setBatchImporting(true);
    try {
      const res = await api.students.batchCreate({ students });
      setBatchResult(res);
    } catch (e: any) { alert('批量导入失败：' + e.message); }
    setBatchImporting(false);
  };

  const RoleBadge = ({ roles: r }: { roles: string[] }) => (
    <div className="flex flex-wrap gap-1">
      {(r || ['STUDENT']).map((role: string) => (
        <span key={role} className="text-[10px] font-medium px-2 py-0.5 rounded" style={{
          background: ROLE_BGS[role] || 'transparent',
          color: ROLE_COLORS[role] || 'var(--ink-400)',
          border: `1px solid ${ROLE_COLORS[role] || 'var(--ink-200)'}`,
        }}>
          {ROLE_NAMES[role] || role}
        </span>
      ))}
    </div>
  );

  const StudentCard = ({ s }: { s: any }) => (
    <div key={s.id} className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-md"
      style={{ background: 'white', border: '1px solid var(--ink-100)' }}
      onClick={() => router.push(`/students/${s.id}`)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: s.isActive ? 'var(--fox-pale)' : 'var(--ink-100)', color: s.isActive ? 'var(--fox)' : 'var(--ink-300)' }}>
            {s.displayName?.charAt(0) || '?'}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{s.displayName}</div>
            <div className="text-xs" style={{ color: 'var(--ink-300)' }}>@{s.username}</div>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.isActive ? 'tag-cyan' : 'tag-ink'}`}>
          {s.isActive ? '正常' : '已停用'}
        </span>
      </div>
      <div className="flex gap-3 text-xs flex-wrap" style={{ color: 'var(--ink-400)' }}>
        {s.studentNumber && <span>🎓 {s.studentNumber}</span>}
        {s.phone && <span>📞 {s.phone}</span>}
        {s.email && <span>✉️ {s.email}</span>}
        {s.organization && <span>🏢 {s.organization}</span>}
        {s.group?.name && <span>📂 {s.group.name}</span>}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
        <RoleBadge roles={s.roleAssignments?.map((ra: any) => ra.role.code) || [s.role || 'STUDENT']} />
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation();
            setForm({
              username: s.username, displayName: s.displayName, password: '',
              studentNumber: s.studentNumber || '', phone: s.phone || '',
              email: s.email || '', organization: s.organization || '',
              groupId: s.groupId ? String(s.groupId) : '',
              role: s.role || 'STUDENT',
            });
            setEditStudent(s); setShowAdd(true);
          }} className="btn btn-ghost btn-xs">编辑</button>
          <button onClick={e => { e.stopPropagation(); handleToggleActive(s); }}
            className="btn btn-ghost btn-xs" style={{ color: s.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
            {s.isActive ? '停用' : '启用'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🦊 学员管理</h1>
          <p className="page-subtitle">共 {total} 名学员{totalPages > 1 && <span className="ml-2 text-xs opacity-50">第 {page}/{totalPages} 页</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/students/export-csv`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('导出失败');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `学员数据_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e: any) { alert('导出失败：' + e.message); }
          }} className="btn btn-outline btn-sm">📤 导出CSV</button>
          <button onClick={() => { setShowGroup(true); setGroupForm({ name: '', note: '' }); }}
            className="btn btn-outline btn-sm">📂 分组管理</button>
          <button onClick={() => setShowImport(true)}
            className="btn btn-outline btn-sm">📥 导入学员</button>
          <button onClick={() => { setShowAdd(true); setEditStudent(null); resetForm(); }}
            className="btn btn-fox btn-sm">➕ 添加学员</button>
        </div>
      </div>

      {/* Filters + View toggle */}
      <div className="flex gap-3 mb-5 items-center">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="搜索姓名/用户名/学号/手机号…" className="input" style={{ maxWidth: 320 }} />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="input select" style={{ maxWidth: 180 }}>
          <option value="">全部班级</option>
          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g._count?.members || 0}人)</option>)}
        </select>
        <div className="ml-auto flex border rounded-lg overflow-hidden" style={{ borderColor: 'var(--ink-200)' }}>
          <button onClick={() => setViewMode('table')}
            className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{ background: viewMode === 'table' ? 'var(--fox)' : 'transparent', color: viewMode === 'table' ? '#fff' : 'var(--ink-400)', border: 'none' }}>
            📋 表格
          </button>
          <button onClick={() => setViewMode('card')}
            className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{ background: viewMode === 'card' ? 'var(--fox)' : 'transparent', color: viewMode === 'card' ? '#fff' : 'var(--ink-400)', border: 'none' }}>
            🃏 卡片
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>
          <p className="mb-3">还没有学员记录</p>
          <button onClick={() => setShowAdd(true)} className="btn btn-fox btn-sm">添加第一位学员</button>
        </div>
      ) : viewMode === 'table' ? (
        /* ── 表格视图 ── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="list-table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>手机号</th>
                  <th>邮箱</th>
                  <th>单位</th>
                  <th>班级</th>
                  <th>注册时间</th>
                  <th>状态</th>
                  <th style={{ width: 140 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s: any) => (
                  <tr key={s.id}>
                    <td><span className="font-medium" style={{ color: 'var(--ink-500)' }}>{s.studentNumber || '—'}</span></td>
                    <td><span className="font-medium"><a onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer hover:underline" style={{ color: 'var(--fox)' }}>{s.displayName}</a></span></td>
                    <td style={{ color: 'var(--ink-400)' }}>{s.username}</td>
                    <td><RoleBadge roles={s.roleAssignments?.map((ra: any) => ra.role.code) || [s.role || 'STUDENT']} /></td>
                    <td>{s.phone || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{s.email || '—'}</td>
                    <td className="max-w-[160px] truncate text-xs" style={{ color: 'var(--ink-400)' }}>{s.organization || '—'}</td>
                    <td className="text-xs">{s.group?.name || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('zh-CN') : '—'}</td>
                    <td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.isActive ? 'tag-cyan' : 'tag-ink'}`}>
                        {s.isActive ? '正常' : '已停用'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setForm({
                            username: s.username, displayName: s.displayName, password: '',
                            studentNumber: s.studentNumber || '', phone: s.phone || '',
                            email: s.email || '', organization: s.organization || '',
                            groupId: s.groupId ? String(s.groupId) : '',
                            role: s.role || 'STUDENT',
                          });
                          setEditStudent(s);
                          setShowAdd(true);
                        }} className="btn btn-ghost btn-xs">编辑</button>
                        <button onClick={() => handleToggleActive(s)}
                          className="btn btn-ghost btn-xs"
                          style={{ color: s.isActive ? 'var(--verm)' : 'var(--cyan)' }}>
                          {s.isActive ? '停用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── 卡片视图 ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(s => <StudentCard key={s.id} s={s} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => load(page - 1)} disabled={page <= 1}
            className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>‹ 上一页</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="mx-1 text-xs" style={{ color: 'var(--ink-300)' }}>…</span>}
                <button onClick={() => load(p)}
                  className={`btn btn-xs ${p === page ? 'btn-fox' : 'btn-ghost'}`}>{p}</button>
              </span>
            ))}
          <button onClick={() => load(page + 1)} disabled={page >= totalPages}
            className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>下一页 ›</button>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setEditStudent(null); } }}>
          <div className="modal-card max-w-[500px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{editStudent ? '编辑学员' : '添加学员'}</h3>
              <button onClick={() => { setShowAdd(false); setEditStudent(null); }} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>用户名 *</label>
                  <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                    className="input" disabled={!!editStudent} placeholder="登录用" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>姓名 *</label>
                  <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})}
                    className="input" placeholder="真实姓名" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>密码</label>
                  <input value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="input" placeholder={editStudent ? '留空不修改' : '默认123456'} type="password" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>学号</label>
                  <input value={form.studentNumber} onChange={e => setForm({...form, studentNumber: e.target.value})}
                    className="input" placeholder="如 DTM2026001" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>角色（可多选）</label>
                  <div className="flex flex-wrap gap-1.5">
                    {allRolesStu.map((r: any) => (
                      <label key={r.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-all"
                        style={{
                          background: selectedRolesStu.includes(r.code) ? 'var(--fox-pale)' : 'var(--paper)',
                          border: '1px solid ' + (selectedRolesStu.includes(r.code) ? 'var(--fox)' : 'var(--ink-100)'),
                        }}>
                        <input type="checkbox" checked={selectedRolesStu.includes(r.code)}
                          onChange={e => { e.target.checked ? setSelectedRolesStu([...selectedRolesStu, r.code]) : setSelectedRolesStu(selectedRolesStu.filter(c => c !== r.code)); }}
                          className="cursor-pointer accent-[#e87a30]" />
                        {r.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>手机号</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="input" placeholder="手机号" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>邮箱</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="input" placeholder="邮箱" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>工作单位</label>
                  <input value={form.organization} onChange={e => setForm({...form, organization: e.target.value})}
                    className="input" placeholder="工作单位/机构" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>所属班级</label>
                  <select value={form.groupId} onChange={e => setForm({...form, groupId: e.target.value})} className="input select">
                    <option value="">无分组</option>
                    {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowAdd(false); setEditStudent(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-ink btn-sm">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Excel 导入学员 Modal ── */}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); load(); }} />
      )}

      {/* ── Group Management Modal ── */}
      {showGroup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowGroup(false); }}>
          <div className="modal-card max-w-[480px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">📂 班级分组管理</h3>
              <button onClick={() => setShowGroup(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body">
              {groups.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--ink-300)' }}>暂无分组</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {groups.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--paper)' }}>
                      <div>
                        <span className="text-sm font-medium">{g.name}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--ink-300)' }}>{g._count?.members} 人</span>
                        {g.note && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>{g.note}</p>}
                      </div>
                      <button onClick={async () => {
                        if (!confirm(`确认删除分组"${g.name}"？学员将变为无分组状态。`)) return;
                        await api.students.deleteGroup(g.id);
                        loadGroups();
                      }} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                    </div>
                  ))}
                </div>
              )}
              <hr className="divider" />
              <div className="flex gap-3 items-end mt-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>分组名称</label>
                  <input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                    className="input" placeholder="如 DTM二期班" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>说明（选填）</label>
                  <input value={groupForm.note} onChange={e => setGroupForm({...groupForm, note: e.target.value})}
                    className="input" placeholder="班级说明" />
                </div>
                <button onClick={async () => {
                  if (!groupForm.name) return;
                  setGroupSaving(true);
                  try { await api.students.createGroup(groupForm); setGroupForm({ name: '', note: '' }); loadGroups(); }
                  catch (e: any) { alert('创建失败：' + e.message); }
                  setGroupSaving(false);
                }} disabled={groupSaving || !groupForm.name} className="btn btn-fox btn-sm">
                  {groupSaving ? '…' : '添加'}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowGroup(false)} className="btn btn-ink btn-sm">关闭</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
