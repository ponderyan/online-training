'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

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

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    username: '', displayName: '', password: '123456',
    studentNumber: '', phone: '', email: '', organization: '', groupId: '',
  });
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

  useEffect(() => { load(1); loadGroups(); }, []);

  // ── 搜索 ──
  useEffect(() => {
    const timer = setTimeout(() => { load(1); }, 400);
    return () => clearTimeout(timer);
  }, [keyword, filterGroup]);

  const resetForm = () => setForm({
    username: '', displayName: '', password: '123456',
    studentNumber: '', phone: '', email: '', organization: '', groupId: '',
  });

  const handleSave = async () => {
    if (!form.username || !form.displayName) { alert('用户名和姓名不能为空'); return; }
    setSaving(true);
    try {
      const payload = { ...form, groupId: form.groupId ? Number(form.groupId) : undefined };
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

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🦊 学员管理</h1>
          <p className="page-subtitle">共 {total} 名学员{totalPages > 1 && <span className="ml-2 text-xs opacity-50">第 {page}/{totalPages} 页</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowGroup(true); setGroupForm({ name: '', note: '' }); }}
            className="btn btn-outline btn-sm">📂 分组管理</button>
          <button onClick={() => { setShowImport(true); setBatchResult(null); setBatchText(''); }}
            className="btn btn-outline btn-sm">📥 批量导入</button>
          <button onClick={() => { setShowAdd(true); setEditStudent(null); resetForm(); }}
            className="btn btn-fox btn-sm">➕ 添加学员</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="搜索姓名/用户名/学号/手机号…" className="input" style={{ maxWidth: 320 }} />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="input select" style={{ maxWidth: 180 }}>
          <option value="">全部班级</option>
          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g._count?.members || 0}人)</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>
          <p className="mb-3">还没有学员记录</p>
          <button onClick={() => setShowAdd(true)} className="btn btn-fox btn-sm">添加第一位学员</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                <th>学号</th>
                <th>姓名</th>
                <th>用户名</th>
                <th>手机号</th>
                <th>单位</th>
                <th>班级</th>
                <th>状态</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s.id}>
                  <td><span className="font-medium" style={{ color: 'var(--ink-500)' }}>{s.studentNumber || '—'}</span></td>
                  <td><span className="font-medium">{s.displayName}</span></td>
                  <td style={{ color: 'var(--ink-400)' }}>{s.username}</td>
                  <td>{s.phone || '—'}</td>
                  <td className="max-w-[160px] truncate">{s.organization || '—'}</td>
                  <td>{s.group?.name || '—'}</td>
                  <td>
                    <span className={`tag ${s.isActive ? 'tag-cyan' : 'tag-ink'}`}>
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

      {/* ── Batch Import Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowImport(false); setBatchResult(null); } }}>
          <div className="modal-card max-w-[600px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">📥 批量导入学员</h3>
              <button onClick={() => { setShowImport(false); setBatchResult(null); }} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body">
              <p className="text-xs mb-3" style={{ color: 'var(--ink-400)' }}>
                每行一名学员，格式：<code className="px-1 rounded" style={{ background: 'var(--paper-dark)' }}>用户名,姓名,密码,学号,手机号,单位</code>
                &nbsp;（分隔符支持逗号、中文逗号、Tab）
              </p>
              <textarea value={batchText} onChange={e => setBatchText(e.target.value)}
                className="input textarea" rows={8}
                placeholder="stu002,李四,123456,DTM2026002,13900139002,YY公司&#10;stu003,王五,123456,DTM2026003,13700137003,ZZ科技" />

              {batchResult && (
                <div className="mt-3 p-3 rounded text-sm" style={{ background: batchResult.failCount === 0 ? 'var(--cyan-glow)' : 'var(--verm-glow)' }}>
                  <span style={{ color: 'var(--cyan)' }}>✅ 成功 {batchResult.successCount}</span>
                  {batchResult.failCount > 0 && (
                    <span className="ml-3" style={{ color: 'var(--verm)' }}>❌ 失败 {batchResult.failCount}</span>
                  )}
                  {batchResult.results?.filter((r: any) => !r.success).slice(0, 3).map((r: any, i: number) => (
                    <div key={i} className="text-xs mt-1" style={{ color: 'var(--verm)' }}>{r.username}: {r.message}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowImport(false); setBatchResult(null); }} className="btn btn-ghost btn-sm">关闭</button>
              {!batchResult && (
                <button onClick={handleBatchImport} disabled={batchImporting} className="btn btn-fox btn-sm">
                  {batchImporting ? '导入中…' : '开始导入'}
                </button>
              )}
            </div>
          </div>
        </div>
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
