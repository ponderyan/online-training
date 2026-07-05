/**
 * ④ 种子数据：DT 考点 ↔ 课程关联
 *
 * Course id=2（数字化转型核心课程）→ 全部5个DT考点
 * VideoCourse 需要关联到考点，但 CourseKnowledgePoint 表关联的是 Course，
 * 后续通过另一个机制关联 VideoCourse
 *
 * 用法: npx tsx scripts/seed-course-kp.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 播种课程-考点关联...\n');

  // 查 DT 考点（用 code，不写死 ID）
  const kps = await prisma.knowledgePoint.findMany({
    where: { code: { startsWith: 'DT_' } },
    select: { id: true, name: true, code: true },
  });
  const kpMap = new Map(kps.map(k => [k.code, k]));
  console.log('DT 考点:', kps.map(k => `#${k.id} ${k.name}`).join(', '));

  // 查课程
  const course = await prisma.course.findFirst({
    where: { code: 'CORE-DT-001' },
    select: { id: true, name: true },
  });
  if (!course) { console.error('❌ 课程未找到'); return; }
  console.log(`课程: #${course.id} ${course.name}`);

  // 课程关联所有5个DT考点
  const courseLinks = [];
  for (const kp of kps) {
    courseLinks.push({ courseId: course.id, knowledgePointId: kp.id, weight: 1.0 });
  }
  await prisma.courseKnowledgePoint.deleteMany({ where: { courseId: course.id } });
  await prisma.courseKnowledgePoint.createMany({ data: courseLinks });
  console.log(`✅ 课程 #${course.id} → ${courseLinks.length} 个考点关联完成`);

  console.log(`\n📊 汇总`);
  console.log(`  课程关联: ${courseLinks.length} 条`);

  // 打印完整清单供人工核验
  console.log(`\n📋 关联清单（请逐条核验）:`);
  for (const link of courseLinks) {
    const kp = kps.find(k => k.id === link.knowledgePointId);
    console.log(`  [#${link.courseId}] ${course.name} → [#${link.knowledgePointId}] ${kp?.name} (weight=${link.weight})`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
