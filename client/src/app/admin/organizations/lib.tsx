// ── 组织管理共享类型与工具 ──

export interface OrgNode {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  level: number;
  path: string | null;
  sortOrder: number;
  orgType?: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  userCount: number;
  programCount: number;
  childOrgCount: number;
  children: OrgNode[];
}

export interface DataScope {
  orgCount: number;
  descendantCount: number;
  examCount: number;
  studentCount: number;
  programCount: number;
  certCount: number;
  agencyCount: number;
}

export interface OrgUsers {
  total: number;
  groups: { roleId: number; roleName: string; roleCode: string; color: string | null; users: any[] }[];
}

export const LEVEL_LABELS: Record<number, string> = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4' };
export const ORG_TYPE_LABELS: Record<string, string> = { ASSOCIATION: '协会', BRANCH: '分会', DEPARTMENT: '部门' };
export const ORG_TYPE_COLORS: Record<string, string> = { ASSOCIATION: 'var(--purple)', BRANCH: 'var(--blue)', DEPARTMENT: 'var(--sage)' };

/** 在树中按 id 查找节点 */
export function findNode(nodes: OrgNode[], id: number | null): OrgNode | null {
  if (id === null) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

/** 搜索高亮 */
export function highlightText(text: string, keyword: string) {
  if (!keyword) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.substring(0, idx)}
      <span className="bg-[rgba(232,125,48,0.15)]" style={{  borderRadius: '2px', padding: '0 1px' }}>{text.substring(idx, idx + keyword.length)}</span>
      {text.substring(idx + keyword.length)}
    </>
  );
}
