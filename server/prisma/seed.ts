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

  // ── 2. 创建 6 个内置角色 ──
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
  // 关联 SUPER_ADMIN 角色
  const superRole = roles.find(r => r.code === 'SUPER_ADMIN')!;
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superRole.id },
  });
  console.log(`✅ 管理员: ${admin.displayName} (admin / admin_temp)`);

  // ── 4. 测试学员（可选） ──
  const studentPw = await bcrypt.hash('123456', 10);
  const studentRole = roles.find(r => r.code === 'STUDENT')!;
  const testStudent = await prisma.user.upsert({
    where: { username: 'stu001' },
    update: {},
    create: { username: 'stu001', passwordHash: studentPw, displayName: '张三', orgId: org.id },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: testStudent.id, roleId: studentRole.id } },
    update: {},
    create: { userId: testStudent.id, roleId: studentRole.id },
  });
  console.log(`✅ 测试学员: ${testStudent.displayName} (stu001 / 123456)`);

  // ── 5. 数据字典 ──
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

  // ── 6. 默认科目 ──
  const dtmDict = await prisma.dataDictionary.findUniqueOrThrow({ where: { code: 'DTM' } });
  await prisma.subject.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '数智化管理师', code: 'DTM', dictionaryId: dtmDict.id, sortOrder: 1 },
  });

  // ── 7. 章节 ──
  for (const ch of [
    { name: '数字化转型概述', sortOrder: 1 },
    { name: '数据驱动决策', sortOrder: 2 },
    { name: 'AI技术基础与应用', sortOrder: 3 },
    { name: '数字化组织与人才', sortOrder: 4 },
    { name: '数据治理与安全', sortOrder: 5 },
    { name: '数字化项目管理', sortOrder: 6 },
    { name: '案例分析', sortOrder: 7 },
  ]) {
    await prisma.chapter.create({
      data: { subjectId: 1, name: ch.name, sortOrder: ch.sortOrder },
    }).catch(() => {});
  }

  // ── 8. 标签 ──
  for (const name of ['数据治理', '精益管理', '战略转型', 'AI应用', '通用']) {
    await prisma.tag.create({ data: { name, type: 'domain' } }).catch(() => {});
  }

  // ── 9. 讲师样例 ──
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
  const stuUser = await prisma.user.findUnique({ where: { username: 'stu001' } });
  if (stuUser) {
    await prisma.instructor.upsert({
      where: { userId: stuUser.id },
      update: {},
      create: {
        userId: stuUser.id, realName: '张三讲师', title: '副教授',
        type: 'EXTERNAL', workUnit: '北京某高校', level: 'SENIOR', isGrader: true,
        education: '博士', school: '清华大学', gender: '男',
        idCard: '110101199001011234', bankAccount: '工行北京分行 6222****1234',
        instructorNo: 'INS20260623002',
      },
    });
  }
  console.log('✅ 讲师: 2 名样例');

  // ── 10. 各角色测试账号 ──
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
      update: {},
      create: { username: acct.username, passwordHash: testPw, displayName: acct.displayName, orgId: org.id },
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

  console.log('\n🎉 种子数据初始化完成!');
  console.log(`   管理员:   admin / admin_temp`);
  console.log(`   学员:     stu001 / 123456`);
  console.log(`   机构管理:  org_admin / 123456`);
  console.log(`   招生机构:  agency_admin / 123456`);
  console.log(`   讲师:     lecturer01 / 123456`);
  console.log(`   考务员:   exam_officer / 123456`);
  console.log(`   监考员:   proctor01 / 123456`);
  console.log(`   审计员:   auditor01 / 123456`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
