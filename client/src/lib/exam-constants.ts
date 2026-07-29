/**
 * 考试模块共享常量 —— 状态标签、颜色、筛选选项
 * 所有考试相关页面统一引用此文件，避免多处重复定义
 */

/** 考试状态 → 中文标签 */
export const EXAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  IN_PROGRESS: '进行中',
  FINISHED: '已结束',
  CANCELLED: '已取消',
  // 线下笔试扩展状态
  AWAITING_GRADING: '待阅卷',
  GRADING_IN_PROGRESS: '录入中',
  SCORE_CONFIRMED: '已确认',
  SCORE_PUBLISHED: '成绩已发布',
};

/** 考试状态 → 主题色 */
export const EXAM_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#8b8174',
  PUBLISHED: '#00897b',
  IN_PROGRESS: '#e87a30',
  FINISHED: '#5a5348',
  CANCELLED: '#aaa',
  AWAITING_GRADING: '#d97706',
  GRADING_IN_PROGRESS: '#e87a30',
  SCORE_CONFIRMED: '#059669',
  SCORE_PUBLISHED: '#059669',
};

/** 考试模式筛选选项 */
export const EXAM_MODE_OPTIONS = [
  { value: '', label: '全部模式' },
  { value: 'ONLINE', label: '🖥️ 线上' },
  { value: 'OFFLINE', label: '✍️ 线下' },
];

/** 考试列表筛选选项 */
export const EXAM_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'FINISHED', label: '已结束' },
  { value: 'AWAITING_GRADING', label: '待阅卷' },
  { value: 'GRADING_IN_PROGRESS', label: '录入中' },
  { value: 'SCORE_CONFIRMED', label: '已确认' },
  { value: 'SCORE_PUBLISHED', label: '成绩已发布' },
  { value: 'CANCELLED', label: '已取消' },
];

/** 评分状态 → 中文标签 */
export const SCORING_STATUS_LABELS: Record<string, string> = {
  PENDING: '待评分',
  GRADING: '评分中',
  GRADED: '已评分',
  PUBLISHED: '已发布',
  CONFIRMED: '已确认',
  ADJUSTED: '已调整',
};

/** 获取状态标签（fallback 返回原始值） */
export function getExamStatusLabel(status: string): string {
  return EXAM_STATUS_LABELS[status] || status;
}

/** 获取状态颜色（fallback 返回灰色） */
export function getExamStatusColor(status: string): string {
  return EXAM_STATUS_COLORS[status] || '#8b8174';
}
