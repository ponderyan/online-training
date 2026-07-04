'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

interface KnowledgePoint {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
  parentId: number | null;
  children: KnowledgePoint[];
  createdAt: string;
  updatedAt: string;
}

const emptyForm = () => ({
  name: '',
  code: '',
  description: '',
  sortOrder: 0,
});

export default function KnowledgePointsPage() {
  const [tree, setTree] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<KnowledgePoint | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  // modal state for creating a new node
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentId, setCreateParentId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.knowledgePoints.getTree();
      setTree(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // When a node is selected, populate the edit form
  useEffect(() => {
    if (selectedNode) {
      setEditForm({
        name: selectedNode.name,
        code: selectedNode.code || '',
        description: selectedNode.description || '',
        sortOrder: selectedNode.sortOrder,
      });
    }
  }, [selectedNode]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flattenTree = (nodes: KnowledgePoint[]): KnowledgePoint[] => {
    const result: KnowledgePoint[] = [];
    const walk = (list: KnowledgePoint[]) => {
      for (const n of list) {
        result.push(n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return result;
  };

  const handleSelect = (node: KnowledgePoint) => {
    setSelectedNode(node);
  };

  const handleSaveEdit = async () => {
    if (!selectedNode) return;
    if (!editForm.name) { alert('知识点名称不能为空'); return; }
    setSaving(true);
    try {
      await api.knowledgePoints.update(selectedNode.id, editForm);
      setSelectedNode(null);
      load();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (node: KnowledgePoint) => {
    if (!confirm(`确认删除知识点「${node.name}」？删除后不再显示，已有引用关系不受影响。`)) return;
    try {
      await api.knowledgePoints.remove(node.id);
      load();
      if (selectedNode?.id === node.id) setSelectedNode(null);
    } catch (e: any) {
      alert('删除失败：' + e.message);
    }
  };

  const openCreateRoot = () => {
    setCreateParentId(null);
    setCreateForm(emptyForm());
    setShowCreateModal(true);
  };

  const openCreateChild = (parentId: number) => {
    setCreateParentId(parentId);
    setCreateForm(emptyForm());
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.name) { alert('知识点名称不能为空'); return; }
    setCreating(true);
    try {
      const data: any = { ...createForm };
      if (createParentId !== null) data.parentId = createParentId;
      data.code = data.code || undefined;
      data.description = data.description || undefined;
      await api.knowledgePoints.create(data);
      setShowCreateModal(false);
      setCreateForm(emptyForm());
      // Expand parent to show new child
      if (createParentId !== null) {
        setExpandedIds(prev => new Set(prev).add(createParentId));
      }
      load();
    } catch (e: any) {
      alert('创建失败：' + e.message);
    }
    setCreating(false);
  };

  // Recursive tree node renderer
  const renderTreeNode = (node: KnowledgePoint, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group"
          style={{
            paddingLeft: `${12 + depth * 20}px`,
            background: isSelected ? 'var(--fox-glow)' : 'transparent',
            color: isSelected ? 'var(--fox-dark)' : 'var(--ink-600)',
          }}
          onClick={() => handleSelect(node)}
          onMouseEnter={e => {
            if (!isSelected) e.currentTarget.style.background = 'var(--ink-50)';
          }}
          onMouseLeave={e => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
        >
          {/* Expand/collapse toggle */}
          <button
            onClick={e => { e.stopPropagation(); toggleExpand(node.id); }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)', visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>

          {/* Icon */}
          <span className="flex-shrink-0 text-sm">📌</span>

          {/* Name */}
          <span className="flex-1 truncate font-medium">{node.name}</span>

          {/* Code badge */}
          {node.code && (
            <span className="tag text-[10px] px-1.5 py-0" style={{ background: 'var(--ink-100)', color: 'var(--ink-400)', borderRadius: '4px', fontSize: '10px' }}>
              {node.code}
            </span>
          )}

          {/* Actions - shown on hover */}
          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={e => { e.stopPropagation(); openCreateChild(node.id); }}
              className="btn btn-xs bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--cyan)', fontSize: '11px', padding: '0 4px' }}
              title="添加子节点"
            >+子</button>
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedNode(node);
                setEditForm({
                  name: node.name,
                  code: node.code || '',
                  description: node.description || '',
                  sortOrder: node.sortOrder,
                });
              }}
              className="btn btn-xs bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--gold)', fontSize: '11px', padding: '0 4px' }}
              title="编辑"
            >编辑</button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(node); }}
              className="btn btn-xs bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--ink-300)', fontSize: '11px', padding: '0 4px' }}
              title="删除"
              onMouseEnter={e => e.currentTarget.style.color = 'var(--verm)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-300)'}
            >删除</button>
          </div>
        </div>

        {/* Children (if expanded) */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const allNodes = flattenTree(tree);

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🧠 知识点管理</h1>
          <p className="page-subtitle">共 {allNodes.length} 个知识点，树形层级结构</p>
        </div>
        <button onClick={openCreateRoot} className="btn btn-fox btn-sm">➕ 新增根节点</button>
      </div>

      <div className="flex gap-6">
        {/* ── Left: Tree Panel ── */}
        <div className="flex-1 min-w-0">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 text-xs font-medium" style={{
              color: 'var(--ink-400)',
              borderBottom: '1px solid var(--ink-100)',
              background: 'var(--paper)',
            }}>
              知识层级
            </div>

            {loading ? (
              <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>
                小狐狸正在加载… 🦊
              </div>
            ) : tree.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">🧠</p>
                <p style={{ color: 'var(--ink-400)' }}>暂无知识点</p>
                <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>
                  点击「新增根节点」开始构建知识体系
                </p>
              </div>
            ) : (
              <div className="py-2">
                {tree.map(node => renderTreeNode(node, 0))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Detail/Edit Panel ── */}
        <div className="w-[380px] flex-shrink-0">
          <div className="card">
            <div className="px-4 py-3 text-xs font-medium" style={{
              color: 'var(--ink-400)',
              borderBottom: '1px solid var(--ink-100)',
              background: 'var(--paper)',
            }}>
              {selectedNode ? '知识点详情 / 编辑' : '选择知识点'}
            </div>

            {!selectedNode ? (
              <div className="p-8 text-center">
                <p className="text-4xl mb-3">👈</p>
                <p className="text-sm" style={{ color: 'var(--ink-300)' }}>
                  从左侧树中选择一个知识点查看详情
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Node info */}
                <div className="text-xs flex flex-wrap gap-2" style={{ color: 'var(--ink-400)' }}>
                  <span className="tag tag-ink">ID: {selectedNode.id}</span>
                  {selectedNode.code && <span className="tag tag-gold">{selectedNode.code}</span>}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                    名称 <span style={{ color: 'var(--verm)' }}>*</span>
                  </label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                    placeholder="知识点名称"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                    编码 <span style={{ color: 'var(--ink-300)' }}>（可选）</span>
                  </label>
                  <input
                    value={editForm.code}
                    onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                    className="input"
                    placeholder="如：KP-001"
                  />
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                    排序
                  </label>
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={e => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="input"
                    style={{ width: '120px' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                    描述 <span style={{ color: 'var(--ink-300)' }}>（可选）</span>
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="input textarea"
                    placeholder="知识点描述…"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="btn btn-fox btn-sm flex-1"
                  >
                    {saving ? '保存中…' : '💾 保存修改'}
                  </button>
                  <button
                    onClick={() => openCreateChild(selectedNode.id)}
                    className="btn btn-outline btn-sm"
                  >
                    ➕ 添加子节点
                  </button>
                </div>

                {/* Metadata */}
                <div className="pt-3 border-t text-xs space-y-1" style={{ borderColor: 'var(--ink-100)', color: 'var(--ink-400)' }}>
                  <div className="flex justify-between">
                    <span>创建时间</span>
                    <span>{selectedNode.createdAt ? new Date(selectedNode.createdAt).toLocaleString('zh-CN') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最后修改</span>
                    <span>{selectedNode.updatedAt ? new Date(selectedNode.updatedAt).toLocaleString('zh-CN') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>子节点</span>
                    <span>{selectedNode.children?.length || 0} 个</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create/Add Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowCreateModal(false); } }}>
          <div className="modal-card max-w-[460px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">
                {createParentId ? '添加子节点' : '新增根节点'}
              </h3>
              <button onClick={() => setShowCreateModal(false)}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              {createParentId && (
                <div className="text-xs p-2 rounded" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
                  父节点：{allNodes.find(n => n.id === createParentId)?.name || `#${createParentId}`}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                  名称 <span style={{ color: 'var(--verm)' }}>*</span>
                </label>
                <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  className="input" placeholder="知识点名称" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                  编码 <span style={{ color: 'var(--ink-300)' }}>（可选）</span>
                </label>
                <input value={createForm.code} onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                  className="input" placeholder="如：KP-001" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                  排序
                </label>
                <input type="number" value={createForm.sortOrder}
                  onChange={e => setCreateForm({ ...createForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="input" style={{ width: '120px' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
                  描述 <span style={{ color: 'var(--ink-300)' }}>（可选）</span>
                </label>
                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3} className="input textarea" placeholder="知识点描述…" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleCreate} disabled={creating} className="btn btn-fox btn-sm">
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
