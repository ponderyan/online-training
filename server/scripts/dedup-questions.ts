/**
 * Step 0b: 清理重复试题
 *
 * 保留每组的第一个（最早创建的、被试卷引用的），其余标记 ARCHIVED
 * 用法: npx tsx scripts/dedup-questions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 清理 Subject 1 重复试题...\n');

  const questions = await prisma.question.findMany({
    where: { subjectId: 1, status: { not: 'ARCHIVED' } },
    include: { _count: { select: { paperQuestions: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  // 按 content 分组
  const groups = new Map<string, typeof questions>();
  for (const q of questions) {
    const key = q.content.trim();
    const existing = groups.get(key) || [];
    existing.push(q);
    groups.set(key, existing);
  }

  let removed = 0;
  for (const [content, items] of groups) {
    if (items.length <= 1) continue;

    // 保留第一个（最早创建/有引用的），其余清理
    const [keep, ...toRemove] = items;
    for (const q of toRemove) {
      await prisma.question.update({
        where: { id: q.id },
        data: { status: 'ARCHIVED' },
      });
      removed++;
      console.log(`  [#${q.id}] → ARCHIVED (保留 #${keep.id})`);
    }
  }

  console.log(`\n✅ 清理完成: ${removed} 题标记为 ARCHIVED`);
  console.log(`   剩余活跃题: ${questions.length - removed}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
