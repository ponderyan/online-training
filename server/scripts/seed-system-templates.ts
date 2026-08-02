/**
 * 种子脚本：创建系统内置证书模板（isSystem=true，平台级，不可删除/停用）
 * 复用前端预设库 TEMPLATE_PRESETS 作为单一数据源，避免画布定义重复维护
 * 用法：npx tsx scripts/seed-system-templates.ts
 * 幂等：按 (name + isSystem) 判断，可重复执行
 */
import { PrismaClient } from '@prisma/client';
import { TEMPLATE_PRESETS } from '../../client/src/lib/canvas-renderer/template-presets.js';

const prisma = new PrismaClient();
const SYSTEM_CREATOR = 1; // 系统内置（管理员）

async function main() {
  let created = 0, skipped = 0;
  for (const preset of TEMPLATE_PRESETS) {
    const existing = await prisma.certificateTemplate.findFirst({
      where: { name: preset.name, isSystem: true },
    });
    if (existing) { skipped++; console.log(`跳过(已存在): ${preset.name}`); continue; }
    await prisma.certificateTemplate.create({
      data: {
        name: preset.name,
        description: preset.description,
        type: preset.key === 'hours' ? 'HOURS' : 'COMPLETION',
        canvasJson: preset.canvas as any,
        isSystem: true,
        isActive: true,
        orgId: null, // 平台级，所有机构可见
        createdBy: SYSTEM_CREATOR,
      },
    });
    created++; console.log(`已创建系统内置模板: ${preset.name}`);
  }
  console.log(`\n完成: 新建 ${created} 个, 跳过 ${skipped} 个`);
}

main().finally(() => prisma.$disconnect());
