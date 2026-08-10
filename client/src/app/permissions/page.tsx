'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import { PERM_TREE, CRITICAL_ROLES } from './components/perm-tree';
import { RoleListPanel } from './components/role-list-panel';
import { RoleModal } from './components/role-modal';
import { AddMemberModal } from './components/add-member-modal';

// ── 主页面（D 拆分后：常量/角色侧栏/两个弹窗见 components/）──
export default function PermissionsPage() {
  const toast = useToast();
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

  // Add-member modal states
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberQ, setAddMemberQ] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<any[]>([]);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberSavingId, setAddMemberSavingId] = useState<number | null>(null);

  // Role modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRoleData, setEditRoleData] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '', color: 'var(--info-light)', copyFromRoleId: 0 });

  // Reason confirm modals
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<number | null>(null);
  const [removeRoleUserTarget, setRemoveRoleUserTarget] = useState<number | null>(null);
  const [savePermsReason, setSavePermsReason] = useState<string | null>(null); // null=not showing, '' or string=reason

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

  const isCriticalRole = !!selectedRole && CRITICAL_ROLES.includes(selectedRole.code);

  const saveRolePerms = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const row = matrix.find(r => r.roleId === selectedRoleId);
      if (row) await api.permissions.updateRolePerms(selectedRoleId, row.permissions);
      toast.success('保存成功');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  // 关键角色：修改权限前需弹出原因确认
  const requestSavePerms = () => {
    if (!selectedRoleId) return;
    if (isCriticalRole) {
      setSavePermsReason(''); // 触发 modal
    } else {
      saveRolePerms();
    }
  };

  const [resetting, setResetting] = useState(false);
  const resetToDefault = async () => {
    const ok = window.confirm('↩️ 将所有角色权限恢复为系统默认值（permissions.constants.ts），此操作不可撤销，确认？');
    if (!ok) return;
    setResetting(true);
    try {
      await api.permissions.seed();
      await load();
      toast.success('已重置为默认权限配置');
    } catch (e: any) { toast.error('重置失败：' + e.message); }
    setResetting(false);
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
    setRemoveRoleUserTarget(assignmentId);
  };
  const searchAddMember = async (q: string) => {
    setAddMemberQ(q);
    if (!q.trim()) { setAddMemberResults([]); return; }
    setAddMemberLoading(true);
    try {
      const res = await api.permissions.searchUsers(q, selectedRoleId || undefined);
      setAddMemberResults(res || []);
    } catch { setAddMemberResults([]); }
    setAddMemberLoading(false);
  };

  const addMember = async (userId: number) => {
    if (!selectedRoleId) return;
    setAddMemberSavingId(userId);
    try {
      await api.permissions.addRoleUser(selectedRoleId, userId);
      // 刷新成员列表 + 角色用户计数
      await loadRoleUsers(selectedRoleId, memberPage, memberSearch);
      await load();
      // 从搜索结果里标记已添加
      setAddMemberResults(prev => prev.map(u => u.id === userId ? { ...u, hasRole: true } : u));
    } catch (e: any) { toast.error('添加失败：' + e.message); }
    setAddMemberSavingId(null);
  };

  const openNewRole = () => {
    setShowRoleModal(true); setEditRoleData(null);
    setRoleForm({ name: '', code: '', description: '', color: 'var(--info-light)', copyFromRoleId: 0 });
  };

  const openEditRole = (role: any) => {
    setEditRoleData(role);
    setRoleForm({ name: role.name, code: role.code, description: role.description || '', color: role.color || 'var(--info-light)', copyFromRoleId: 0 });
    setShowRoleModal(true);
  };

  const closeRoleModal = () => { setShowRoleModal(false); setEditRoleData(null); };

  const handleSaveRole = async () => {
    if (!roleForm.name || (!editRoleData && !roleForm.code)) { toast.warning('请填写必要信息'); return; }
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
    } catch (e: any) { toast.error('保存失败'); }
  };

  const deleteRole = async (reason: string) => {
    if (!deleteRoleTarget) return;
    const id = deleteRoleTarget;
    try {
      await fetch(`/api/permissions/roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      if (selectedRoleId === id) setSelectedRoleId(null);
      setDeleteRoleTarget(null);
      load();
    } catch (e: any) { toast.error('删除失败'); setDeleteRoleTarget(null); }
  };

  // 移除用户角色（走 ReasonConfirmModal）
  const handleRemoveRoleUser = async (reason: string) => {
    const id = removeRoleUserTarget;
    if (!id) return;
    try {
      await fetch(`/api/permissions/roles/${selectedRoleId}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      loadRoleUsers(selectedRoleId!, memberPage, memberSearch);
      load();
      setRemoveRoleUserTarget(null);
    } catch { setRemoveRoleUserTarget(null); }
  };

  if (loading) return <AppLayout><div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left: Role List */}
        <RoleListPanel
          matrix={matrix}
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelect={(rid) => { setSelectedRoleId(rid); setActiveTab('perms'); }}
          onNew={openNewRole}
          onEdit={openEditRole}
          onDelete={setDeleteRoleTarget}
        />

        {/* Right: Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedRole && selectedRow ? (
            <>
              {/* Role header + Tabs */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ background: selectedRow.color || 'var(--neutral-400)' }} />
                  <h2 className="text-[var(--ink-700)] font-bold text-base">{selectedRole.name || selectedRole.code}</h2>
                  <span className="text-[var(--ink-300)] text-xs">{selectedRole.isSystem ? '系统角色' : '自定义角色'}</span>
                </div>
              </div>

              <div className="border-[var(--ink-100)] flex gap-3 mb-4 border-b">
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
                    <label className="text-[var(--ink-400)] flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={showEnabledOnly} onChange={e => setShowEnabledOnly(e.target.checked)}
                        className="accent-[var(--fox)] w-3 h-3" />
                      仅显示已启用
                    </label>
                    <div className="flex-1" />
                    <button onClick={resetToDefault} disabled={resetting || saving}
                      className="btn btn-ghost btn-xs" title="恢复到 permissions.constants.ts 默认值">
                      {resetting ? '重置中…' : '↩️ 重置默认'}
                    </button>
                    <button onClick={requestSavePerms} disabled={saving}
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
                          <div className="bg-[var(--paper-dark)] flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
                            onClick={() => {
                              const next = new Set(collapsedGroups);
                              isCollapsed ? next.delete(group.key) : next.add(group.key);
                              setCollapsedGroups(next);
                            }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                              <span className="text-sm font-medium">{group.icon} {group.key}</span>
                              <span className="text-[var(--ink-300)] text-[10px]">({grantedCount}/{group.children.length})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {grantedCount === group.children.length ? (
                                <button onClick={e => { e.stopPropagation(); toggleGroup(groupPerms, false); }}
                                  className="text-[10px] bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >取消全选</button>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); toggleGroup(groupPerms, true); }}
                                  className="text-[10px] bg-transparent border-none cursor-pointer text-[var(--fox)]" >全选</button>
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
                                        background: granted ? `color-mix(in srgb, ${selectedRow.color || 'var(--fox)'} 10%, transparent)` : 'var(--paper)',
                                        border: `1px solid ${granted ? (selectedRow.color || 'var(--fox)') : 'var(--ink-100)'}`,
                                        color: granted ? (selectedRow.color || 'var(--fox-dark)') : 'var(--ink-400)',
                                      }}>
                                      <input type="checkbox" checked={!!granted}
                                        onChange={() => togglePerm(child.permission)}
                                        className="cursor-pointer accent-[var(--fox)] w-3 h-3" />
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
                    <span className="text-[var(--ink-300)] text-xs">共 {roleUsersTotal} 人</span>
                    <div className="flex-1" />
                    <button onClick={() => { setShowAddMember(true); setAddMemberQ(''); setAddMemberResults([]); }}
                      className="btn btn-fox btn-xs">➕ 添加成员</button>
                  </div>
                  {memberLoading ? (
                    <div className="text-[var(--ink-300)] text-center py-8">加载中…</div>
                  ) : (
                    <div className="card overflow-hidden flex-1">
                      <div className="overflow-x-auto">
                      <table className="list-table">
                        <thead><tr><th>用户名</th><th>姓名</th><th>机构</th><th>分配时间</th><th>操作</th></tr></thead>
                        <tbody>
                          {roleUsers.map((u: any) => (
                            <tr key={u.id}>
                              <td className="text-[var(--ink-400)]">{u.username}</td>
                              <td className="font-medium">{u.displayName}</td>
                              <td className="text-[var(--ink-300)] text-xs">{u.orgName}</td>
                              <td className="text-[var(--ink-300)] text-xs">
                                {u.assignedAt ? new Date(u.assignedAt).toLocaleDateString('zh-CN') : '—'}
                              </td>
                              <td>
                                <button onClick={() => removeRoleUser(u.assignmentId)}
                                  className="btn btn-ghost btn-xs text-[var(--verm)]" >移除</button>
                              </td>
                            </tr>
                          ))}
                          {roleUsers.length === 0 && (
                            <tr><td colSpan={5} className="text-[var(--ink-300)] text-center py-8 text-xs">暂无成员</td></tr>
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><p className="text-5xl mb-4">🔐</p><p className="text-[var(--ink-300)]">请从左侧选择一个角色</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Role Create/Edit Modal */}
      {showRoleModal && (
        <RoleModal
          roles={roles}
          editRoleData={editRoleData}
          roleForm={roleForm}
          setRoleForm={setRoleForm}
          onClose={closeRoleModal}
          onSave={handleSaveRole}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          roleName={selectedRole?.name || selectedRole?.code || ''}
          query={addMemberQ}
          results={addMemberResults}
          loading={addMemberLoading}
          savingId={addMemberSavingId}
          onSearch={searchAddMember}
          onAdd={addMember}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* 删除角色弹窗 */}
      <ReasonConfirmModal
        open={deleteRoleTarget !== null}
        title="🗑 删除角色"
        required
        presetReasons={['角色不再使用', '角色创建错误', '角色合并']}
        confirmText="确认删除"
        onConfirm={deleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
      />

      {/* 移除用户角色确认 */}
      <ReasonConfirmModal
        open={removeRoleUserTarget !== null}
        title="👤 移除用户角色"
        message="确认移除该用户的此角色？"
        required
        presetReasons={['角色分配错误', '用户离职', '用户角色变更']}
        confirmText="确认移除"
        onConfirm={handleRemoveRoleUser}
        onCancel={() => setRemoveRoleUserTarget(null)}
      />

      {/* 关键角色权限修改确认 */}
      <ReasonConfirmModal
        open={savePermsReason !== null}
        title="⚠️ 关键角色权限修改"
        message="此角色拥有广泛权限，修改可能影响系统安全，请填写变更原因。"
        required
        confirmText="确认保存"
        onConfirm={(reason) => { setSavePermsReason(null); saveRolePerms(); }}
        onCancel={() => setSavePermsReason(null)}
      />
    </AppLayout>
  );
}
