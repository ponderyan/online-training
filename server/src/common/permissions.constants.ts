// ═══════════════════════════════════════════
// 权限定义 — 角色→权限映射
// 新增API时，在这里加对应的权限点即可
// ═══════════════════════════════════════════

export type Permission = string;

// 角色枚举
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',   // 超级管理员（你）
  ORG_ADMIN = 'ORG_ADMIN',       // 机构管理员（如刘志宏公司）
  LECTURER = 'LECTURER',         // 讲师/出题人
  PROCTOR = 'PROCTOR',           // 监考员
  STUDENT = 'STUDENT',           // 学员
}

// 权限点定义
export const Permissions = {
  // ── 系统管理 ──
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_LOGS: 'system.logs',
  SYSTEM_TENANT: 'system.tenant',
  SYSTEM_DICTIONARY: 'system.dictionary',

  // ── 题库管理 ──
  QUESTION_CREATE: 'question.create',
  QUESTION_EDIT: 'question.edit',
  QUESTION_DELETE: 'question.delete',
  QUESTION_IMPORT: 'question.import',
  QUESTION_AUDIT: 'question.audit',

  // ── 组卷管理 ──
  PAPER_GENERATE: 'paper.generate',
  PAPER_EDIT: 'paper.edit',
  PAPER_PUBLISH: 'paper.publish',
  PAPER_DOWNLOAD: 'paper.download',
  PAPER_ANSWER_SHEET: 'paper.answerSheet',
  TEMPLATE_MANAGE: 'template.manage',

  // ── 考试管理 ──
  EXAM_CREATE: 'exam.create',
  EXAM_EDIT: 'exam.edit',
  EXAM_DELETE: 'exam.delete',
  EXAM_ASSIGN: 'exam.assign',

  // ── 监考 ──
  PROCTOR_VIEW: 'proctor.view',
  PROCTOR_FORCE_SUBMIT: 'proctor.forceSubmit',
  PROCTOR_EXTEND_TIME: 'proctor.extendTime',

  // ── 判分 ──
  GRADING_AUTO: 'grading.auto',
  GRADING_MANUAL: 'grading.manual',
  GRADING_PUBLISH: 'grading.publish',

  // ── 学员管理 ──
  STUDENT_CREATE: 'student.create',
  STUDENT_IMPORT: 'student.import',
  STUDENT_EDIT: 'student.edit',
  STUDENT_GROUP: 'student.group',

  // ── 成绩 ──
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',

  // ── 教材出题 ──
  MATERIAL_UPLOAD: 'material.upload',
  MATERIAL_REVIEW: 'material.review',
  MATERIAL_GENERATE: 'material.generate',

  // ── 消息 ──
  NOTICE_SEND: 'notice.send',
  NOTICE_MANAGE: 'notice.manage',
} as const;

// 角色→权限映射表
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // 所有权限
    ...Object.values(Permissions),
  ],

  [Role.ORG_ADMIN]: [
    Permissions.SYSTEM_DICTIONARY,
    Permissions.QUESTION_CREATE,
    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_DELETE,
    Permissions.QUESTION_IMPORT,
    Permissions.QUESTION_AUDIT,
    Permissions.PAPER_GENERATE,
    Permissions.PAPER_EDIT,
    Permissions.PAPER_PUBLISH,
    Permissions.PAPER_DOWNLOAD,
    Permissions.PAPER_ANSWER_SHEET,
    Permissions.TEMPLATE_MANAGE,
    Permissions.EXAM_CREATE,
    Permissions.EXAM_EDIT,
    Permissions.EXAM_DELETE,
    Permissions.EXAM_ASSIGN,
    Permissions.PROCTOR_VIEW,
    Permissions.PROCTOR_FORCE_SUBMIT,
    Permissions.PROCTOR_EXTEND_TIME,
    Permissions.GRADING_AUTO,
    Permissions.GRADING_MANUAL,
    Permissions.GRADING_PUBLISH,
    Permissions.STUDENT_CREATE,
    Permissions.STUDENT_IMPORT,
    Permissions.STUDENT_EDIT,
    Permissions.STUDENT_GROUP,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.MATERIAL_UPLOAD,
    Permissions.MATERIAL_REVIEW,
    Permissions.MATERIAL_GENERATE,
    Permissions.NOTICE_SEND,
    Permissions.NOTICE_MANAGE,
  ],

  [Role.LECTURER]: [
    Permissions.QUESTION_CREATE,
    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_AUDIT,
    Permissions.PAPER_GENERATE,
    Permissions.PAPER_EDIT,
    Permissions.PAPER_DOWNLOAD,
    Permissions.PAPER_ANSWER_SHEET,
    Permissions.TEMPLATE_MANAGE,
    Permissions.REPORT_VIEW,
    Permissions.GRADING_MANUAL,
    Permissions.PROCTOR_VIEW,
    Permissions.MATERIAL_UPLOAD,
    Permissions.MATERIAL_REVIEW,
    Permissions.MATERIAL_GENERATE,
  ],

  [Role.PROCTOR]: [
    Permissions.PROCTOR_VIEW,
    Permissions.PROCTOR_FORCE_SUBMIT,
    Permissions.PROCTOR_EXTEND_TIME,
  ],

  [Role.STUDENT]: [
    Permissions.REPORT_VIEW,
  ],
};
