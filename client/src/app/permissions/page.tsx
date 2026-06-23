'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const PERM_TREE: { key: string; icon: string; children: { permission: string; name: string }[] }[] = [
  { key: '系统管理', icon: '⚙️', children: [
    { permission: 'system.config', name: '系统配置' }, { permission: 'system.logs', name: '系统日志' },
    { permission: 'system.tenant', name: '租户管理' }, { permission: 'system.dictionary', name: '数据字典' },
    { permission: 'notification:view', name: '系统通知' },
  ]},
  { key: '题库管理', icon: '📝', children: [
    { permission: 'question.create', name: '创建试题' }, { permission: 'question.edit', name: '编辑试题' },
    { permission: 'question.delete', name: '删除试题' }, { permission: 'question.import', name: '导入试题' },
    { permission: 'question.audit', name: '审核试题' },
  ]},
  { key: '试卷管理', icon: '📄', children: [
    { permission: 'paper.view', name: '查看试卷' }, { permission: 'paper.generate', name: '生成试卷' },
    { permission: 'paper.edit', name: '编辑试卷' }, { permission: 'paper.publish', name: '发布试卷' },
    { permission: 'paper.download', name: '下载试卷' }, { permission: 'paper.answerSheet', name: '答题卡管理' },
    { permission: 'template.manage', name: '管理模板' },
  ]},
  { key: '考试管理', icon: '📋', children: [
    { permission: 'exam.create', name: '创建考试' }, { permission: 'exam.edit', name: '编辑考试' },
    { permission: 'exam.delete', name: '删除考试' }, { permission: 'exam.assign', name: '分配学员' },
    { permission: 'exam:view', name: '查看考试' },
  ]},
  { key: '监考', icon: '👁️', children: [
    { permission: 'proctor.view', name: '查看监控' }, { permission: 'proctor.forceSubmit', name: '强制收卷' },
    { permission: 'proctor.extendTime', name: '延长时长' },
  ]},
  { key: '判分', icon: '📊', children: [
    { permission: 'grading.auto', name: '自动判分' }, { permission: 'grading.manual', name: '人工判分' },
    { permission: 'grading.publish', name: '发布成绩' },
  ]},
  { key: '学员管理', icon: '👥', children: [
    { permission: 'student.create', name: '创建学员' }, { permission: 'student.import', name: '导入学员' },
    { permission: 'student.edit', name: '编辑学员' }, { permission: 'student.group', name: '管理分组' },
  ]},
  { key: '培训项目', icon: '📋', children: [
    { permission: 'program:view', name: '查看项目' }, { permission: 'program:create', name: '创建项目' },
    { permission: 'program:edit', name: '编辑项目' }, { permission: 'program:delete', name: '删除项目' },
    { permission: 'program:enroll', name: '学员报名' },
  ]},
  { key: '教材出题', icon: '📖', children: [
    { permission: 'material.upload', name: '上传教材' }, { permission: 'material.review', name: '审核试题' },
    { permission: 'material.generate', name: 'AI 出题' },
  ]},
  { key: '证书', icon: '🏅', children: [
    { permission: 'cert.issue', name: '发证' }, { permission: 'cert.revoke', name: '撤销证书' },
    { permission: 'cert.view', name: '查看证书' }, { permission: 'cert:approve', name: '审批证书' },
    { permission: 'cert:reject', name: '驳回申请' },
    { permission: 'cert:application_view', name: '查看申请' },
  ]},
  { key: '课程管理', icon: '🎬', children: [
    { permission: 'course:view', name: '查看课程' }, { permission: 'course:create', name: '创建课程' },
    { permission: 'course:edit', name: '编辑课程' }, { permission: 'course:delete', name: '删除课程' },
  ]},
  { key: '排课管理', icon: '📅', children: [
    { permission: 'schedule:view', name: '查看排课' }, { permission: 'schedule:create', name: '创建排课' },
    { permission: 'schedule:edit', name: '编辑排课' }, { permission: 'schedule:delete', name: '删除排课' },
  ]},
  { key: '讲师管理', icon: '👨‍🏫', children: [
    { permission: 'instructor:view', name: '查看讲师' }, { permission: 'instructor:create', name: '创建讲师' },
    { permission: 'instructor:edit', name: '编辑讲师' }, { permission: 'instructor:delete', name: '删除讲师' },
  ]},
  { key: '代理机构', icon: '🤝', children: [
    { permission: 'agency:view', name: '查看机构' }, { permission: 'agency:create', name: '创建机构' },
    { permission: 'agency:edit', name: '编辑机构' }, { permission: 'agency:delete', name: '删除机构' },
  ]},
  { key: '通知公告', icon: '📢', children: [
    { permission: 'notice.send', name: '发送通知' }, { permission: 'notice.manage', name: '管理通知' },
  ]},
  { key: '报表', icon: '📊', children: [
    { permission: 'report.view', name: '查看报表' }, { permission: 'report.export', name: '导出报表' },
  ]},
  { key: '成绩单', icon: '📜', children: [
    { permission: 'transcript:view', name: '查看成绩单' },
  ]},
  { key: '机构管理', icon: '🏢', children: [
    { permission: 'org:view', name: '查看机构' }, { permission: 'org:create', name: '创建机构' },
    { permission: 'org:edit', name: '编辑机构' }, { permission: 'org:delete', name: '删除机构' },
  ]},
  { key: '角色管理', icon: '🔐', children: [
    { permission: 'role:view', name: '查看角色' }, { permission: 'role:create', name: '创建角色' },
    { permission: 'role:edit', name: '编辑角色' }, { permission: 'role:delete', name: '删除角色' },
  ]},
  { key: '学时管理', icon: '⏱️', children: [
    { permission: 'learningHour:view', name: '查看学时' }, { permission: 'learningHour:manage', name: '管理学时' },
  ]},
  { key: '评价管理', icon: '⭐', children: [
    { permission: 'evaluation:view', name: '查看评价' }, { permission: 'evaluation:manage', name: '管理评价' },
  ]},
  { key: 'AI配置', icon: '🤖', children: [
    { permission: 'aiConfig:view', name: '查看配置' }, { permission: 'aiConfig:manage', name: '管理配置' },
  ]},
  { key: '审计日志', icon: '📋', children: [
    { permission: 'auditLog:view', name: '查看日志' },
  ]},
];

const PRESET_COLORS = ['#ef4444', '#e87a30', '#1565c0', '#f59e0b', '#2e7d32', '#7b1fa2', '#0ea5e9', '#ec4899'];

export default function PermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Permission panel states
  const [activeTab, setActiveTab] = useState<'perms' | 'members'>('perms');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(PERM_TREE.map(g => g.key)));
  const [searchText, setSearchText] = useState('');
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  // Member list states
  const [roleUsers, setRoleUsers] = useState<any[]>([]);
  const [roleUsersTotal, setRoleUsersTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [memberLoading, setMemberLoading] = useState(false);

  // Role modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRoleData, setEditRoleData] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '', color: '#0ea5e9', copyFromRoleId: 0 });

  const load = async () => {
    try {
      const [r, m] = await Promise.all([
        api.permissions.getRoles(),
        api.permissions.getMatrix(),
      ]);
      setRoles(r || []);
      const matrixData = m.matrix || [];
      setMatrix(matrixData);
      if (matrixData.length > 0 && !selectedRoleId) setSelectedRoleId(matrixData[0].roleId);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const selectedRow = matrix.find(r => r.roleId === selectedRoleId);

  const getPermMap = useCallback((roleId: number): Map<string, boolean> => {
    const row = matrix.find(r => r.roleId === roleId);
    if (!row) return new Map();
    return new Map(row.permissions.map((p: any) => [p.permission, p.granted]));
  }, [matrix]);

  const permMap = getPermMap(selectedRoleId || 0);

  // Filtered permission tree
  const filteredTree = useMemo(() => {
    let groups = PERM_TREE;
    if (searchText) {
      const q = searchText.toLowerCase();
      groups = groups.map(g => ({
        ...g,
        children: g.children.filter(c => c.name.includes(q) || c.permission.includes(q)),
      })).filter(g => g.children.length > 0);
    }
    if (showEnabledOnly) {
      groups = groups.map(g => ({
        ...g,
        children: g.children.filter(c => permMap.get(c.permission)),
      })).filter(g => g.children.length > 0);
    }
    return groups;
  }, [searchText, showEnabledOnly, permMap]);

  const togglePerm = (permission: string) => {
    if (!selectedRoleId) return;
    setMatrix((prev: any[]) => prev.map(r =>
      r.roleId === selectedRoleId ? { ...r, permissions: r.permissions.map((p: any) => p.permission === permission ? { ...p, granted: !p.granted } : p) } : r
    ));
  };

  const toggleGroup = (perms: string[], granted: boolean) => {
    if (!selectedRoleId) return;
    setMatrix((prev: any[]) => prev.map(r =>
      r.roleId === selectedRoleId ? { ...r, permissions: r.permissions.map((p: any) => perms.includes(p.permission) ? { ...p, granted } : p) } : r
    ));
  };

  const saveRolePerms = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const row = matrix.find(r => r.roleId === selectedRoleId);
      if (row) await api.permissions.updateRolePerms(selectedRoleId, row.permissions);
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const loadRoleUsers = async (rid: number, p: number, search?: string) => {
    setMemberLoading(true);
    try {
      const res = await fetch(`/api/permissions/roles/${rid}/users?page=${p}&pageSize=20${search ? '&search=' + encodeURIComponent(search) : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setRoleUsers(data.items || []);
      setRoleUsersTotal(data.total || 0);
    } catch {}
    setMemberLoading(false);
  };

  useEffect(() => {
    if (selectedRoleId && activeTab === 'members') {
      loadRoleUsers(selectedRoleId, memberPage, memberSearch);
    }
  }, [selectedRoleId, activeTab, memberPage]);

  const removeRoleUser = async (assignmentId: number) => {
    if (!confirm('确认移除该用户的此角色？')) return;
    try {
      await fetch(`/api/permissions/roles/${selectedRoleId}/users/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      loadRoleUsers(selectedRoleId!, memberPage, memberSearch);
      load();
    } catch {}
  };

  const handleSaveRole = async () => {
    if (!roleForm.name || (!editRoleData && !roleForm.code)) { alert('请填写必要信息'); return; }
    try {
      if (editRoleData) {
        await fetch(`/api/permissions/roles/${editRoleData.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ name: roleForm.name, description: roleForm.description, color: roleForm.color }),
        });
      } else {
        await fetch('/api/permissions/roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ name: roleForm.name, code: roleForm.code.toUpperCase(), description: roleForm.description, color: roleForm.color, copyFromRoleId: roleForm.copyFromRoleId || undefined }),
        });
      }
      setShowRoleModal(false); setEditRoleData(null); load();
    } catch (e: any) { alert('保存失败'); }
  };

  const deleteRole = async (id: number) => {
    const role = roles.find(r => r.id === id);
    const msg = role?.userCount > 0
      ? `此角色共 ${role.userCount} 个用户，删除后这些用户将失去此角色下的所有权限。确认删除？`
      : '确认删除此角色？';
    if (!confirm(msg)) return;
    try {
      await fetch(`/api/permissions/roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (selectedRoleId === id) setSelectedRoleId(null);
      load();
    } catch (e: any) { alert('删除失败'); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left: Role List */}
        <div className="w-56 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: 'var(--ink-700)' }}>🔐 角色</h2>
            <button onClick={() => { setShowRoleModal(true); setEditRoleData(null); setRoleForm({ name: '', code: '', description: '', color: '#0ea5e9', copyFromRoleId: 0 }); }}
              className="btn btn-fox btn-xs">+ 新建</button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto pr-2">
            {matrix.map((row: any) => {
              const role = roles.find((r: any) => r.id === row.roleId);
              const isSelected = row.roleId === selectedRoleId;
              const grantedCount = row.permissions?.filter((p: any) => p.granted).length || 0;
              const color = row.color || '#888';
              return (
                <div key={row.roleId}
                  className="px-3 py-2.5 rounded-lg transition-all cursor-pointer"
                  style={{ background: isSelected ? `${color}15` : 'transparent', border: `1px solid ${isSelected ? color : 'transparent'}` }}
                  onClick={() => { setSelectedRoleId(row.roleId); setActiveTab('perms'); }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm font-medium truncate" style={{ color: isSelected ? color : 'var(--ink-600)' }}>
                        {row.roleName || row.role}
                      </span>
                    </div>
                    {!role?.isSystem && (
                      <button onClick={e => { e.stopPropagation(); deleteRole(row.roleId); }}
                        className="text-[10px] bg-transparent border-none cursor-pointer flex-shrink-0 hover:opacity-70" style={{ color: 'var(--ink-300)' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                      {role?.userCount ?? 0} 人 · {grantedCount} 权限
                    </span>
                    <button onClick={e => { e.stopPropagation(); setEditRoleData(role); setRoleForm({ name: role.name, code: role.code, description: role.description || '', color: role.color || '#0ea5e9', copyFromRoleId: 0 }); setShowRoleModal(true); }}
                      className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>
                      ✏️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedRole && selectedRow ? (
            <>
              {/* Role header + Tabs */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ background: selectedRow.color || '#888' }} />
                  <h2 className="font-bold text-base" style={{ color: 'var(--ink-700)' }}>{selectedRole.name || selectedRole.code}</h2>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>{selectedRole.isSystem ? '系统角色' : '自定义角色'}</span>
                </div>
              </div>

              <div className="flex gap-3 mb-4 border-b" style={{ borderColor: 'var(--ink-100)' }}>
                <button onClick={() => setActiveTab('perms')}
                  className="px-3 py-2 text-xs font-medium border-none bg-transparent cursor-pointer transition-all"
                  style={{ color: activeTab === 'perms' ? 'var(--fox)' : 'var(--ink-400)', borderBottom: activeTab === 'perms' ? '2px solid var(--fox)' : '2px solid transparent' }}>
                  🔧 权限配置
                </button>
                <button onClick={() => setActiveTab('members')}
                  className="px-3 py-2 text-xs font-medium border-none bg-transparent cursor-pointer transition-all"
                  style={{ color: activeTab === 'members' ? 'var(--fox)' : 'var(--ink-400)', borderBottom: activeTab === 'members' ? '2px solid var(--fox)' : '2px solid transparent' }}>
                  👥 成员列表 {roleUsersTotal > 0 && `(${roleUsersTotal})`}
                </button>
              </div>

              {activeTab === 'perms' ? (
                /* ── Permissions Tab ── */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Toolbar */}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <input value={searchText} onChange={e => setSearchText(e.target.value)}
                      placeholder="🔍 搜索权限…" className="input text-xs" style={{ width: 200, height: 32 }} />
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--ink-400)' }}>
                      <input type="checkbox" checked={showEnabledOnly} onChange={e => setShowEnabledOnly(e.target.checked)}
                        className="accent-[#e87a30] w-3 h-3" />
                      仅显示已启用
                    </label>
                    <div className="flex-1" />
                    <button onClick={saveRolePerms} disabled={saving}
                      className="btn btn-fox btn-xs">
                      {saving ? '保存中…' : '💾 保存权限'}
                    </button>
                  </div>

                  {/* Permissions */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {filteredTree.map(group => {
                      const groupPerms = group.children.map(c => c.permission);
                      const grantedCount = group.children.filter(c => permMap.get(c.permission)).length;
                      const isCollapsed = collapsedGroups.has(group.key);
                      return (
                        <div key={group.key} className="card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
                            style={{ background: 'var(--paper-dark)' }}
                            onClick={() => {
                              const next = new Set(collapsedGroups);
                              isCollapsed ? next.delete(group.key) : next.add(group.key);
                              setCollapsedGroups(next);
                            }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                              <span className="text-sm font-medium">{group.icon} {group.key}</span>
                              <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>({grantedCount}/{group.children.length})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {grantedCount === group.children.length ? (
                                <button onClick={e => { e.stopPropagation(); toggleGroup(groupPerms, false); }}
                                  className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>取消全选</button>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); toggleGroup(groupPerms, true); }}
                                  className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>全选</button>
                              )}
                            </div>
                          </div>
                          {!isCollapsed && (
                            <div className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {group.children.map(child => {
                                  const granted = permMap.get(child.permission);
                                  return (
                                    <label key={child.permission}
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer text-xs transition-all"
                                      style={{
                                        background: granted ? `${selectedRow.color || '#e87a30'}18` : 'var(--paper)',
                                        border: `1px solid ${granted ? (selectedRow.color || '#e87a30') : 'var(--ink-100)'}`,
                                        color: granted ? (selectedRow.color || 'var(--fox-dark)') : 'var(--ink-400)',
                                      }}>
                                      <input type="checkbox" checked={!!granted}
                                        onChange={() => togglePerm(child.permission)}
                                        className="cursor-pointer accent-[#e87a30] w-3 h-3" />
                                      {child.name}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── Members Tab ── */
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center gap-3 mb-4">
                    <input value={memberSearch} onChange={e => { setMemberSearch(e.target.value); setMemberPage(1); }}
                      placeholder="🔍 搜索用户名/姓名…" className="input text-xs" style={{ width: 220, height: 32 }}
                      onKeyDown={e => e.key === 'Enter' && loadRoleUsers(selectedRoleId!, 1, memberSearch)} />
                    <button onClick={() => loadRoleUsers(selectedRoleId!, 1, memberSearch)}
                      className="btn btn-ghost btn-xs">搜索</button>
                    <span className="text-xs" style={{ color: 'var(--ink-300)' }}>共 {roleUsersTotal} 人</span>
                  </div>
                  {memberLoading ? (
                    <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                  ) : (
                    <div className="card overflow-hidden flex-1">
                      <table className="list-table">
                        <thead><tr><th>用户名</th><th>姓名</th><th>机构</th><th>分配时间</th><th>操作</th></tr></thead>
                        <tbody>
                          {roleUsers.map((u: any) => (
                            <tr key={u.id}>
                              <td style={{ color: 'var(--ink-400)' }}>{u.username}</td>
                              <td className="font-medium">{u.displayName}</td>
                              <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{u.orgName}</td>
                              <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                                {u.assignedAt ? new Date(u.assignedAt).toLocaleDateString('zh-CN') : '—'}
                              </td>
                              <td>
                                <button onClick={() => removeRoleUser(u.assignmentId)}
                                  className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>移除</button>
                              </td>
                            </tr>
                          ))}
                          {roleUsers.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无成员</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><p className="text-5xl mb-4">🔐</p><p style={{ color: 'var(--ink-300)' }}>请从左侧选择一个角色</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Role Create/Edit Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowRoleModal(false); setEditRoleData(null); } }}>
          <div className="modal-card max-w-[460px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{editRoleData ? '编辑角色' : '新建角色'}</h3>
              <button onClick={() => { setShowRoleModal(false); setEditRoleData(null); }}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>角色名称 *</label>
                  <input value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} className="input" placeholder="如：巡考官" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>角色标识 *</label>
                  <input value={roleForm.code} onChange={e => setRoleForm({...roleForm, code: e.target.value.toUpperCase()})} className="input"
                    placeholder="如：PATROL" disabled={!!editRoleData} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>描述</label>
                <textarea value={roleForm.description} onChange={e => setRoleForm({...roleForm, description: e.target.value})} className="input textarea" rows={2} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>颜色</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setRoleForm({...roleForm, color: c})}
                      className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer"
                      style={{ background: c, borderColor: roleForm.color === c ? '#333' : 'transparent' }} />
                  ))}
                </div>
              </div>
              {!editRoleData && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>复制权限自（可选）</label>
                  <select value={roleForm.copyFromRoleId} onChange={e => setRoleForm({...roleForm, copyFromRoleId: parseInt(e.target.value)})}
                    className="input select">
                    <option value={0}>不复制</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                  {roleForm.copyFromRoleId > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--fox)' }}>新建的角色将获得与所选角色相同的权限</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowRoleModal(false); setEditRoleData(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSaveRole} className="btn btn-fox btn-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
