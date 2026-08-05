'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import ImportModal from './import-modal';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonTable } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { validatePhone, validateEmail } from '@/lib/validators';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Users, Plus, Download, FolderOpen, Upload, LayoutList, LayoutGrid } from 'lucide-react';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员',
  LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'var(--verm)', ORG_ADMIN: 'var(--fox)',
  LECTURER: 'var(--cyan)', PROCTOR: 'var(--purple)', STUDENT: 'var(--ink-400)',
};
const ROLE_BGS: Record<string, string> = {
  SUPER_ADMIN: 'var(--verm-glow)', ORG_ADMIN: 'var(--fox-pale)',
  LECTURER: 'var(--cyan-glow)', PROCTOR: 'rgba(123,31,162,0.09)', STUDENT: 'transparent',
};

export default function StudentsPage() {
  const router = useRouter();
  const toast = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{id:number;name:string} | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword);
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
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (filterGroup) params.groupId = filterGroup;
      const data = await api.students.list(params);
      setStudents(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message || '加载学员列表失败');
    }
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
  }, [debouncedKeyword, filterGroup]);

  const resetForm = () => setForm({
    username: '', displayName: '', password: '123456',
    studentNumber: '', phone: '', email: '', organization: '', groupId: '',
    role: 'STUDENT',
  });

  const handleSave = async () => {
    if (!form.username || !form.displayName) { toast.warning('用户名和姓名不能为空'); return; }
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { toast.warning(phoneErr); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr) { toast.warning(emailErr); return; }
    setSaving(true);
    try {
      const payload = { ...form, roles: selectedRolesStu, groupId: form.groupId ? Number(form.groupId) : undefined };
      if (editStudent) {
        await api.students.update(editStudent.id, payload);
      } else {
        await api.students.create(payload);
      }
      toast.success(editStudent ? '学员信息已更新' : '学员已添加');
      setShowAdd(false); setEditStudent(null); resetForm(); load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
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
    if (students.length === 0) { toast.warning('请填写有效的学员数据（每行：用户名,姓名,密码,学号,手机号,单位）'); return; }
    setBatchImporting(true);
    try {
      const res = await api.students.batchCreate({ students });
      setBatchResult(res);
      toast.success(`批量导入完成：成功 ${res.successCount} 条`);
    } catch (e: any) { toast.error('批量导入失败：' + e.message); }
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
      style={{ background: 'var(--paper-bright)', border: '1px solid var(--ink-100)' }}
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2"><Users size={22} className="text-[var(--fox)]" /> 学员管理</h1>
          <p className="page-subtitle">共 {total} 名学员{totalPages > 1 && <span className="ml-2 text-xs opacity-50">第 {page}/{totalPages} 页</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            } catch (e: any) { toast.error('导出失败：' + e.message); }
          }} className="btn btn-outline btn-sm"><Download size={14} className="inline mr-1" />导出CSV</button>
          <button onClick={() => { setShowGroup(true); setGroupForm({ name: '', note: '' }); }}
            className="btn btn-outline btn-sm"><FolderOpen size={14} className="inline mr-1" />分组管理</button>
          <button onClick={() => setShowImport(true)}
            className="btn btn-outline btn-sm"><Upload size={14} className="inline mr-1" />导入学员</button>
          <button onClick={() => { setShowAdd(true); setEditStudent(null); resetForm(); }}
            className="btn btn-fox btn-sm"><Plus size={14} className="inline mr-1" />添加学员</button>
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
            <LayoutList size={13} className="inline mr-1" />表格
          </button>
          <button onClick={() => setViewMode('card')}
            className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
            style={{ background: viewMode === 'card' ? 'var(--fox)' : 'transparent', color: viewMode === 'card' ? '#fff' : 'var(--ink-400)', border: 'none' }}>
            <LayoutGrid size={13} className="inline mr-1" />卡片
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card"><div className="card-body"><SkeletonTable rows={8} cols={7} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : students.length === 0 ? (
        <div className="card">
          <EmptyState icon="" title="还没有学员记录" description="添加学员或批量导入，开始管理">
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>添加第一位学员</Button>
          </EmptyState>
        </div>
      ) : viewMode === 'table' ? (
        /* ── 表格视图 ── */
        <Table>
          <THead>
            <TH>学号</TH>
            <TH>姓名</TH>
            <TH>用户名</TH>
            <TH>角色</TH>
            <TH>手机号</TH>
            <TH>邮箱</TH>
            <TH>单位</TH>
            <TH>班级</TH>
            <TH>注册时间</TH>
            <TH>状态</TH>
            <TH style={{ width: 140 }}>操作</TH>
          </THead>
          <TBody>
            {students.map((s: any) => (
              <TR key={s.id}>
                <TD><span className="font-medium text-[var(--ink-500)]">{s.studentNumber || '—'}</span></TD>
                <TD><a onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer hover:underline font-medium text-[var(--fox)]">{s.displayName}</a></TD>
                <TD className="text-[var(--ink-400)]">{s.username}</TD>
                <TD><RoleBadge roles={s.roleAssignments?.map((ra: any) => ra.role.code) || [s.role || 'STUDENT']} /></TD>
                <TD>{s.phone || '—'}</TD>
                <TD className="text-xs text-[var(--ink-400)]">{s.email || '—'}</TD>
                <TD className="max-w-[160px] truncate text-xs text-[var(--ink-400)]">{s.organization || '—'}</TD>
                <TD className="text-xs">{s.group?.name || '—'}</TD>
                <TD className="text-xs text-[var(--ink-300)]">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('zh-CN') : '—'}</TD>
                <TD>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.isActive ? 'tag-cyan' : 'tag-ink'}`}>
                    {s.isActive ? '正常' : '已停用'}
                  </span>
                </TD>
                <TD>
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
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        /* ── 卡片视图 ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(s => <StudentCard key={s.id} s={s} />)}
        </div>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} onChange={(p) => load(p)} />

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
                          className="cursor-pointer accent-[var(--fox)]" />
                        {r.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>手机号</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/[^\d]/g, '')})}
                    className="input" placeholder="11位手机号" maxLength={11} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>邮箱</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value.replace(/[^a-zA-Z0-9._%+@\-]/g, '') })}
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
                  try { await api.students.createGroup(groupForm); setGroupForm({ name: '', note: '' }); loadGroups(); toast.success('分组已创建'); }
                  catch (e: any) { toast.error('创建失败：' + e.message); }
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
