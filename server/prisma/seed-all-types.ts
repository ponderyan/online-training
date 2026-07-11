/**
 * Seed: 全题型测试数据
 * 6 种题型各 3 题，创建一个全题型测试考试
 * 幂等（检查 paper.name 是否已存在）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.paper.findFirst({ where: { name: '全题型综合测试' } });
  if (existing) {
    console.log('全题型测试数据已存在，跳过');
    return;
  }

  // 1. 创建科目
  let subject = await prisma.subject.findFirst({ where: { code: 'ALL' } });
  if (!subject) {
    const dict = await prisma.dataDictionary.findFirst();
    subject = await prisma.subject.create({
      data: { name: '全题型综合', code: 'ALL', dictionaryId: dict!.id, sortOrder: 99 },
    });
  }

  // 2. 创建章节
  const chapter = await prisma.chapter.create({
    data: { subjectId: subject.id, name: '综合测试', sortOrder: 1 },
  });

  // 3. 创建题目 - 每种题型 3 题
  const sharedOpts = [
    { label: 'A', content: '选项一' },
    { label: 'B', content: '选项二' },
    { label: 'C', content: '选项三' },
    { label: 'D', content: '选项四' },
  ];

  // SINGLE_CHOICE × 3
  const sc1 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SINGLE_CHOICE', content: '以下哪项是数字化转型的核心驱动力？', analysis: '数据驱动是数字化转型的核心', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [...sharedOpts.slice(0, 3), { label: 'D', content: '数据驱动', isCorrect: true }].map((o, i) => ({ questionId: sc1.id, ...o, sortOrder: i, isCorrect: o.label === 'D' })) });

  const sc2 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SINGLE_CHOICE', content: 'ITIL 4 中"服务价值系统"包含几个组件？', analysis: 'ITIL 4 SVS 包含 5 个组件', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [{ label: 'A', content: '3 个', isCorrect: false }, { label: 'B', content: '4 个', isCorrect: false }, { label: 'C', content: '5 个', isCorrect: true }, { label: 'D', content: '6 个', isCorrect: false }].map((o, i) => ({ questionId: sc2.id, ...o, sortOrder: i })) });

  const sc3 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SINGLE_CHOICE', content: 'PDCA 循环中"C"代表什么？', analysis: 'PDCA: Plan-Do-Check-Act', difficulty: 'EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [{ label: 'A', content: '控制', isCorrect: false }, { label: 'B', content: '检查', isCorrect: true }, { label: 'C', content: '创造', isCorrect: false }, { label: 'D', content: '沟通', isCorrect: false }].map((o, i) => ({ questionId: sc3.id, ...o, sortOrder: i })) });

  // MULTIPLE_CHOICE × 3
  const mc1 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'MULTIPLE_CHOICE', content: '以下哪些属于 IT 服务管理的核心流程？（多选）', analysis: '事件管理、问题管理、变更管理是核心流程', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [{ label: 'A', content: '事件管理', isCorrect: true }, { label: 'B', content: '问题管理', isCorrect: true }, { label: 'C', content: '财务管理', isCorrect: false }, { label: 'D', content: '变更管理', isCorrect: true }].map((o, i) => ({ questionId: mc1.id, ...o, sortOrder: i })) });

  const mc2 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'MULTIPLE_CHOICE', content: '数字化转型的关键要素包括？（多选）', analysis: '数字化转型需要战略、技术、人才、数据的协同', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [{ label: 'A', content: '数字化战略', isCorrect: true }, { label: 'B', content: '技术平台', isCorrect: true }, { label: 'C', content: '仅购买软件', isCorrect: false }, { label: 'D', content: '数字化人才', isCorrect: true }].map((o, i) => ({ questionId: mc2.id, ...o, sortOrder: i })) });

  const mc3 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'MULTIPLE_CHOICE', content: 'ITSS 标准体系的构成要素包括？（多选）', analysis: 'ITSS 四要素：人员、流程、技术、资源', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionOption.createMany({ data: [{ label: 'A', content: '人员', isCorrect: true }, { label: 'B', content: '流程', isCorrect: true }, { label: 'C', content: '技术', isCorrect: true }, { label: 'D', content: '资源', isCorrect: true }].map((o, i) => ({ questionId: mc3.id, ...o, sortOrder: i })) });

  // TRUE_FALSE × 3
  const tf1 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'TRUE_FALSE', content: '数字化转型只是一次性的技术升级项目。', analysis: '数字化转型是持续的组织变革过程', difficulty: 'EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  const tf2 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'TRUE_FALSE', content: 'ITIL 4 仍然支持 ITIL v3 的核心流程。', analysis: 'ITIL 4 兼容并扩展了 v3 的核心流程', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  const tf3 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'TRUE_FALSE', content: 'SLA（服务级别协议）只需要定义服务范围，不需要约定考核指标。', analysis: 'SLA 必须包含明确的服务指标和考核标准', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });

  // FILL_BLANK × 3
  const fb1 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'FILL_BLANK', content: 'PDCA 循环中，P 代表{{_}}，D 代表{{_}}，C 代表检查，A 代表改进。', analysis: 'PDCA: Plan(计划)-Do(执行)-Check(检查)-Act(改进)', difficulty: 'EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionBlank.createMany({ data: [{ questionId: fb1.id, blankIndex: 0, answer: '计划' }, { questionId: fb1.id, blankIndex: 1, answer: '执行' }] });

  const fb2 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'FILL_BLANK', content: 'ITSS 的四要素是人员、流程、{{_}}和{{_}}。', analysis: 'ITSS 四要素：人员、流程、技术、资源', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionBlank.createMany({ data: [{ questionId: fb2.id, blankIndex: 0, answer: '技术' }, { questionId: fb2.id, blankIndex: 1, answer: '资源' }] });

  const fb3 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'FILL_BLANK', content: 'CMDB 的中文全称是{{_}}。', analysis: 'CMDB: Configuration Management Database 配置管理数据库', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });
  await prisma.questionBlank.createMany({ data: [{ questionId: fb3.id, blankIndex: 0, answer: '配置管理数据库' }] });

  // SHORT_ANSWER × 3
  const sa1 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SHORT_ANSWER', content: '简述数字化转型的三大核心要素。', analysis: '战略引领、数据驱动、技术赋能是数字化转型的核心', difficulty: 'MEDIUM_EASY', source: 'MANUAL', status: 'PUBLISHED' } });
  const sa2 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SHORT_ANSWER', content: '什么是 ITIL 4 的服务价值系统（SVS）？它包含哪些组件？', analysis: 'SVS 是 ITIL 4 的核心框架，包含指导原则、治理、服务价值链、实践和持续改进', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });
  const sa3 = await prisma.question.create({ data: { subjectId: subject.id, chapterId: chapter.id, type: 'SHORT_ANSWER', content: '解释事件管理与问题管理的区别。', analysis: '事件管理关注快速恢复服务，问题管理关注根因分析', difficulty: 'MEDIUM_HARD', source: 'MANUAL', status: 'PUBLISHED' } });

  // 4. 创建试卷 (18 题, 总分 100)
  const paper = await prisma.paper.create({
    data: {
      name: '全题型综合测试', paperNumber: 'ALL-20260711-001', subjectId: subject.id,
      totalScore: 100, durationMinutes: 60, isOpenBook: false, status: 'FINALIZED',
      createdBy: 1, finalizedAt: new Date(),
    },
  });

  // 关联题目到试卷
  const allQuestions = [sc1, sc2, sc3, mc1, mc2, mc3, tf1, tf2, tf3, fb1, fb2, fb3, sa1, sa2, sa3];
  const scores = [5, 5, 5, 8, 8, 8, 5, 5, 5, 6, 6, 6, 10, 10, 10]; // 5+5+5+8+8+8+5+5+5+6+6+6+10+10+10 = 106... close enough
  // Adjust to 100
  scores[14] = 6; // sa3 = 6 -> total 96
  scores[0] = 8;  // sc1 = 8 -> total 99
  scores[3] = 6;  // mc1 = 6 -> total 97
  // Let's just set to 100 and distribute evenly
  const finalScores = [8, 6, 6, 8, 8, 6, 5, 5, 5, 6, 6, 6, 10, 10, 5]; // Sum = 100

  for (let i = 0; i < allQuestions.length; i++) {
    await prisma.paperQuestion.create({
      data: { paperId: paper.id, questionId: allQuestions[i].id, sortOrder: i, score: finalScores[i], typeSection: allQuestions[i].type },
    });
  }

  // 5. 创建考试 (timeMode: FLEXIBLE)
  const exam = await prisma.exam.create({
    data: {
      title: '全题型综合测试', paperId: paper.id,
      startTime: new Date('2026-07-11'), endTime: new Date('2026-12-31'),
      durationMinutes: 60, accessType: 'FLEXIBLE', maxAttempts: 3,
      isOpenBook: false, shuffleQuestions: true, shuffleOptions: true,
      status: 'PUBLISHED', passingScore: 60, maxRetakeAttempts: 2, retakeWindowDays: 30,
      createdBy: 1, timeMode: 'FLEXIBLE', paperMode: 'SAME',
    },
  });

  // 6. 分配所有学员
  const students = await prisma.user.findMany({ where: { username: { startsWith: 'stu' } }, select: { id: true } });
  for (const s of students) {
    await prisma.examSession.upsert({
      where: { examId_studentId: { examId: exam.id, studentId: s.id } },
      update: {},
      create: { examId: exam.id, studentId: s.id, status: 'ASSIGNED', remainingTime: 3600 },
    });
  }

  console.log(`✅ 全题型测试已就绪: 试卷(${paper.id}) 考试(${exam.id})  ${allQuestions.length}题/100分 学员${students.length}人`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
