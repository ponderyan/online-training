/**
 * 回填历史证书的 templateId（用于"使用次数"统计）
 * 逻辑与 certificates.service.generatePdf 的模板选择保持一致：
 *   取证书所属组织的默认 COMPLETION 模板（isDefault && isActive）
 * 用法：node scripts/backfill-cert-template-usage.mjs
 * 幂等：仅处理 templateId 为 null 的证书，可重复执行
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const certs = await p.certificate.findMany({
  where: { templateId: null },
  select: { id: true, orgId: true },
});
console.log(`待回填证书数: ${certs.length}`);

let updated = 0, skipped = 0;
for (const c of certs) {
  const tpl = await p.certificateTemplate.findFirst({
    where: { orgId: c.orgId ?? undefined, type: 'COMPLETION', isDefault: true, isActive: true },
    select: { id: true },
  });
  if (tpl) {
    await p.certificate.update({ where: { id: c.id }, data: { templateId: tpl.id } });
    updated++;
  } else {
    skipped++;
  }
}
console.log(`回填完成: 更新 ${updated} 条, 跳过 ${skipped} 条（无匹配的组织默认模板）`);
await p.$disconnect();
