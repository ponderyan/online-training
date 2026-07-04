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
  AUDITOR = 'AUDITOR',
  AGENCY_ADMIN = 'AGENCY_ADMIN',   // 招生机构管理员
  EXAM_OFFICER = 'EXAM_OFFICER',   // 考务员（负责组卷/考试/判分/成绩发布）           // 审计员（只读查看+报表导出）
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
  EXAM_RESULT_VIEW: 'exam:result:view',
  APPEAL_MANAGE: 'appeal:manage',

  // ── 监考 ──
  PROCTOR_VIEW: 'proctor:view',
  PROCTOR_FORCE_SUBMIT: 'proctor:force_submit',
  PROCTOR_EXTEND_TIME: 'proctor:extend_time',

  // ── 判分 ──
  GRADING_AUTO: 'grading:auto',
  GRADING_MANUAL: 'grading:manual',
  GRADING_PUBLISH: 'grading:publish',

  // ── 学员管理 ──
  STUDENT_VIEW: 'student:view',
  STUDENT_CREATE: 'student:create',
  STUDENT_IMPORT: 'student:import',
  STUDENT_EDIT: 'student:edit',
  STUDENT_GROUP: 'student:group',
  STUDENT_RESET_PWD: 'student:reset_pwd',

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
  AGENCY_VIEW_STUDENTS: 'agency:view:students',
  AGENCY_MANAGE_STUDENTS: 'agency:manage:students',
  AGENCY_MANAGE_CERTIFICATES: 'agency:manage:certificates',
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
  LEARNING_HOUR_APPROVE: 'learningHour:approve',

  // ── 评价管理（新） ──
  EVALUATION_VIEW: 'evaluation:view',
  EVALUATION_MANAGE: 'evaluation:manage',

  // ── AI 配置（新） ──
  AI_CONFIG_VIEW: 'aiConfig:view',
  AI_CONFIG_MANAGE: 'aiConfig:manage',

  // ── 审计日志（新） ──
  AUDIT_LOG_VIEW: 'auditLog:view',

  // ── 题库策略配置（新） ──
  BANK_POLICY_VIEW: 'bankPolicy:view',
  BANK_POLICY_MANAGE: 'bankPolicy:manage',

  // ── 系统配置（新） ──
  SYSTEM_CONFIG_VIEW: 'systemConfig:view',
  SYSTEM_CONFIG_MANAGE: 'systemConfig:manage',
} as const;

// 角色→权限映射表
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // 所有权限
    ...Object.values(Permissions),
  ],

  [Role.ORG_ADMIN]: [
    Permissions.SYSTEM_CONFIG,
    Permissions.SYSTEM_CONFIG_VIEW,
    Permissions.SYSTEM_CONFIG_MANAGE,
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
    Permissions.ROLE_VIEW,
    Permissions.ROLE_CREATE,
    Permissions.ROLE_EDIT,
    Permissions.ROLE_DELETE,
    Permissions.LEARNING_HOUR_VIEW,
    Permissions.LEARNING_HOUR_MANAGE,
    Permissions.LEARNING_HOUR_APPROVE,
    Permissions.EVALUATION_VIEW,
    Permissions.EVALUATION_MANAGE,
    Permissions.AI_CONFIG_VIEW,
    Permissions.AI_CONFIG_MANAGE,
    Permissions.AUDIT_LOG_VIEW,
  ],

  [Role.LECTURER]: [
    Permissions.QUESTION_CREATE,
    Permissions.PROGRAM_VIEW,
    Permissions.TRANSCRIPT_VIEW,

    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_AUDIT,
    Permissions.PAPER_VIEW,
    Permissions.PAPER_DOWNLOAD,
    Permissions.PAPER_ANSWER_SHEET,
    Permissions.REPORT_VIEW,
    Permissions.GRADING_MANUAL,
    Permissions.PROCTOR_VIEW,
    Permissions.EXAM_RESULT_VIEW,
    Permissions.MATERIAL_UPLOAD,
    Permissions.MATERIAL_REVIEW,
    Permissions.MATERIAL_GENERATE,
    Permissions.CERT_VIEW,
    Permissions.COURSE_VIEW,
    Permissions.NOTIFICATION_VIEW,
  ],

  [Role.PROCTOR]: [
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

  [Role.EXAM_OFFICER]: [
    // ── 题库管理 ──
    Permissions.QUESTION_CREATE,
    Permissions.QUESTION_EDIT,
    Permissions.QUESTION_DELETE,
    Permissions.QUESTION_IMPORT,
    Permissions.QUESTION_AUDIT,

    // ── 组卷 ──
    Permissions.PAPER_VIEW,
    Permissions.PAPER_GENERATE,
    Permissions.PAPER_EDIT,
    Permissions.PAPER_PUBLISH,
    Permissions.PAPER_DOWNLOAD,
    Permissions.PAPER_ANSWER_SHEET,
    Permissions.TEMPLATE_MANAGE,

    // ── 考试管理 ──
    Permissions.EXAM_VIEW,
    Permissions.EXAM_CREATE,
    Permissions.EXAM_EDIT,
    Permissions.EXAM_DELETE,
    Permissions.EXAM_ASSIGN,
    Permissions.EXAM_RESULT_VIEW,

    // ── 阅卷 ──
    Permissions.GRADING_AUTO,
    Permissions.GRADING_MANUAL,
    Permissions.GRADING_PUBLISH,

    // ── 监考 ──
    Permissions.PROCTOR_VIEW,
    Permissions.PROCTOR_FORCE_SUBMIT,
    Permissions.PROCTOR_EXTEND_TIME,

    // ── 成绩与申诉 ──
    Permissions.APPEAL_MANAGE,

    // ── 证书 ──
    Permissions.CERT_VIEW,
    Permissions.CERT_ISSUE,
    Permissions.CERT_REVOKE,
    Permissions.CERT_APPLICATION_VIEW,

    // ── 教材 ──
    Permissions.MATERIAL_UPLOAD,
    Permissions.MATERIAL_REVIEW,
    Permissions.MATERIAL_GENERATE,

    // ── 查看类 ──
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.TRANSCRIPT_VIEW,
    Permissions.NOTIFICATION_VIEW,
  ],

  [Role.AGENCY_ADMIN]: [
    Permissions.AGENCY_VIEW,
    Permissions.AGENCY_VIEW_STUDENTS,
    Permissions.AGENCY_MANAGE_STUDENTS,
    Permissions.AGENCY_MANAGE_CERTIFICATES,
    Permissions.LEARNING_HOUR_MANAGE,
    Permissions.NOTIFICATION_VIEW,
  ],

  [Role.AUDITOR]: [
    Permissions.EXAM_RESULT_VIEW,
    Permissions.CERT_VIEW,
    Permissions.CERT_APPLICATION_VIEW,
    Permissions.TRANSCRIPT_VIEW,
    Permissions.PROGRAM_VIEW,
    Permissions.SCHEDULE_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.AUDIT_LOG_VIEW,
    Permissions.LEARNING_HOUR_VIEW,
    Permissions.EVALUATION_VIEW,
  ],
};

// 权限分类定义（供前端权限树 UI 使用）
export interface PermissionCategory {
  name: string;
  key: string;
  permissions: { key: string; label: string; description?: string }[];
}

export const PERM_CATEGORIES: PermissionCategory[] = [
  {
    name: '培训管理',
    key: 'training',
    permissions: [
      { key: Permissions.PROGRAM_VIEW, label: '查看培训班' },
      { key: Permissions.PROGRAM_CREATE, label: '创建培训班' },
      { key: Permissions.PROGRAM_EDIT, label: '编辑培训班' },
      { key: Permissions.PROGRAM_DELETE, label: '删除培训班' },
      { key: Permissions.PROGRAM_ENROLL, label: '学员报名' },
      { key: Permissions.COURSE_VIEW, label: '查看课程' },
      { key: Permissions.COURSE_CREATE, label: '创建课程' },
      { key: Permissions.COURSE_EDIT, label: '编辑课程' },
      { key: Permissions.COURSE_DELETE, label: '删除课程' },
      { key: Permissions.SCHEDULE_VIEW, label: '查看排课' },
      { key: Permissions.SCHEDULE_CREATE, label: '创建排课' },
      { key: Permissions.SCHEDULE_EDIT, label: '编辑排课' },
      { key: Permissions.SCHEDULE_DELETE, label: '删除排课' },
      { key: Permissions.INSTRUCTOR_VIEW, label: '查看讲师' },
      { key: Permissions.INSTRUCTOR_CREATE, label: '创建讲师' },
      { key: Permissions.INSTRUCTOR_EDIT, label: '编辑讲师' },
      { key: Permissions.INSTRUCTOR_DELETE, label: '删除讲师' },
      { key: Permissions.AGENCY_VIEW, label: '查看招生机构' },
      { key: Permissions.AGENCY_CREATE, label: '创建招生机构' },
      { key: Permissions.AGENCY_EDIT, label: '编辑招生机构' },
      { key: Permissions.AGENCY_DELETE, label: '删除招生机构' },
    ],
  },
  {
    name: '学员管理',
    key: 'student',
    permissions: [
      { key: Permissions.STUDENT_VIEW, label: '查看学员列表' },
      { key: Permissions.STUDENT_CREATE, label: '创建学员' },
      { key: Permissions.STUDENT_IMPORT, label: '批量导入学员' },
      { key: Permissions.STUDENT_EDIT, label: '编辑学员' },
      { key: Permissions.STUDENT_GROUP, label: '管理学员分组' },
      { key: Permissions.STUDENT_RESET_PWD, label: '重置学员密码' },
    ],
  },
  {
    name: '考务管理',
    key: 'exam',
    permissions: [
      { key: Permissions.QUESTION_CREATE, label: '创建题目' },
      { key: Permissions.QUESTION_EDIT, label: '编辑题目' },
      { key: Permissions.QUESTION_DELETE, label: '删除题目' },
      { key: Permissions.QUESTION_IMPORT, label: '导入题目' },
      { key: Permissions.QUESTION_AUDIT, label: '审核题目' },
      { key: Permissions.PAPER_VIEW, label: '查看试卷' },
      { key: Permissions.PAPER_GENERATE, label: '智能组卷' },
      { key: Permissions.PAPER_EDIT, label: '编辑试卷' },
      { key: Permissions.PAPER_PUBLISH, label: '发布试卷' },
      { key: Permissions.PAPER_DOWNLOAD, label: '下载试卷' },
      { key: Permissions.PAPER_ANSWER_SHEET, label: '查看答题卡' },
      { key: Permissions.TEMPLATE_MANAGE, label: '管理组卷模板' },
      { key: Permissions.EXAM_VIEW, label: '查看考试' },
      { key: Permissions.EXAM_CREATE, label: '创建考试' },
      { key: Permissions.EXAM_EDIT, label: '编辑考试' },
      { key: Permissions.EXAM_DELETE, label: '删除考试' },
      { key: Permissions.EXAM_ASSIGN, label: '分配考试' },
      { key: Permissions.EXAM_RESULT_VIEW, label: '查看成绩' },
      { key: Permissions.APPEAL_MANAGE, label: '管理申诉' },
      { key: Permissions.PROCTOR_VIEW, label: '监考监控' },
      { key: Permissions.PROCTOR_FORCE_SUBMIT, label: '强制交卷' },
      { key: Permissions.PROCTOR_EXTEND_TIME, label: '延长考试时间' },
      { key: Permissions.GRADING_AUTO, label: '自动判分' },
      { key: Permissions.GRADING_MANUAL, label: '手动判分' },
      { key: Permissions.GRADING_PUBLISH, label: '发布成绩' },
      { key: Permissions.MATERIAL_UPLOAD, label: '上传教材' },
      { key: Permissions.MATERIAL_REVIEW, label: '审核教材' },
      { key: Permissions.MATERIAL_GENERATE, label: '教材出题' },
    ],
  },
  {
    name: '认证管理',
    key: 'cert',
    permissions: [
      { key: Permissions.CERT_VIEW, label: '查看证书' },
      { key: Permissions.CERT_ISSUE, label: '发放证书' },
      { key: Permissions.CERT_REVOKE, label: '吊销证书' },
      { key: Permissions.CERT_APPROVE, label: '审批证书申请' },
      { key: Permissions.CERT_REJECT, label: '驳回证书申请' },
      { key: Permissions.CERT_APPLICATION_VIEW, label: '查看证书申请' },
      { key: Permissions.EVALUATION_VIEW, label: '查看评价' },
      { key: Permissions.EVALUATION_MANAGE, label: '管理评价' },
    ],
  },
  {
    name: '报表与审计',
    key: 'audit',
    permissions: [
      { key: Permissions.REPORT_VIEW, label: '查看报表' },
      { key: Permissions.REPORT_EXPORT, label: '导出报表' },
      { key: Permissions.TRANSCRIPT_VIEW, label: '查看成绩单' },
      { key: Permissions.LEARNING_HOUR_VIEW, label: '查看学时' },
      { key: Permissions.LEARNING_HOUR_MANAGE, label: '管理学时' },
      { key: Permissions.LEARNING_HOUR_APPROVE, label: '审核学时' },
      { key: Permissions.LEARNING_HOUR_MANAGE, label: '管理学时' },
      { key: Permissions.AUDIT_LOG_VIEW, label: '查看审计日志' },
    ],
  },
  {
    name: '系统管理',
    key: 'system',
    permissions: [
      { key: Permissions.SYSTEM_CONFIG, label: '系统配置' },
      { key: Permissions.SYSTEM_LOGS, label: '系统日志' },
      { key: Permissions.SYSTEM_TENANT, label: '租户管理' },
      { key: Permissions.SYSTEM_DICTIONARY, label: '数据字典' },
      { key: Permissions.ORG_VIEW, label: '查看机构' },
      { key: Permissions.ORG_CREATE, label: '创建机构' },
      { key: Permissions.ORG_EDIT, label: '编辑机构' },
      { key: Permissions.ORG_DELETE, label: '删除机构' },
      { key: Permissions.AI_CONFIG_VIEW, label: '查看 AI 配置' },
      { key: Permissions.AI_CONFIG_MANAGE, label: '管理 AI 配置' },
      { key: Permissions.NOTICE_SEND, label: '发送通知' },
      { key: Permissions.NOTICE_MANAGE, label: '管理通知' },
    ],
  },
  {
    name: '消息通知',
    key: 'notification',
    permissions: [
      { key: Permissions.NOTIFICATION_VIEW, label: '查看消息' },
    ],
  },
  {
    name: '权限管理',
    key: 'admin',
    permissions: [
      { key: Permissions.ROLE_VIEW, label: '查看角色' },
      { key: Permissions.ROLE_CREATE, label: '创建角色' },
      { key: Permissions.ROLE_EDIT, label: '编辑角色' },
      { key: Permissions.ROLE_DELETE, label: '删除角色' },
    ],
  },
];
