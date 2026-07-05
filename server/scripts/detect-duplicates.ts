/**
 * Step 0: 检测 Subject 1 中的重复试题
 *
 * 用法: npx tsx scripts/detect-duplicates.ts
 *
 * 输出重复组清单（含题号、内容摘要、选项数、创建时间），不执行任何修改。
 * 输出结果给管理员确认后再执行清理。
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检测 Subject 1 重复试题...\n');

  // 获取 Subject 1 的所有题目
  const questions = await prisma.question.findMany({
    where: { subjectId: 1, status: { not: 'ARCHIVED' } },
    include: {
      options: { select: { label: true, content: true, isCorrect: true } },
      _count: { select: { paperQuestions: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`共 ${questions.length} 道有效题目\n`);

  // 按 content 分组
  const groups = new Map<string, typeof questions>();
  for (const q of questions) {
    const key = q.content.trim();
    const existing = groups.get(key) || [];
    existing.push(q);
    groups.set(key, existing);
  }

  // 过滤出重复组
  const dupGroups = Array.from(groups.entries())
    .filter(([_, items]) => items.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`📋 发现 ${dupGroups.length} 组重复题目（共 ${dupGroups.reduce((s, g) => s + g[1].length, 0)} 道）\n`);

  let totalDuplicates = 0;
  for (const [content, items] of dupGroups) {
    totalDuplicates += items.length - 1; // 保留1条，其余算重复
    console.log(`─────────────── 重复组 ───────────────`);
    console.log(`题干: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`);
    console.log(`重复数: ${items.length}`);

    for (const q of items) {
      const optDesc = q.options.map(o => `${o.label}:${o.content.slice(0, 20)}`).join(' | ');
      console.log(`  [#${q.id}] ${q.type} | 选项: ${optDesc.slice(0, 80)} | 引用: ${q._count.paperQuestions}次 | ${q.createdAt.toISOString().slice(0, 10)}`);
    }
    console.log('');
  }

  console.log(`\n📊 汇总`);
  console.log(`  总题目数:       ${questions.length}`);
  console.log(`  重复组数:       ${dupGroups.length}`);
  console.log(`  重复题目数:     ${totalDuplicates}（建议保留 ${dupGroups.length} 题，清理 ${totalDuplicates} 题）`);
  console.log(`  清理后预计:     ${questions.length - totalDuplicates} 题`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ 检测失败:', e);
  process.exit(1);
});
