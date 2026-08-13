/**
 * 最小角色恢复脚本（2026-08-14）
 * 背景：seed 用户的 role assignments 被清空（admin/stu001 等 roles=[]），导致 vitest 集成测试 403。
 * 本脚本只按 seed.ts 的用户-角色映射做 userRoleAssignment.upsert，不碰任何其他数据
 * （系统配置/证书配置/业务字段均不动——重跑整个 seed 会覆盖 system_config，故不用）。
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const MAPPINGS = [
  ['admin', 'SUPER_ADMIN'],
  ['org_admin', 'ORG_ADMIN'],
  ['agency_admin', 'AGENCY_ADMIN'],
  ['lecturer01', 'LECTURER'],
  ['exam_officer', 'EXAM_OFFICER'],
  ['proctor01', 'PROCTOR'],
  ['auditor01', 'AUDITOR'],
  ['branch_admin', 'ORG_ADMIN'],
  ['dept_admin', 'ORG_ADMIN'],
  ['stu001', 'STUDENT'],
  ['stu002', 'STUDENT'],
  ['stu003', 'STUDENT'],
  ['stu004', 'STUDENT'],
  ['stu005', 'STUDENT'],
];

let restored = 0, missing = 0;

for (const [username, roleCode] of MAPPINGS) {
  const user = await p.user.findUnique({ where: { username }, select: { id: true } });
  const role = await p.role.findUnique({ where: { code: roleCode }, select: { id: true } });
  if (!user || !role) { missing++; console.log(`⏭ ${username}→${roleCode}: 用户或角色不存在（跳过）`); continue; }
  await p.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  restored++;
  console.log(`✅ ${username} → ${roleCode}`);
}

console.log(`\n恢复 ${restored} 条 / 跳过 ${missing} 条`);
await p.$disconnect();
