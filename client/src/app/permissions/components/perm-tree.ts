// 权限树与预设颜色（自 page.tsx 迁出，纯重构零行为变化）

export const PERM_TREE: { key: string; icon: string; children: { permission: string; name: string }[] }[] = [
  { key: '系统管理', icon: '⚙️', children: [
    { permission: 'system.config', name: '系统配置' }, { permission: 'system.logs', name: '系统日志' },
    { permission: 'system.tenant', name: '租户管理' }, { permission: 'system.dictionary', name: '数据字典' },
    { permission: 'notification:view', name: '系统通知' },
  ]},
  { key: '题库管理', icon: '📝', children: [
    { permission: 'question.create', name: '创建试题' }, { permission: 'question.edit', name: '编辑试题' },
    { permission: 'question.delete', name: '删除试题' }, { permission: 'question.import', name: '导入试题' },
    { permission: 'question.audit', name: '审核试题' },
  ]},
  { key: '试卷管理', icon: '📄', children: [
    { permission: 'paper.view', name: '查看试卷' }, { permission: 'paper.generate', name: '生成试卷' },
    { permission: 'paper.edit', name: '编辑试卷' }, { permission: 'paper.publish', name: '发布试卷' },
    { permission: 'paper.download', name: '下载试卷' }, { permission: 'paper.answerSheet', name: '答题卡管理' },
    { permission: 'template.manage', name: '管理模板' },
  ]},
  { key: '考试管理', icon: '📋', children: [
    { permission: 'exam.create', name: '创建考试' }, { permission: 'exam.edit', name: '编辑考试' },
    { permission: 'exam.delete', name: '删除考试' }, { permission: 'exam.assign', name: '分配学员' },
    { permission: 'exam:view', name: '查看考试' },
  ]},
  { key: '监考', icon: '👁️', children: [
    { permission: 'proctor.view', name: '查看监控' }, { permission: 'proctor.forceSubmit', name: '强制收卷' },
    { permission: 'proctor.extendTime', name: '延长时长' },
  ]},
  { key: '判分', icon: '📊', children: [
    { permission: 'grading.auto', name: '自动判分' }, { permission: 'grading.manual', name: '人工判分' },
    { permission: 'grading.publish', name: '发布成绩' },
  ]},
  { key: '学员管理', icon: '��', children: [
    { permission: 'student.create', name: '创建学员' }, { permission: 'student.import', name: '导入学员' },
    { permission: 'student.edit', name: '编辑学员' }, { permission: 'student.group', name: '管理分组' },
  ]},
  { key: '培训项目', icon: '📋', children: [
    { permission: 'program:view', name: '查看项目' }, { permission: 'program:create', name: '创建项目' },
    { permission: 'program:edit', name: '编辑项目' }, { permission: 'program:delete', name: '删除项目' },
    { permission: 'program:enroll', name: '学员报名' },
  ]},
  { key: '教材出题', icon: '📖', children: [
    { permission: 'material.upload', name: '上传教材' }, { permission: 'material.review', name: '审核试题' },
    { permission: 'material.generate', name: 'AI 出题' },
  ]},
  { key: '证书', icon: '🏅', children: [
    { permission: 'cert.issue', name: '发证' }, { permission: 'cert.revoke', name: '撤销证书' },
    { permission: 'cert.view', name: '查看证书' }, { permission: 'cert:approve', name: '审批证书' },
    { permission: 'cert:reject', name: '驳回申请' },
    { permission: 'cert:application_view', name: '查看申请' },
  ]},
  { key: '课程管理', icon: '🎬', children: [
    { permission: 'course:view', name: '查看课程' }, { permission: 'course:create', name: '创建课程' },
    { permission: 'course:edit', name: '编辑课程' }, { permission: 'course:delete', name: '删除课程' },
  ]},
  { key: '排课管理', icon: '📅', children: [
    { permission: 'schedule:view', name: '查看排课' }, { permission: 'schedule:create', name: '创建排课' },
    { permission: 'schedule:edit', name: '编辑排课' }, { permission: 'schedule:delete', name: '删除排课' },
  ]},
  { key: '讲师管理', icon: '👨‍🏫', children: [
    { permission: 'instructor:view', name: '查看讲师' }, { permission: 'instructor:create', name: '创建讲师' },
    { permission: 'instructor:edit', name: '编辑讲师' }, { permission: 'instructor:delete', name: '删除讲师' },
  ]},
  { key: '代理机构', icon: '🤝', children: [
    { permission: 'agency:view', name: '查看机构' }, { permission: 'agency:create', name: '创建机构' },
    { permission: 'agency:edit', name: '编辑机构' }, { permission: 'agency:delete', name: '删除机构' },
  ]},
  { key: '通知公告', icon: '📢', children: [
    { permission: 'notice.send', name: '发送通知' }, { permission: 'notice.manage', name: '管理通知' },
  ]},
  { key: '报表', icon: '📊', children: [
    { permission: 'report.view', name: '查看报表' }, { permission: 'report.export', name: '导出报表' },
  ]},
  { key: '成绩单', icon: '📜', children: [
    { permission: 'transcript:view', name: '查看成绩单' },
  ]},
  { key: '机构管理', icon: '🏢', children: [
    { permission: 'org:view', name: '查看机构' }, { permission: 'org:create', name: '创建机构' },
    { permission: 'org:edit', name: '编辑机构' }, { permission: 'org:delete', name: '删除机构' },
  ]},
  { key: '角色管理', icon: '🔐', children: [
    { permission: 'role:view', name: '查看角色' }, { permission: 'role:create', name: '创建角色' },
    { permission: 'role:edit', name: '编辑角色' }, { permission: 'role:delete', name: '删除角色' },
  ]},
  { key: '学时管理', icon: '⏱️', children: [
    { permission: 'learningHour:view', name: '查看学时' }, { permission: 'learningHour:manage', name: '管理学时' },
  ]},
  { key: '评价管理', icon: '⭐', children: [
    { permission: 'evaluation:view', name: '查看评价' }, { permission: 'evaluation:manage', name: '管理评价' },
  ]},
  { key: 'AI配置', icon: '🤖', children: [
    { permission: 'aiConfig:view', name: '查看配置' }, { permission: 'aiConfig:manage', name: '管理配置' },
  ]},
  { key: '审计日志', icon: '📋', children: [
    { permission: 'auditLog:view', name: '查看日志' },
  ]},
];

export const PRESET_COLORS = ['var(--error)', 'var(--fox)', 'var(--blue)', 'var(--warning)', 'var(--sage)', 'var(--purple)', 'var(--info-light)', 'var(--error)'];

// 关键角色：修改权限时需二次确认
export const CRITICAL_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER'];
