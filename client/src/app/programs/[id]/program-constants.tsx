export const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
export const STATUS_COLORS: Record<string, string> = {
  PREPARING: 'var(--ink-300)', ENROLLING: 'var(--info)', IN_PROGRESS: 'var(--fox)',
  REVIEWING: 'var(--fox)', CERTIFYING: 'var(--purple)', COMPLETED: 'var(--sage)', CANCELLED: 'var(--neutral-300)',
};
export const NEXT_STATUS: Record<string, { label: string; target: string; confirm?: string }[]> = {
  PREPARING: [{ label: '开放报名', target: 'ENROLLING', confirm: '确认开放报名？报名开始后学员可自主报名。' }],
  ENROLLING: [{ label: '开始培训', target: 'IN_PROGRESS', confirm: '确认开始培训？开课后将锁定学员名单。' }],
  IN_PROGRESS: [{ label: '提交审核', target: 'REVIEWING', confirm: '确认提交审核？提交后等待协会审核。' }],
  REVIEWING: [
    { label: '批准发证', target: 'CERTIFYING', confirm: '确认批准发证？将触发证书批量生成。' },
    { label: '退回筹备', target: 'PREPARING', confirm: '退回到筹备阶段？退回后可修改信息重新提交。' },
  ],
  CERTIFYING: [{ label: '完成结业', target: 'COMPLETED', confirm: '确认完成结业？此操作不可逆。' }],
};

export const LEVEL_NAMES: Record<string, string> = {
  JUNIOR: '初级', MIDDLE: '中级', SENIOR: '高级', EXPERT: '专家',
};
