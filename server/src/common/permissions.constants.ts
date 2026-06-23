// ═══════════════════════════════════════════
// 权限定义 — 角色→权限映射
// 新增API时，在这里加对应的权限点即可
// ═══════════════════════════════════════════

export type Permission = string;

// 角色枚举
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',   // 超级管理员（你）
  ORG_ADMIN = 'ORG_ADMIN',       // 机构管理员
  LECTURER = 'LECTURER',         // 讲师/出题人
  PROCTOR = 'PROCTOR',           // 监考员
  STUDENT = 'STUDENT',           // 学员
  AUDITOR = 'AUDITOR',           // 审计员（只读查看+报表导出）
}

// 权限点定义
export const Permissions = {
  // ── 系统管理 ──
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_TENANT: 'system:tenant',
  SYSTEM_DICTIONARY: 'system:dictionary',

  // ── 题库管理 ──
  QUESTION_CREATE: 'question:create',
  QUESTION_EDIT: 'question:edit',
  QUESTION_DELETE: 'question:delete',
  QUESTION_IMPORT: 'question:import',
  QUESTION_AUDIT: 'question:audit',

  // ── 组卷管理 ──
  PAPER_VIEW: 'paper:view',
  PAPER_GENERATE: 'paper:generate',
  PAPER_EDIT: 'paper:edit',
  PAPER_PUBLISH: 'paper:publish',
  PAPER_DOWNLOAD: 'paper:download',
  PAPER_ANSWER_SHEET: 'paper:answer_sheet',
  TEMPLATE_MANAGE: 'template:manage',

  // ── 考试管理 ──
  EXAM_CREATE: 'exam:create',
  EXAM_EDIT: 'exam:edit',
  EXAM_DELETE: 'exam:delete',
  EXAM_ASSIGN: 'exam:assign',
  EXAM_VIEW: 'exam:view',

  // ── 监考 ──
  PROCTOR_VIEW: 'proctor:view',
  PROCTOR_FORCE_SUBMIT: 'proctor:force_submit',
  PROCTOR_EXTEND_TIME: 'proctor:extend_time',

  // ── 判分 ──
  GRADING_AUTO: 'grading:auto',
  GRADING_MANUAL: 'grading:manual',
  GRADING_PUBLISH: 'grading:publish',

  // ── 学员管理 ──
  STUDENT_CREATE: 'student:create',
  STUDENT_IMPORT: 'student:import',
  STUDENT_EDIT: 'student:edit',
  STUDENT_GROUP: 'student:group',

  // ── 成绩 ──
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // ── 教材出题 ──
  MATERIAL_UPLOAD: 'material:upload',
  MATERIAL_REVIEW: 'material:review',
  MATERIAL_GENERATE: 'material:generate',

  // ── 消息 ──
  NOTICE_SEND: 'notice:send',
  NOTICE_MANAGE: 'notice:manage',
  NOTIFICATION_VIEW: 'notification:view',
  // ── 证书管理 ──
  CERT_ISSUE: 'cert:issue',
  CERT_REVOKE: 'cert:revoke',
  CERT_VIEW: 'cert:view',

  // ── Phase A: 培训班 ──
  PROGRAM_VIEW: 'program:view',
  PROGRAM_CREATE: 'program:create',
  PROGRAM_EDIT: 'program:edit',
  PROGRAM_DELETE: 'program:delete',
  PROGRAM_ENROLL: 'program:enroll',

  // ── Phase A: 招生机构 ──
  AGENCY_VIEW: 'agency:view',
  AGENCY_CREATE: 'agency:create',
  AGENCY_EDIT: 'agency:edit',
  AGENCY_DELETE: 'agency:delete',

  // ── Phase A: 证书审批 ──
  CERT_APPROVE: 'cert:approve',
  CERT_REJECT: 'cert:reject',
  CERT_APPLICATION_VIEW: 'cert:application_view',

  // ── Phase A: 成绩单 ──
  TRANSCRIPT_VIEW: 'transcript:view',

  // ── Phase C: 讲师管理 ──
  INSTRUCTOR_VIEW: 'instructor:view',
  INSTRUCTOR_CREATE: 'instructor:create',
  INSTRUCTOR_EDIT: 'instructor:edit',
  INSTRUCTOR_DELETE: 'instructor:delete',

  // ── Phase C: 课程管理 ──
  COURSE_VIEW: 'course:view',
  COURSE_CREATE: 'course:create',
  COURSE_EDIT: 'course:edit',
  COURSE_DELETE: 'course:delete',

  // ── Phase C: 排课管理 ──
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_EDIT: 'schedule:edit',
  SCHEDULE_DELETE: 'schedule:delete',

  // ── 机构管理（新） ──
  ORG_VIEW: 'org:view',
  ORG_CREATE: 'org:create',
  ORG_EDIT: 'org:edit',
  ORG_DELETE: 'org:delete',

  // ── 角色权限管理（新） ──
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_EDIT: 'role:edit',
  ROLE_DELETE: 'role:delete',

  // ── 学时管理（新） ──
  LEARNING_HOUR_VIEW: 'learningHour:view',
  LEARNING_HOUR_MANAGE: 'learningHour:manage',

  // ── 评价管理（新） ──
  EVALUATION_VIEW: 'evaluation:view',
  EVALUATION_MANAGE: 'evaluation:manage',

  // ── AI 配置（新） ──
  AI_CONFIG_VIEW: 'aiConfig:view',
  AI_CONFIG_MANAGE: 'aiConfig:manage',

  // ── 审计日志（新） ──
  AUDIT_LOG_VIEW: 'auditLog:view',
} as const;

// 角色→权限映射表
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // 所有权限
    ...Object.values(Permissions),
  ],

  [Role.ORG_ADMIN]: [
    Permissions.SYSTEM_CONFIG,
    Permissions.SYSTEM_LOGS,
    Permissions.SYSTEM_DICTIONARY,
    Permissions.QUESTION_CREATE,
    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_DELETE,
    Permissions.QUESTION_IMPORT,
    Permissions.QUESTION_AUDIT,
    Permissions.PAPER_VIEW,
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
    Permissions.EXAM_VIEW,
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
    Permissions.NOTIFICATION_VIEW,
    Permissions.CERT_ISSUE,
    Permissions.CERT_REVOKE,
    Permissions.CERT_VIEW,
    Permissions.PROGRAM_VIEW,
    Permissions.PROGRAM_CREATE,
    Permissions.PROGRAM_EDIT,
    Permissions.PROGRAM_DELETE,
    Permissions.PROGRAM_ENROLL,
    Permissions.AGENCY_VIEW,
    Permissions.AGENCY_CREATE,
    Permissions.AGENCY_EDIT,
    Permissions.AGENCY_DELETE,
    Permissions.CERT_APPROVE,
    Permissions.CERT_REJECT,
    Permissions.CERT_APPLICATION_VIEW,
    Permissions.TRANSCRIPT_VIEW,

    Permissions.INSTRUCTOR_VIEW,
    Permissions.INSTRUCTOR_CREATE,
    Permissions.INSTRUCTOR_EDIT,
    Permissions.INSTRUCTOR_DELETE,
    Permissions.COURSE_VIEW,
    Permissions.COURSE_CREATE,
    Permissions.COURSE_EDIT,
    Permissions.COURSE_DELETE,
    Permissions.SCHEDULE_VIEW,
    Permissions.SCHEDULE_CREATE,
    Permissions.SCHEDULE_EDIT,
    Permissions.SCHEDULE_DELETE,

    // 新权限
    Permissions.ORG_VIEW,
    Permissions.ORG_CREATE,
    Permissions.ORG_EDIT,
    Permissions.ORG_DELETE,
    Permissions.ROLE_VIEW,
    Permissions.ROLE_CREATE,
    Permissions.ROLE_EDIT,
    Permissions.ROLE_DELETE,
    Permissions.LEARNING_HOUR_VIEW,
    Permissions.LEARNING_HOUR_MANAGE,
    Permissions.EVALUATION_VIEW,
    Permissions.EVALUATION_MANAGE,
    Permissions.AI_CONFIG_VIEW,
    Permissions.AI_CONFIG_MANAGE,
    Permissions.AUDIT_LOG_VIEW,
  ],

  [Role.LECTURER]: [
    Permissions.EXAM_CREATE,
    Permissions.QUESTION_CREATE,
    Permissions.PROGRAM_VIEW,
    Permissions.TRANSCRIPT_VIEW,

    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_AUDIT,
    Permissions.PAPER_VIEW,
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
    Permissions.CERT_VIEW,
    Permissions.COURSE_VIEW,
    Permissions.NOTIFICATION_VIEW,
  ],

  [Role.PROCTOR]: [
    Permissions.EXAM_CREATE,
    Permissions.PROCTOR_VIEW,
    Permissions.PROCTOR_FORCE_SUBMIT,
    Permissions.PROCTOR_EXTEND_TIME,
  ],

  [Role.STUDENT]: [
    Permissions.COURSE_VIEW,           // 学习中心
    Permissions.EXAM_VIEW,             // 我的考试
    Permissions.LEARNING_HOUR_VIEW,    // 我的学时
    Permissions.CERT_VIEW,             // 我的证书
    Permissions.NOTIFICATION_VIEW,     // 消息通知
    Permissions.EVALUATION_VIEW,       // 评价
    Permissions.REPORT_VIEW,           // 成绩/报表
  ],

  [Role.AUDITOR]: [
    Permissions.PROGRAM_VIEW,
    Permissions.SCHEDULE_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.AUDIT_LOG_VIEW,
    Permissions.LEARNING_HOUR_VIEW,
    Permissions.EVALUATION_VIEW,
  ],
};
