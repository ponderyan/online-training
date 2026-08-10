export const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
  FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例', ESSAY: '论文',
};

export const DIFF_LABELS: Record<string, { label: string; cls: string }> = {
  EASY: { label: '易', cls: 'tag-cyan' },
  MEDIUM_EASY: { label: '较易', cls: 'tag-gold' },
  MEDIUM_HARD: { label: '较难', cls: 'tag-ink' },
  HARD: { label: '难', cls: 'tag-verm' },
};

// 可选的每页条数（用户也可手动输入任意值）
export const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100];

/** 展平知识点树为列表 */
export function flattenTree(nodes: any[], depth = 0): { id: number; name: string; code: string; depth: number }[] {
  const result: { id: number; name: string; code: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, code: n.code || '', depth });
    if (n.children?.length) result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}
