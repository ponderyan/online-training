/**
 * Phase A 数据迁移脚本
 *
 * 功能：
 * 1. 创建默认 Organization（如不存在）
 * 2. 将所有现有 User 的 role 值迁移到 UserRoleAssignment 表
 * 3. 为所有 User 设置 orgId（指向默认机构）
 * 4. 将 TrainingProgram.headTeacher（字符串）迁移到 ProgramBatch.headTeacherId
 *
 * 执行顺序（在 Phase A schema 变更之后）：
 *   npx tsx server/scripts/migrate-role-permission-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_CODE_MAP: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  LECTURER: 'LECTURER',
  PROCTOR: 'PROCTOR',
  STUDENT: 'STUDENT',
};

async function main() {
  console.log('🚀 开始 Phase A 数据迁移...\n');

  // ── 1. 创建默认机构 ──
  let defaultOrg = await prisma.organization.findFirst({ where: { code: 'CEC' } });
  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: { name: '中电标协', code: 'CEC', contactName: '系统管理员' },
    });
    console.log('✅ 创建默认机构: 中电标协 (CEC), id=' + defaultOrg.id);
  } else {
    console.log('⏭️ 默认机构已存在: id=' + defaultOrg.id);
  }

  // ── 2. 迁移 User.role → UserRoleAssignment ──
  const allUsers = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
  console.log(`\n📊 共 ${allUsers.length} 个用户，开始迁移 role 字段...`);

  // 先确保 Role 表有对应数据
  const roles = await prisma.role.findMany();
  const roleMap = new Map<string, number>();
  for (const r of roles) {
    roleMap.set(r.code, r.id);
  }

  // 如果 Role 表是空的，先创建默认角色
  if (roleMap.size === 0) {
    console.log('⚠️ Role 表为空，先创建默认角色...');
    const defaultRoles = [
      { name: '超级管理员', code: 'SUPER_ADMIN', description: '系统运维，管理所有机构和系统配置', isSystem: true, sortOrder: 1 },
      { name: '机构管理员', code: 'ORG_ADMIN', description: '管理本机构的培训、用户、课程、考试等全部业务', isSystem: true, sortOrder: 2 },
      { name: '讲师', code: 'INSTRUCTOR', description: '授课、出题、批阅', isSystem: true, sortOrder: 3 },
      { name: '监考', code: 'PROCTOR', description: '考试监控、签到确认、考场管理', isSystem: true, sortOrder: 4 },
      { name: '学员', code: 'STUDENT', description: '学习、考试、查成绩', isSystem: true, sortOrder: 5 },
      { name: '审计员', code: 'AUDITOR', description: '只读查看 + 报表导出', isSystem: true, sortOrder: 6 },
    ];
    for (const r of defaultRoles) {
      const created = await prisma.role.upsert({
        where: { code: r.code },
        update: {},
        create: r,
      });
      roleMap.set(created.code, created.id);
    }
    console.log(`✅ 创建了 ${defaultRoles.length} 个默认角色`);
  }

  let migratedCount = 0;
  let warningCount = 0;
  for (const user of allUsers) {
    const roleCode = ROLE_CODE_MAP[user.role];
    const roleId = roleMap.get(roleCode || 'STUDENT');

    if (!roleId) {
      console.warn(`  ⚠️ 用户 ${user.username} (id=${user.id}) 的 role="${user.role}" 未找到对应角色，默认给 STUDENT`);
      const studentRoleId = roleMap.get('STUDENT');
      if (studentRoleId) {
        await prisma.userRoleAssignment.upsert({
          where: { userId_roleId: { userId: user.id, roleId: studentRoleId } },
          update: {},
          create: { userId: user.id, roleId: studentRoleId },
        });
      }
      warningCount++;
      continue;
    }

    // upsert 避免重复执行
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    migratedCount++;
  }
  console.log(`✅ role → UserRoleAssignment 迁移完成: ${migratedCount} 成功, ${warningCount} 警告`);

  // ── 3. 设置 orgId ──
  const usersWithoutOrg = await prisma.user.findMany({ where: { orgId: null }, select: { id: true, username: true } });
  if (usersWithoutOrg.length > 0) {
    await prisma.user.updateMany({
      where: { orgId: null },
      data: { orgId: defaultOrg!.id },
    });
    console.log(`✅ 为 ${usersWithoutOrg.length} 个用户设置了默认机构`);

    // 同时更新存在的程序
    const programsWithoutOrg = await prisma.trainingProgram.findMany({ where: { orgId: null }, select: { id: true } });
    if (programsWithoutOrg.length > 0) {
      await prisma.trainingProgram.updateMany({
        where: { orgId: null },
        data: { orgId: defaultOrg!.id },
      });
      console.log(`✅ 为 ${programsWithoutOrg.length} 个培训班设置了默认机构`);
    }
  } else {
    console.log('⏭️ 所有用户已有 orgId，跳过');
  }

  // ── 4. 迁移 headTeacher 字符串 → ProgramBatch ──
  const programsWithHeadTeacher = await prisma.trainingProgram.findMany({
    where: { headTeacher: { not: null }, NOT: { headTeacher: '' } },
    select: { id: true, name: true, headTeacher: true, startDate: true, endDate: true },
  });
  if (programsWithHeadTeacher.length > 0) {
    let batchCreated = 0;
    for (const program of programsWithHeadTeacher) {
      // 查找匹配的 User
      const teacher = await prisma.user.findFirst({
        where: { displayName: program.headTeacher!, orgId: defaultOrg!.id },
        select: { id: true },
      });

      await prisma.programBatch.upsert({
        where: { id: 0 }, // 永远 upsert 一个不存在的 id，直接 create
        update: {},
        create: {
          name: '首期班',
          programId: program.id,
          headTeacherId: teacher?.id || null,
          startedAt: program.startDate,
          endedAt: program.endDate,
          description: teacher ? undefined : `原班主任: ${program.headTeacher}（未匹配到用户）`,
        },
      });
      batchCreated++;
    }
    console.log(`✅ 创建了 ${batchCreated} 个 ProgramBatch（原 headTeacher 字符串迁移）`);
  } else {
    console.log('⏭️ 没有 headTeacher 数据需要迁移');
  }

  console.log('\n🎉 Phase A 数据迁移完成！');
  console.log('   接下来执行第二步 migration 删除旧字段:');
  console.log('   1. 修改 schema: 删除 User.role、StudentGroup、TrainingProgram.headTeacher');
  console.log('   2. npx prisma db push');
}

main()
  .catch(e => { console.error('❌ 迁移失败:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
