'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

// ── 组织树节点（与后端 OrgNode 对齐） ──
interface OrgNode {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  level: number;
  path: string | null;
  sortOrder: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  userCount: number;
  programCount: number;
  childOrgCount: number;
  children: OrgNode[];
}

interface DataScope {
  orgCount: number;
  descendantCount: number;
  examCount: number;
  studentCount: number;
  programCount: number;
  certCount: number;
}

interface OrgUsers {
  total: number;
  groups: { roleId: number; roleName: string; roleCode: string; color: string | null; users: any[] }[];
}

const LEVEL_LABELS: Record<number, string> = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4' };

export default function OrganizationsPage() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  // 详情面板数据
  const [dataScope, setDataScope] = useState<DataScope | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUsers | null>(null);

  // 弹窗
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgNode | null>(null);
  const [modalParent, setModalParent] = useState<OrgNode | null>(null); // 新建子组织时的父节点
  const [orgForm, setOrgForm] = useState({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '' });
  const [saving, setSaving] = useState(false);

  // 拖拽
  const [dragId, setDragId] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await api.organizations.getTree();
      setTree(data || []);
      // 默认展开根节点
      if (data.length > 0) {
        setExpanded(prev => {
          const next = new Set(prev);
          data.forEach(d => next.add(d.id));
          return next;
        });
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // 选中节点 → 加载详情
  useEffect(() => {
    if (!selectedId) { setDataScope(null); setOrgUsers(null); return; }
    api.organizations.getDataScope(selectedId).then(setDataScope).catch(() => setDataScope(null));
    api.organizations.getOrgUsers(selectedId).then(setOrgUsers).catch(() => setOrgUsers(null));
  }, [selectedId]);

  const selectedNode = useMemo(() => findNode(tree, selectedId), [tree, selectedId]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 搜索过滤：保留匹配节点及其祖先链
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.trim().toLowerCase();
    const filterNode = (node: OrgNode): OrgNode | null => {
      const selfMatch = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
      const kids = node.children.map(filterNode).filter(Boolean) as OrgNode[];
      if (selfMatch || kids.length > 0) {
        return { ...node, children: kids };
      }
      return null;
    };
    return tree.map(filterNode).filter(Boolean) as OrgNode[];
  }, [tree, search]);

  // ── 新建/编辑组织 ──
  const openCreate = (parent: OrgNode | null) => {
    setEditOrg(null);
    setModalParent(parent);
    setOrgForm({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '' });
    setShowOrgModal(true);
  };
  const openEdit = (org: OrgNode) => {
    setEditOrg(org);
    setModalParent(null);
    setOrgForm({
      name: org.name, code: org.code,
      contactName: org.contactName || '', contactPhone: org.contactPhone || '', contactEmail: org.contactEmail || '',
    });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    if (!orgForm.name || (!editOrg && !orgForm.code)) { alert('名称和编码不能为空'); return; }
    setSaving(true);
    try {
      if (editOrg) {
        await api.organizations.update(editOrg.id, {
          name: orgForm.name, contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail,
        });
      } else {
        await api.organizations.create({
          name: orgForm.name, code: orgForm.code, parentId: modalParent?.id || null,
          contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail,
        });
      }
      setShowOrgModal(false); setEditOrg(null); setModalParent(null);
      await load();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (org: OrgNode) => {
    if (!confirm(`确认删除「${org.name}」？`)) return;
    try {
      await api.organizations.remove(org.id);
      if (selectedId === org.id) setSelectedId(null);
      await load();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  // ── 拖拽移动 ──
  const onDrop = async (target: OrgNode | null) => {
    if (dragId === null) return;
    const targetId = target?.id ?? null;
    if (dragId === targetId) { setDragId(null); return; }
    const moving = findNode(tree, dragId);
    if (!moving) { setDragId(null); return; }
    // 不能移到自己的子孙下
    if (target && moving.path && target.path && target.path.startsWith(moving.path)) {
      alert('不能将组织移动到其下属组织下');
      setDragId(null);
      return;
    }
    const targetLabel = target ? `「${target.name}」下` : '根层级';
    if (!confirm(`将「${moving.name}」移动到${targetLabel}？`)) { setDragId(null); return; }
    try {
      await api.organizations.move(dragId, targetId);
      await load();
    } catch (e: any) {
      alert(e.message || '移动失败');
    }
    setDragId(null);
  };

  if (loading) {
    return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载组织树… 🦊</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🏢 组织管理</h1>
          <p className="page-subtitle">多层级组织架构 · 拖拽可调整层级</p>
        </div>
        <button onClick={() => openCreate(null)} className="btn btn-fox btn-sm">➕ 新建根组织</button>
      </div>

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* 左：组织树 */}
        <div className="w-[360px] flex-shrink-0 flex flex-col">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 搜索组织名称/编码…" className="input text-xs mb-3" style={{ height: 32 }} />
          <div className="card flex-1 overflow-y-auto p-2"
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); onDrop(null); }}>
            {filteredTree.length === 0 ? (
              <div className="text-center py-12 text-xs" style={{ color: 'var(--ink-300)' }}>
                {search ? '未找到匹配组织' : '暂无组织，点击右上角新建'}
              </div>
            ) : (
              filteredTree.map(node => (
                <OrgNodeView key={node.id} node={node} depth={0}
                  selectedId={selectedId} expanded={expanded}
                  onSelect={setSelectedId} onToggle={toggleExpand}
                  onCreate={openCreate} onEdit={openEdit} onDelete={handleDelete}
                  dragId={dragId} setDragId={setDragId} onDrop={onDrop}
                />
              ))
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-5">
              {/* 组织信息 */}
              <div className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base" style={{ color: 'var(--ink-700)' }}>{selectedNode.name}</h2>
                      <span className="tag tag-ink text-[10px]">{selectedNode.code}</span>
                      <span className="tag text-[10px]" style={{ background: 'var(--fox-pale)', color: 'var(--fox-dark)' }}>
                        {LEVEL_LABELS[selectedNode.level] || `Level ${selectedNode.level}`}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
                      <span>👥 {selectedNode.userCount} 用户</span>
                      <span>📋 {selectedNode.programCount} 培训班</span>
                      <span>🏢 {selectedNode.childOrgCount} 下级组织</span>
                      {selectedNode.contactName && <span>📞 {selectedNode.contactName}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openCreate(selectedNode)} className="btn btn-ghost btn-xs">+ 子组织</button>
                    <button onClick={() => openEdit(selectedNode)} className="btn btn-ghost btn-xs">编辑</button>
                    <button onClick={() => handleDelete(selectedNode)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>删除</button>
                  </div>
                </div>
              </div>

              {/* 数据范围预览 */}
              <div className="card p-5">
                <h3 className="section-title">📊 数据范围预览</h3>
                {dataScope ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <ScopeStat label="下属组织" value={dataScope.descendantCount} suffix="个" hint={`含自身共 ${dataScope.orgCount} 个`} />
                    <ScopeStat label="可见考试" value={dataScope.examCount} suffix="场" />
                    <ScopeStat label="可见学员" value={dataScope.studentCount} suffix="人" />
                    <ScopeStat label="可见培训班" value={dataScope.programCount} suffix="个" />
                    <ScopeStat label="可见证书" value={dataScope.certCount} suffix="张" />
                  </div>
                ) : (
                  <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                )}
              </div>

              {/* 用户列表（按角色分组） */}
              <div className="card p-5">
                <h3 className="section-title">👥 该组织用户（{orgUsers?.total ?? 0} 人）</h3>
                {orgUsers ? (
                  orgUsers.groups.length === 0 ? (
                    <div className="text-xs py-6 text-center" style={{ color: 'var(--ink-300)' }}>暂无用户</div>
                  ) : (
                    <div className="space-y-3">
                      {orgUsers.groups.map(g => (
                        <div key={g.roleCode} className="rounded-lg p-3" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color || '#8b8174' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{g.roleName}</span>
                            <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>({g.users.length} 人)</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {g.users.map(u => (
                              <span key={u.id} className="text-xs px-2 py-1 rounded"
                                style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)' }}>
                                {u.displayName} <span style={{ color: 'var(--ink-300)' }}>({u.username})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-5xl mb-4">🏢</p>
                <p style={{ color: 'var(--ink-300)' }}>从左侧选择一个组织查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建/编辑组织 Modal */}
      {showOrgModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowOrgModal(false); setEditOrg(null); setModalParent(null); } }}>
          <div className="modal-card max-w-[460px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">
                {editOrg ? '编辑组织' : '新建组织'}
                {modalParent && <span className="text-xs font-normal ml-2" style={{ color: 'var(--ink-400)' }}>（父级：{modalParent.name}）</span>}
              </h3>
              <button onClick={() => { setShowOrgModal(false); setEditOrg(null); setModalParent(null); }}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>组织名称 *</label>
                  <input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} className="input" placeholder="如：符合性评估部" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>组织编码 *</label>
                  <input value={orgForm.code} onChange={e => setOrgForm({ ...orgForm, code: e.target.value })} className="input" placeholder="如：CEC" disabled={!!editOrg} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系人</label>
                <input value={orgForm.contactName} onChange={e => setOrgForm({ ...orgForm, contactName: e.target.value })} className="input" placeholder="联系人姓名" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系电话</label>
                  <input value={orgForm.contactPhone} onChange={e => setOrgForm({ ...orgForm, contactPhone: e.target.value })} className="input" placeholder="手机号" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系邮箱</label>
                  <input value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value })} className="input" placeholder="邮箱" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowOrgModal(false); setEditOrg(null); setModalParent(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSaveOrg} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── 递归树节点组件 ──
function OrgNodeView({ node, depth, selectedId, expanded, onSelect, onToggle, onCreate, onEdit, onDelete, dragId, setDragId, onDrop }: {
  node: OrgNode; depth: number;
  selectedId: number | null;
  expanded: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onCreate: (parent: OrgNode | null) => void;
  onEdit: (org: OrgNode) => void;
  onDelete: (org: OrgNode) => void;
  dragId: number | null;
  setDragId: (id: number | null) => void;
  onDrop: (target: OrgNode | null) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isDragging = dragId === node.id;

  return (
    <div>
      <div
        draggable
        onDragStart={() => setDragId(node.id)}
        onDragEnd={() => setDragId(null)}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(node); }}
        onClick={() => onSelect(node.id)}
        className="flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all group"
        style={{
          marginLeft: depth * 16,
          background: isSelected ? 'var(--fox-pale)' : 'transparent',
          border: isSelected ? '1px solid var(--fox)' : '1px solid transparent',
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <button onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          className="w-4 h-4 flex items-center justify-center text-[10px] bg-transparent border-none cursor-pointer flex-shrink-0"
          style={{ color: 'var(--ink-400)', visibility: hasChildren ? 'visible' : 'hidden' }}>
          {isExpanded ? '▼' : '▶'}
        </button>
        <span className="text-sm font-medium truncate flex-1" style={{ color: isSelected ? 'var(--fox-dark)' : 'var(--ink-600)' }}>
          {node.name}
        </span>
        <span className="tag text-[9px] flex-shrink-0" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
          {LEVEL_LABELS[node.level] || `L${node.level}`}
        </span>
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--ink-300)' }}>
          {node.childOrgCount > 0 && `🏢${node.childOrgCount}`}
          {node.userCount > 0 && ` 👥${node.userCount}`}
        </span>
        {/* 悬停操作 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onCreate(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--ink-300)' }} title="新建子组织">＋</button>
          <button onClick={e => { e.stopPropagation(); onEdit(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--ink-300)' }} title="编辑">✏️</button>
          <button onClick={e => { e.stopPropagation(); onDelete(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--verm)' }} title="删除">🗑️</button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <OrgNodeView key={child.id} node={child} depth={depth + 1}
              selectedId={selectedId} expanded={expanded}
              onSelect={onSelect} onToggle={onToggle}
              onCreate={onCreate} onEdit={onEdit} onDelete={onDelete}
              dragId={dragId} setDragId={setDragId} onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 数据范围统计小卡片 ──
function ScopeStat({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--ink-400)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: 'var(--ink-700)' }}>
        {value}<span className="text-xs font-normal ml-0.5" style={{ color: 'var(--ink-300)' }}>{suffix}</span>
      </div>
      {hint && <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{hint}</div>}
    </div>
  );
}

// ── 工具：在树中按 id 查找节点 ──
function findNode(nodes: OrgNode[], id: number | null): OrgNode | null {
  if (id === null) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}
