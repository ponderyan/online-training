import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== 当前数据状态 ===\n');

  const questions = await prisma.question.findMany({
    select: { id: true, type: true, content: true },
    take: 20,
  });
  console.log(`题库共 ${questions.length} 题:`);
  for (const q of questions) {
    console.log(`  [#${q.id}] ${q.type} — ${q.content.slice(0, 40)}`);
  }

  const paper = await prisma.paper.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, name: true, status: true, totalScore: true },
  });
  console.log(`\n试卷: #${paper?.id} ${paper?.name} (${paper?.status}, ${paper?.totalScore}分)`);

  const pqs = await prisma.paperQuestion.findMany({
    where: { paperId: paper?.id },
    select: { id: true, questionId: true, score: true },
  });
  const totalScore = pqs.reduce((s, q) => s + q.score, 0);
  console.log(`试卷题目: ${pqs.length} 题, 总分 ${totalScore}`);

  const users = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true },
    take: 20,
  });
  console.log('\n用户:');
  for (const u of users) {
    const roles = await prisma.userRoleAssignment.findMany({
      where: { userId: u.id },
      include: { role: { select: { name: true, code: true } } },
    });
    console.log(`  [#${u.id}] ${u.username} (${u.displayName}) — 角色: ${roles.map(r => r.role.code).join(', ')}`);
  }

  const sessions = await prisma.examSession.findMany({
    select: { id: true, examId: true, studentId: true, status: true, scoringStatus: true },
    take: 10,
  });
  console.log(`\n考试记录: ${sessions.length} 条`);
  for (const s of sessions) {
    console.log(`  [#${s.id}] exam=${s.examId}, student=${s.studentId}, status=${s.status}, scoringStatus=${s.scoringStatus}`);
  }

  const exams = await prisma.exam.findMany({
    select: { id: true, title: true, paperId: true, startTime: true, endTime: true },
    take: 10,
  });
  console.log(`\n考试: ${exams.length} 场`);
  for (const e of exams) {
    console.log(`  [#${e.id}] ${e.title} (paper=${e.paperId})`);
  }
}

main()
  .catch(e => { console.error(e); })
  .finally(() => prisma.$disconnect());
