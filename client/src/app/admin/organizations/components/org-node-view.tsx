'use client';

import { OrgNode, LEVEL_LABELS, ORG_TYPE_LABELS, ORG_TYPE_COLORS, highlightText } from '../lib';

interface OrgNodeViewProps {
  node: OrgNode;
  depth: number;
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
  searchKeyword?: string;
}

/** 递归组织树节点 */
export default function OrgNodeView({ node, depth, selectedId, expanded, onSelect, onToggle, onCreate, onEdit, onDelete, dragId, setDragId, onDrop, searchKeyword }: OrgNodeViewProps) {
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
          {highlightText(node.name, searchKeyword || '')}
        </span>
        <span className="tag text-[9px] flex-shrink-0" style={{ background: 'var(--paper-dark)', color: ORG_TYPE_COLORS[node.orgType || ''] || 'var(--ink-400)' }}>
          {ORG_TYPE_LABELS[node.orgType || ''] || LEVEL_LABELS[node.level] || `L${node.level}`}
        </span>
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--ink-300)' }}>
          {node.childOrgCount > 0 && `🏢${node.childOrgCount}`}
          {node.userCount > 0 && ` 👥${node.userCount}`}
        </span>
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
              searchKeyword={searchKeyword}
            />
          ))}
        </div>
      )}
    </div>
  );
}
