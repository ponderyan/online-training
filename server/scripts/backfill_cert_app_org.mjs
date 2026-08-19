/**
 * 回填存量证书申请的机构归属（2026-08-16）
 * 背景：CertificateApplication 新增 orgId 字段，此前创建的申请 orgId=null（无隔离）。
 * 规则：按 session → exam → (exam.orgId ?? exam.program.orgId ?? null) 解析回填。
 * 运行：cd server && node backfill_cert_app_org.mjs
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
let assigned = 0, unresolved = 0;

const apps = await p.certificateApplication.findMany({ where: { orgId: null }, select: { id: true, sessionId: true } });
console.log(`待回填申请：${apps.length} 条`);

for (const app of apps) {
  const session = await p.examSession.findUnique({
    where: { id: app.sessionId },
    include: { exam: { include: { program: { select: { orgId: true } } } } },
  });
  const exam = session?.exam;
  const certOrgId = exam?.orgId ?? exam?.program?.orgId ?? null;
  if (certOrgId == null) { unresolved++; }
  else { assigned++; }
  await p.certificateApplication.update({ where: { id: app.id }, data: { orgId: certOrgId } });
}

console.log(`✅ 回填完成：已归属机构 ${assigned} 条，无法解析（保持平台级 null）${unresolved} 条`);
await p.$disconnect();
process.exitCode = 0;
