/**
 * 回填脚本：为已有的 DataDictionary 条目创建对应的 Subject（科目）
 *
 * 因为之前 settings/page.tsx 中 dictionaryId: 0 的 bug，
 * 通过设置页面添加的字典条目都未能同步创建 Subject。
 *
 * 运行：pnpm tsx scripts/backfill-subjects.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dicts = await prisma.dataDictionary.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`找到 ${dicts.length} 个字典条目\n`);

  let created = 0;
  let skipped = 0;

  for (const dict of dicts) {
    // 检查是否已有同 code 的 Subject
    const existing = await prisma.subject.findFirst({
      where: { code: dict.code },
    });

    if (existing) {
      console.log(`  ✅ ${dict.code} — ${dict.name} → 已有 Subject (id=${existing.id})`);
      skipped++;
      continue;
    }

    await prisma.subject.create({
      data: {
        name: dict.name,
        code: dict.code,
        dictionaryId: dict.id,
        sortOrder: dict.sortOrder,
      },
    });
    console.log(`  ➕ ${dict.code} — ${dict.name} → 已创建 Subject`);
    created++;
  }

  console.log(`\n完成！创建 ${created} 个，跳过 ${skipped} 个。`);
}

main()
  .catch((e) => { console.error('失败:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
