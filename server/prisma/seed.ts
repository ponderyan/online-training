import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 FoxLearn 种子数据初始化...\n');

  // ── 1. 创建默认机构 ──
  const org = await prisma.organization.upsert({
    where: { code: 'CEC' },
    update: {},
    create: { name: '中电标协', code: 'CEC', contactName: '系统管理员' },
  });
  console.log(`✅ 机构: ${org.name} (${org.code})`);

  // ── 1.1 创建默认招生机构 ──
  let agency = await prisma.enrollmentAgency.findFirst({ where: { name: '中电标协招办' } });
  if (!agency) {
    agency = await prisma.enrollmentAgency.create({
      data: { name: '中电标协招办', contactPerson: '招生办', contactPhone: '010-88888888', organizationId: org.id },
    });
  }
  console.log(`✅ 招生机构: ${agency.name}`);

  // ── 2. 创建 8 个内置角色 ──
  const rolesData = [
    { name: '超级管理员', code: 'SUPER_ADMIN', color: '#ef4444', description: '系统运维，管理所有机构', isSystem: true, sortOrder: 1 },
    { name: '机构管理员', code: 'ORG_ADMIN', color: '#e87a30', description: '管理本机构培训业务', isSystem: true, sortOrder: 2 },
    { name: '讲师', code: 'LECTURER', color: '#1565c0', description: '授课、出题、批阅', isSystem: true, sortOrder: 3 },
    { name: '监考', code: 'PROCTOR', color: '#f59e0b', description: '考试监控、签到', isSystem: true, sortOrder: 4 },
    { name: '学员', code: 'STUDENT', color: '#2e7d32', description: '学习、考试、查成绩', isSystem: true, sortOrder: 5 },
    { name: '审计员', code: 'AUDITOR', color: '#7b1fa2', description: '只读查看 + 报表导出', isSystem: true, sortOrder: 6 },
    { name: '招生机构管理员', code: 'AGENCY_ADMIN', color: '#0d47a1', description: '管理招生机构及学员', isSystem: true, sortOrder: 7 },
    { name: '考务人员', code: 'EXAM_OFFICER', color: '#6a1b9a', description: '考试场次管理、编排、监考指派', isSystem: true, sortOrder: 8 },
  ];
  const roles: any[] = [];
  for (const r of rolesData) {
    const role = await prisma.role.upsert({ where: { code: r.code }, update: {}, create: r });
    roles.push(role);
    console.log(`  角色: ${role.name} (${role.code})`);
  }

  // ── 3. 创建默认管理员用户 ──
  const passwordHash = await bcrypt.hash('admin_temp', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: { username: 'admin', passwordHash, displayName: '管理员', orgId: org.id },
  });
  const superRole = roles.find(r => r.code === 'SUPER_ADMIN')!;
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superRole.id },
  });
  console.log(`✅ 管理员: ${admin.displayName} (admin / admin_temp)`);

  // ── 4. 数据字典 ──
  const dicts = [
    { code: 'DTM', name: '数智化管理师', sortOrder: 1 },
    { code: 'DTC', name: '数智化咨询师', sortOrder: 2 },
    { code: 'DTGV', name: '数据治理工程师', sortOrder: 3 },
    { code: 'DTA', name: '数智化架构师', sortOrder: 4 },
    { code: 'COMMON', name: '通用/公共', sortOrder: 99 },
  ];
  for (const d of dicts) {
    await prisma.dataDictionary.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: d.sortOrder },
      create: d,
    });
  }
  console.log(`✅ 数据字典: ${dicts.length} 项`);

  // ── 5. 默认科目 ──
  const dtmDict = await prisma.dataDictionary.findUniqueOrThrow({ where: { code: 'DTM' } });
  await prisma.subject.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '数智化管理师', code: 'DTM', dictionaryId: dtmDict.id, sortOrder: 1 },
  });

  // ── 6. 章节 ──
  const chapterNames = [
    '数字化转型概述', '数据驱动决策', 'AI技术基础与应用',
    '数字化组织与人才', '数据治理与安全', '数字化项目管理', '案例分析',
  ];
  const chapters: any[] = [];
  for (let i = 0; i < chapterNames.length; i++) {
    let ch = await prisma.chapter.findFirst({ where: { subjectId: 1, name: chapterNames[i] } });
    if (!ch) {
      ch = await prisma.chapter.create({
        data: { subjectId: 1, name: chapterNames[i], sortOrder: i + 1 },
      });
    }
    chapters.push(ch);
  }
  console.log(`✅ 章节: ${chapters.length} 个`);

  // ── 7. 标签 ──
  for (const name of ['数据治理', '精益管理', '战略转型', 'AI应用', '通用']) {
    await prisma.tag.upsert({
      where: { name_type: { name, type: 'domain' } },
      update: {},
      create: { name, type: 'domain' },
    }).catch(() => {});
  }
  console.log('✅ 标签: 5 个');

  // ── 8. 讲师样例 ──
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (adminUser) {
    await prisma.instructor.upsert({
      where: { userId: adminUser.id },
      update: {},
      create: {
        userId: adminUser.id, realName: '管理员讲师', title: '高级工程师',
        type: 'INTERNAL', workUnit: '中电标协', level: 'SENIOR', isGrader: true,
        instructorNo: 'INS20260623001',
      },
    });
  }
  // 管理员讲师已在 seed 完成后由 B-10 中的 stu001 关联创建
  console.log('✅ 讲师: 1 名样例（管理员讲师）');

  // ── 9. 各角色测试账号 ──
  const testPw = await bcrypt.hash('123456', 10);
  const testAccounts = [
    { username: 'org_admin', displayName: '机构管理员', roles: ['ORG_ADMIN'] },
    { username: 'agency_admin', displayName: '招生机构管理员', roles: ['AGENCY_ADMIN'] },
    { username: 'lecturer01', displayName: '李讲师', roles: ['LECTURER'] },
    { username: 'exam_officer', displayName: '考务员小王', roles: ['EXAM_OFFICER'] },
    { username: 'proctor01', displayName: '监考员老赵', roles: ['PROCTOR'] },
    { username: 'auditor01', displayName: '审计员小刘', roles: ['AUDITOR'] },
  ];
  for (const acct of testAccounts) {
    const user = await prisma.user.upsert({
      where: { username: acct.username },
      update: {
        primaryAgencyId: ['agency_admin', 'lecturer01', 'proctor01'].includes(acct.username) ? agency.id : undefined,
      },
      create: {
        username: acct.username, passwordHash: testPw,
        displayName: acct.displayName, orgId: org.id,
        primaryAgencyId: ['agency_admin', 'lecturer01', 'proctor01'].includes(acct.username) ? agency.id : undefined,
      },
    });
    const role = roles.find(r => acct.roles.includes(r.code));
    if (role) {
      await prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }
  console.log(`✅ 测试账号: ${testAccounts.length} 个`);

  // ═══════════════════════════════════════════════════════════════
  // 以下为 Part B 新增业务数据
  // ═══════════════════════════════════════════════════════════════

  // ── B-2: 第2个招生机构 ──
  let agency2 = await prisma.enrollmentAgency.findFirst({ where: { name: '北京数字人才培训中心' } });
  if (!agency2) {
    agency2 = await prisma.enrollmentAgency.create({
      data: {
        name: '北京数字人才培训中心',
        contactPerson: '王主任',
        contactPhone: '010-87654321',
        organizationId: org.id,
      },
    });
  }
  console.log(`✅ B-2 招生机构: ${agency2.name}`);

  // ── B-4: 1个标准课程 ──
  let course = await prisma.course.findFirst({ where: { code: 'CORE-DT-001' } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        name: '数字化转型核心课程',
        code: 'CORE-DT-001',
        description: '数字化转型核心知识点，含理论+案例',
        hours: 40,
        type: 'STANDARD',
        status: 'ACTIVE',
      },
    });
  }
  console.log(`✅ B-4 标准课程: ${course.name}`);

  // ── B-6: 2个视频课程 ──
  const videoData = [
    {
      name: '数字化转型概述',
      description: '数字化转型的基本概念、驱动因素和战略框架',
      instructorName: '李讲师',
      hours: 4,
      duration: 7200,
      type: 'PUBLIC',
      status: 'PUBLISHED',
      sortOrder: 1,
    },
    {
      name: '数据驱动决策',
      description: '如何在组织中建立数据驱动的决策文化和方法',
      instructorName: '李讲师',
      hours: 4,
      duration: 7200,
      type: 'PUBLIC',
      status: 'PUBLISHED',
      sortOrder: 2,
    },
  ];
  const videos: any[] = [];
  for (const vd of videoData) {
    let vid = await prisma.videoCourse.findFirst({ where: { name: vd.name } });
    if (!vid) {
      vid = await prisma.videoCourse.create({ data: vd });
    }
    videos.push(vid);
  }
  console.log(`✅ B-6 视频课程: ${videos.length} 个`);

  // ── B-7: 关联视频到课程 ──
  for (const vid of videos) {
    await prisma.videoCourseCourse.upsert({
      where: { videoCourseId_courseId: { videoCourseId: vid.id, courseId: course.id } },
      update: {},
      create: { videoCourseId: vid.id, courseId: course.id },
    });
  }
  console.log(`✅ B-7 视频课程关联: ${videos.length} 条`);

  // ── B-8: 10道测试题目 ──
  const questionsData = [
    {
      stem: '数字化转型的首要驱动因素是什么？',
      analysis: '客户需求变化是数字化转型的核心驱动力',
      type: 'SINGLE_CHOICE' as const,
      chapterIdx: 0, // 数字化转型概述
      options: [
        { label: 'A', content: '客户需求变化', isCorrect: true },
        { label: 'B', content: '技术升级', isCorrect: false },
        { label: 'C', content: '政策要求', isCorrect: false },
        { label: 'D', content: '成本压力', isCorrect: false },
      ],
    },
    {
      stem: '数据治理的核心目标是什么？',
      analysis: '保证数据质量和安全是数据治理的核心目标',
      type: 'SINGLE_CHOICE' as const,
      chapterIdx: 4, // 数据治理与安全
      options: [
        { label: 'A', content: '提高存储效率', isCorrect: false },
        { label: 'B', content: '保证数据质量和安全', isCorrect: true },
        { label: 'C', content: '降低成本', isCorrect: false },
        { label: 'D', content: '增加数据量', isCorrect: false },
      ],
    },
    {
      stem: '以下哪个不是常见的数字化技术？',
      analysis: '蒸汽机属于工业革命时期的发明，不属于数字化技术',
      type: 'SINGLE_CHOICE' as const,
      chapterIdx: 0, // 数字化转型概述
      options: [
        { label: 'A', content: '云计算', isCorrect: false },
        { label: 'B', content: '大数据', isCorrect: false },
        { label: 'C', content: '蒸汽机', isCorrect: true },
        { label: 'D', content: '人工智能', isCorrect: false },
      ],
    },
    {
      stem: 'BI工具的主要功能是？',
      analysis: '商业智能（BI）工具主要用于数据分析和可视化',
      type: 'SINGLE_CHOICE' as const,
      chapterIdx: 1, // 数据驱动决策
      options: [
        { label: 'A', content: '数据分析和可视化', isCorrect: true },
        { label: 'B', content: '数据存储', isCorrect: false },
        { label: 'C', content: '网络安全', isCorrect: false },
        { label: 'D', content: '硬件管理', isCorrect: false },
      ],
    },
    {
      stem: '数字化转型成功的最大挑战通常是？',
      analysis: '组织文化变革往往比技术选型更具挑战性',
      type: 'SINGLE_CHOICE' as const,
      chapterIdx: 3, // 数字化组织与人才
      options: [
        { label: 'A', content: '技术选型', isCorrect: false },
        { label: 'B', content: '预算不足', isCorrect: false },
        { label: 'C', content: '数据不够', isCorrect: false },
        { label: 'D', content: '组织文化变革', isCorrect: true },
      ],
    },
    {
      stem: '以下哪些属于数据治理的范畴？',
      analysis: '数据治理涵盖数据标准、数据质量和数据安全等多个方面',
      type: 'MULTIPLE_CHOICE' as const,
      chapterIdx: 4, // 数据治理与安全
      options: [
        { label: 'A', content: '数据标准', isCorrect: true },
        { label: 'B', content: '数据质量', isCorrect: true },
        { label: 'C', content: '数据删除', isCorrect: false },
        { label: 'D', content: '数据安全', isCorrect: true },
      ],
    },
    {
      stem: '云计算的服务模式包括？',
      analysis: 'IaaS（基础设施即服务）、PaaS（平台即服务）、SaaS（软件即服务）是云计算的三大服务模式',
      type: 'MULTIPLE_CHOICE' as const,
      chapterIdx: 2, // AI技术基础与应用
      options: [
        { label: 'A', content: 'IaaS', isCorrect: true },
        { label: 'B', content: 'PaaS', isCorrect: true },
        { label: 'C', content: 'SaaS', isCorrect: true },
        { label: 'D', content: 'HaaS', isCorrect: false },
      ],
    },
    {
      stem: '人工智能在企业的应用场景包括？',
      analysis: '智能客服、预测分析和流程自动化都是AI在企业中的典型应用',
      type: 'MULTIPLE_CHOICE' as const,
      chapterIdx: 2, // AI技术基础与应用
      options: [
        { label: 'A', content: '智能客服', isCorrect: true },
        { label: 'B', content: '手工记账', isCorrect: false },
        { label: 'C', content: '预测分析', isCorrect: true },
        { label: 'D', content: '流程自动化', isCorrect: true },
      ],
    },
    {
      stem: '数字化转型就是信息化升级',
      analysis: '数字化转型不仅仅是信息化升级，更是业务模式的重塑和组织变革',
      type: 'TRUE_FALSE' as const,
      chapterIdx: 0, // 数字化转型概述
      options: [
        { label: 'A', content: '正确', isCorrect: false },
        { label: 'B', content: '错误', isCorrect: true },
      ],
    },
    {
      stem: '数据是企业的核心资产之一',
      analysis: '在数字化时代，数据已成为企业的重要战略资产',
      type: 'TRUE_FALSE' as const,
      chapterIdx: 4, // 数据治理与安全
      options: [
        { label: 'A', content: '正确', isCorrect: true },
        { label: 'B', content: '错误', isCorrect: false },
      ],
    },
  ];

  const questions: any[] = [];
  for (const qd of questionsData) {
    const q = await prisma.question.create({
      data: {
        type: qd.type,
        difficulty: 'EASY',
        source: 'MANUAL',
        status: 'PUBLISHED',
        content: qd.stem,
        analysis: qd.analysis,
        subjectId: 1,
        chapterId: chapters[qd.chapterIdx].id,
        createdBy: admin.id,
      },
    });
    for (let oi = 0; oi < qd.options.length; oi++) {
      const opt = qd.options[oi];
      await prisma.questionOption.create({
        data: {
          questionId: q.id,
          label: opt.label,
          content: opt.content,
          isCorrect: opt.isCorrect,
          sortOrder: oi + 1,
        },
      });
    }
    questions.push(q);
  }
  console.log(`✅ B-8 测试题目: ${questions.length} 题 (5单选+3多选+2判断)`);

  // ── B-9: 1套试卷 ──
  const paperNumber = `DT-DTM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`;
  let paper = await prisma.paper.findFirst({ where: { name: '数智化管理师（DTM）模拟测试' } });
  if (!paper) {
    paper = await prisma.paper.create({
      data: {
        name: '数智化管理师（DTM）模拟测试',
        paperNumber,
        status: 'FINALIZED',
        subjectId: 1,
        totalScore: 100,
        durationMinutes: 60,
        createdBy: admin.id,
      },
    });
    // 按顺序添加题目
    for (let i = 0; i < questions.length; i++) {
      // 分数分配: 单选10分, 多选10分, 判断10分（合计100）
      const score = i < 5 ? 10 : (i < 8 ? 10 : 10);
      await prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: questions[i].id,
          sortOrder: i + 1,
          score,
        },
      });
    }
  }
  console.log(`✅ B-9 试卷: ${paper.name} (${paperNumber}, 100分/60分及格)`);

  // ── B-5: 关联培训班和课程 ──
  // 先创建培训班（需要引用课程 ID）
  let program = await prisma.trainingProgram.findFirst({ where: { code: 'DTM-2026-001' } });
  if (!program) {
    program = await prisma.trainingProgram.create({
      data: {
        name: '数智化管理师（DTM）第1期',
        code: 'DTM-2026-001',
        courseName: '数智化管理师认证培训',
        orgId: org.id,
        courseId: course.id,
        subjectId: 1,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        enrollStart: new Date('2026-06-01'),
        enrollEnd: new Date('2026-07-15'),
        hoursPerDay: 8,
        createdBy: admin.id,
        status: 'ENROLLING',
        maxStudents: 50,
        location: '北京·中电标协培训教室',
        description: '数智化管理师认证培训2026年第1期，涵盖数字化转型、数据驱动决策、AI应用等核心模块',
      },
    });
  } else {
    // 确保已有课程关联
    if (!program.courseId) {
      program = await prisma.trainingProgram.update({
        where: { id: program.id },
        data: { courseId: course.id },
      });
    }
  }
  console.log(`✅ B-3/B-5 培训班: ${program.name} (${program.code})`);

  // ── B-10: 新增学员关联 ──
  const studentPw = await bcrypt.hash('123456', 10);
  const studentRole = roles.find(r => r.code === 'STUDENT')!;

  // 机构1（中电标协招办）下的学员：stu001已存在 + stu002, stu003新增
  const agency1Students = [
    { username: 'stu001', displayName: '张三' },
    { username: 'stu002', displayName: '李四' },
    { username: 'stu003', displayName: '王五' },
  ];

  // 机构2（北京数字人才培训中心）下的学员：stu004, stu005新增
  const agency2Students = [
    { username: 'stu004', displayName: '赵六' },
    { username: 'stu005', displayName: '钱七' },
  ];

  let enrollCount = 0;

  for (const sd of agency1Students) {
    const user = await prisma.user.upsert({
      where: { username: sd.username },
      update: { displayName: sd.displayName, primaryAgencyId: agency.id },
      create: {
        username: sd.username,
        passwordHash: studentPw,
        displayName: sd.displayName,
        orgId: org.id,
        primaryAgencyId: agency.id,
      },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: studentRole.id } },
      update: {},
      create: { userId: user.id, roleId: studentRole.id },
    });
    // 如果是 stu001，创建讲师关联
    if (sd.username === 'stu001') {
      await prisma.instructor.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id, realName: '张三讲师', title: '副教授',
          type: 'EXTERNAL', workUnit: '北京某高校', level: 'SENIOR', isGrader: true,
          education: '博士', school: '清华大学', gender: '男',
          idCard: '110101199001011234', bankAccount: '工行北京分行 6222****1234',
          instructorNo: 'INS20260623002',
        },
      });
    }
    // 报名培训班
    await prisma.programEnrollment.upsert({
      where: { programId_studentId: { programId: program.id, studentId: user.id } },
      update: {},
      create: {
        programId: program.id,
        studentId: user.id,
        agencyId: agency.id,
        enrollSource: 'SEED',
        feeStatus: 'UNPAID',
        status: 'ENROLLED',
      },
    });
    enrollCount++;
  }
  console.log(`  ↪ 张三讲师: 已关联 stu001`);

  for (const sd of agency2Students) {
    const user = await prisma.user.upsert({
      where: { username: sd.username },
      update: { displayName: sd.displayName, primaryAgencyId: agency2!.id },
      create: {
        username: sd.username,
        passwordHash: studentPw,
        displayName: sd.displayName,
        orgId: org.id,
        primaryAgencyId: agency2!.id,
      },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: studentRole.id } },
      update: {},
      create: { userId: user.id, roleId: studentRole.id },
    });
    // 报名培训班
    await prisma.programEnrollment.upsert({
      where: { programId_studentId: { programId: program.id, studentId: user.id } },
      update: {},
      create: {
        programId: program.id,
        studentId: user.id,
        agencyId: agency2!.id,
        enrollSource: 'SEED',
        feeStatus: 'UNPAID',
        status: 'ENROLLED',
      },
    });
    enrollCount++;
  }
  console.log(`✅ B-10 学员报名: ${enrollCount} 名学员 (机构1: 3, 机构2: 2)`);

  // ── SystemConfig 默认值 ──
  const configDefaults = [
    // ── 题库策略（已有，加 group/type）──
    { key: 'allow_org_own_bank', value: 'false', desc: '是否允许机构自建题库', group: 'general', inputType: 'boolean', options: null },
    { key: 'org_bank_visibility', value: 'view_only', desc: '协会对机构题库可见性', group: 'general', inputType: 'select', options: '["hidden","view_only","full_access"]' },

    // ── 培训配置 ──
    { key: 'training_yearly_hour_limit', value: '90', desc: '年度学时上限', group: 'training', inputType: 'number', options: null },
    { key: 'training_hour_cycle', value: 'yearly', desc: '学时考核周期', group: 'training', inputType: 'select', options: '["yearly","half_yearly","custom"]' },
    { key: 'training_auto_record_enabled', value: 'true', desc: '自动记录学时开关', group: 'training', inputType: 'boolean', options: null },
    { key: 'training_course_completion_threshold', value: '80', desc: '课程完成度阈值(%)', group: 'training', inputType: 'number', options: null },
    { key: 'training_exam_pass_threshold', value: '60', desc: '考试及格触发自动学时分', group: 'training', inputType: 'number', options: null },
    { key: 'training_default_exam_pass_score', value: '60', desc: '默认考试及格分数线', group: 'training', inputType: 'number', options: null },

    // ── 考试配置 ──
    { key: 'exam_cutoff_threshold', value: '3', desc: '切屏检测阈值(次)', group: 'exam', inputType: 'number', options: null },
    { key: 'exam_retake_limit', value: '2', desc: '补考次数限制', group: 'exam', inputType: 'number', options: null },
    { key: 'exam_retake_window_days', value: '7', desc: '补考窗口期(天)', group: 'exam', inputType: 'number', options: null },

    // ── 通知配置 ──
    { key: 'notif_cert_expiry_enabled', value: 'true', desc: '证书到期提醒开关', group: 'notification', inputType: 'boolean', options: null },
    { key: 'notif_cert_expiry_days', value: '60', desc: '到期前提醒天数', group: 'notification', inputType: 'number', options: null },
    { key: 'notif_approval_enabled', value: 'true', desc: '审批待办提醒开关', group: 'notification', inputType: 'boolean', options: null },
  ];
  for (const cfg of configDefaults) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value, desc: cfg.desc, group: cfg.group, inputType: cfg.inputType, options: cfg.options },
      create: cfg,
    });
  }
  console.log(`✅ SystemConfig: ${configDefaults.length} 项`);

  // ═══════════════════════════════════════
  // 学时类型字典
  // ═══════════════════════════════════════

  const hourTypes = [
    { code: 'PUBLIC_REQUIRED', name: '公需科目', sortOrder: 1, description: '公共必修学时' },
    { code: 'PROFESSIONAL', name: '专业科目', sortOrder: 2, description: '专业领域学时' },
    { code: 'OTHER', name: '其他', sortOrder: 3, description: '其他类型学时' },
  ];
  for (const ht of hourTypes) {
    await prisma.learningHourType.upsert({
      where: { code: ht.code },
      update: { name: ht.name, sortOrder: ht.sortOrder, description: ht.description },
      create: ht,
    });
  }

  // ═══════════════════════════════════════
  // 知识点树 seed
  // ═══════════════════════════════════════

  // 找第一个科目的 ID（信息系统项目管理假设为 subjectId=1）
  const firstSubject = await prisma.subject.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (firstSubject) {
    const sid = firstSubject.id;
    const kpData = [
      // 一级节点
      { name: '项目管理基础', code: 'PM_BASIC', subjectId: sid, parentCode: null, sortOrder: 1, desc: '项目管理基础知识体系' },
      { name: '进度管理', code: 'PM_SCHEDULE', subjectId: sid, parentCode: null, sortOrder: 2, desc: '项目进度规划与控制' },
      { name: '成本管理', code: 'PM_COST', subjectId: sid, parentCode: null, sortOrder: 3, desc: '项目成本估算与控制' },
      { name: '质量管理', code: 'PM_QUALITY', subjectId: sid, parentCode: null, sortOrder: 4, desc: '项目质量保证与控制' },
      { name: '风险管理', code: 'PM_RISK', subjectId: sid, parentCode: null, sortOrder: 5, desc: '项目风险识别与应对' },
      { name: '沟通与干系人管理', code: 'PM_COMM', subjectId: sid, parentCode: null, sortOrder: 6, desc: '项目沟通与干系人管理' },
    ];

    // 用 code 追踪父子关系
    const createdMap = new Map<string, number>();
    for (const kp of kpData) {
      const { parentCode, subjectId, desc, ...rest } = kp as any;
      const created = await prisma.knowledgePoint.upsert({
        where: { code: rest.code },
        update: { name: rest.name, sortOrder: rest.sortOrder, description: desc },
        create: { ...rest, description: desc, subject: { connect: { id: subjectId } } },
      });
      createdMap.set(rest.code, created.id);
    }

    // 二级节点
    const childData = [
      { name: '项目与项目管理概念', code: 'PM_BASIC_CONCEPT', parentCode: 'PM_BASIC', sortOrder: 1 },
      { name: '项目生命周期', code: 'PM_BASIC_LIFECYCLE', parentCode: 'PM_BASIC', sortOrder: 2 },
      { name: '项目管理过程组', code: 'PM_BASIC_PROCESS', parentCode: 'PM_BASIC', sortOrder: 3 },
      { name: '活动定义与排序', code: 'PM_SCHEDULE_DEFINE', parentCode: 'PM_SCHEDULE', sortOrder: 1 },
      { name: '活动资源估算', code: 'PM_SCHEDULE_RESOURCE', parentCode: 'PM_SCHEDULE', sortOrder: 2 },
      { name: '活动历时估算', code: 'PM_SCHEDULE_DURATION', parentCode: 'PM_SCHEDULE', sortOrder: 3 },
      { name: '进度计划编制', code: 'PM_SCHEDULE_PLAN', parentCode: 'PM_SCHEDULE', sortOrder: 4 },
      { name: '成本估算', code: 'PM_COST_ESTIMATE', parentCode: 'PM_COST', sortOrder: 1 },
      { name: '成本预算', code: 'PM_COST_BUDGET', parentCode: 'PM_COST', sortOrder: 2 },
      { name: '成本控制', code: 'PM_COST_CONTROL', parentCode: 'PM_COST', sortOrder: 3 },
      { name: '质量规划', code: 'PM_QUALITY_PLAN', parentCode: 'PM_QUALITY', sortOrder: 1 },
      { name: '质量保证', code: 'PM_QUALITY_ASSURANCE', parentCode: 'PM_QUALITY', sortOrder: 2 },
      { name: '质量控制', code: 'PM_QUALITY_CONTROL', parentCode: 'PM_QUALITY', sortOrder: 3 },
      { name: '风险识别', code: 'PM_RISK_IDENTIFY', parentCode: 'PM_RISK', sortOrder: 1 },
      { name: '风险定性分析', code: 'PM_RISK_QUALITATIVE', parentCode: 'PM_RISK', sortOrder: 2 },
      { name: '风险定量分析', code: 'PM_RISK_QUANTITATIVE', parentCode: 'PM_RISK', sortOrder: 3 },
      { name: '风险应对', code: 'PM_RISK_RESPONSE', parentCode: 'PM_RISK', sortOrder: 4 },
      { name: '沟通管理', code: 'PM_COMM_MANAGE', parentCode: 'PM_COMM', sortOrder: 1 },
      { name: '干系人管理', code: 'PM_COMM_STAKEHOLDER', parentCode: 'PM_COMM', sortOrder: 2 },
    ];

    for (const child of childData) {
      const parentId = createdMap.get(child.parentCode);
      if (!parentId) continue;
      // 检查是否已存在
      const existing = await prisma.knowledgePoint.findUnique({ where: { code: child.code } });
      if (!existing) {
        await prisma.knowledgePoint.create({
          data: {
            name: child.name, code: child.code,
            subject: { connect: { id: sid } },
            parent: { connect: { id: parentId } },
            sortOrder: child.sortOrder,
            description: child.name,
          },
        });
      } else {
        await prisma.knowledgePoint.update({
          where: { code: child.code },
          data: { name: child.name, parentId, sortOrder: child.sortOrder },
        });
      }
    }

    console.log(`✅ 知识点树: ${kpData.length + childData.length} 个节点`);
  }

  // ── 最终输出 ──
  console.log('\n🎉 种子数据初始化完成!');
  console.log(`   管理员:   admin / admin_temp`);
  console.log(`   机构管理:  org_admin / 123456`);
  console.log(`   招生机构:  agency_admin / 123456`);
  console.log(`   讲师:     lecturer01 / 123456`);
  console.log(`   考务员:   exam_officer / 123456`);
  console.log(`   监考员:   proctor01 / 123456`);
  console.log(`   审计员:   auditor01 / 123456`);
  console.log(`   学员A:    stu001 / 123456 (中电标协招办)`);
  console.log(`   学员B:    stu002 / 123456 (中电标协招办)`);
  console.log(`   学员C:    stu003 / 123456 (中电标协招办)`);
  console.log(`   学员D:    stu004 / 123456 (北京数字人才培训中心)`);
  console.log(`   学员E:    stu005 / 123456 (北京数字人才培训中心)`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
