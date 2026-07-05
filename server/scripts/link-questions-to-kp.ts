/**
 * Step 2: 按 chapterId 批量关联 Subject 1 题目到 DT 考点
 *
 * 关联规则: chapterId → KP code（用 code 查 ID，不写死数字）
 * 用法: npx tsx scripts/link-questions-to-kp.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔗 关联 Subject 1 题目到 DT 考点...\n');

  // 用 code 查 KP 的实际 ID
  const kps = await prisma.knowledgePoint.findMany({
    where: { code: { in: ['DT_OVERVIEW', 'DT_DATA_DECISION', 'DT_AI_TECH', 'DT_ORG_TALENT', 'DT_DATA_GOV'] } },
  });
  const kpMap = new Map(kps.map(k => [k.code, k.id]));
  console.log('KP 映射:', Object.fromEntries(kpMap));

  // Chapter → KP code 映射
  const CHAPTER_KP: Record<number, string> = {
    1: 'DT_OVERVIEW',
    2: 'DT_DATA_DECISION',
    3: 'DT_AI_TECH',
    4: 'DT_ORG_TALENT',
    5: 'DT_DATA_GOV',
  };

  // 获取 Subject 1 的有效题目（非 ARCHIVED）
  const questions = await prisma.question.findMany({
    where: { subjectId: 1, status: { not: 'ARCHIVED' } },
    select: { id: true, chapterId: true },
  });
  console.log(`共 ${questions.length} 道有效题目\n`);

  let linked = 0;
  for (const q of questions) {
    const kpCode = CHAPTER_KP[q.chapterId];
    if (!kpCode) {
      console.warn(`  ⚠️ 题目 #${q.id} chapterId=${q.chapterId} 无对应 KP`);
      continue;
    }
    const kpId = kpMap.get(kpCode);
    if (!kpId) {
      console.warn(`  ⚠️ KP ${kpCode} 未找到`);
      continue;
    }
    await prisma.questionKnowledgePoint.upsert({
      where: { questionId_knowledgePointId: { questionId: q.id, knowledgePointId: kpId } },
      create: { questionId: q.id, knowledgePointId: kpId, weight: 1.0 },
      update: {},
    });
    linked++;
  }

  console.log(`\n✅ 关联完成: ${linked}/${questions.length} 题已关联到 KP`);
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
