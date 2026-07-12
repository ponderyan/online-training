import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========== 测试数据生成：阅卷隔离效果演示 ==========\n');

  // ========== 1. 查找基础数据 ==========

  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) throw new Error('admin not found');

  const lecturer01 = await prisma.user.findUnique({ where: { username: 'lecturer01' } });
  if (!lecturer01) throw new Error('lecturer01 not found');

  const examOfficer = await prisma.user.findUnique({ where: { username: 'exam_officer' } });
  if (!examOfficer) throw new Error('exam_officer not found');

  const students = await prisma.user.findMany({
    where: { username: { in: ['stu001', 'stu002', 'stu003'] } },
  });
  console.log(`学员: ${students.map(s => `${s.displayName}(#${s.id})`).join(', ')}`);

  // 查找讲师关联
  let graderInstructor = await prisma.instructor.findFirst({ where: { userId: lecturer01.id } });
  if (!graderInstructor) {
    graderInstructor = await prisma.instructor.create({
      data: {
        userId: lecturer01.id, realName: '李讲师', title: '高级讲师',
        type: 'INTERNAL', workUnit: '中电标协', level: 'SENIOR', isGrader: true,
        instructorNo: 'INS-LECTURER01',
      },
    });
    console.log(`  ✅ 创建李讲师 instructor: #${graderInstructor.id}`);
  }
  let officerInstructor = await prisma.instructor.findFirst({ where: { userId: examOfficer.id } });
  if (!officerInstructor) {
    officerInstructor = await prisma.instructor.create({
      data: {
        userId: examOfficer.id, realName: '考务员小王', title: '考务专员',
        type: 'INTERNAL', workUnit: '中电标协', level: 'JUNIOR', isGrader: true,
        instructorNo: 'INS-EXAMOFFICER',
      },
    });
    console.log(`  ✅ 创建考务员 instructor: #${officerInstructor.id}`);
  }

  // ========== 2. 查找或创建考试 ==========
  // 使用已有的 exam #101 (全题型综合测试)，在其 paper #101 上增加主观题

  const exam = await prisma.exam.findUnique({
    where: { id: 101 },
    include: { paper: { include: { questions: true } } },
  });
  if (!exam) throw new Error('exam #101 not found');
  console.log(`\n考试: #${exam.id} ${exam.title} (paper #${exam.paperId})`);

  // 检查是否已有主观题
  const existingQuestionIds = exam.paper.questions.map(pq => pq.questionId);
  console.log(`  试卷现有 ${existingQuestionIds.length} 题`);

  const existingQuestions = await prisma.question.findMany({
    where: { id: { in: existingQuestionIds }, type: { in: ['SHORT_ANSWER', 'CASE_STUDY'] } },
  });

  if (existingQuestions.length > 0) {
    console.log(`  已有 ${existingQuestions.length} 道主观题，跳过创建`);
  }

  // ========== 3. 创建主观题 ==========
  // 需要 subjectId=1, chapterId — 随便用一个已有的
  const aChapter = await prisma.chapter.findFirst({ where: { subjectId: 1 } });
  if (!aChapter) throw new Error('no chapter found');

  let saQuestion, csQuestion;

  if (existingQuestions.length < 2) {
    // 简答题
    saQuestion = await prisma.question.create({
      data: {
        type: 'SHORT_ANSWER',
        difficulty: 'MEDIUM_EASY',
        source: 'MANUAL',
        status: 'PUBLISHED',
        content: '请简述数字化转型中"数据驱动决策"的核心流程。',
        analysis: '数据驱动决策的核心流程包括：数据采集→数据清洗→数据分析→洞察输出→决策执行→效果评估，形成闭环。',
        subjectId: 1,
        chapterId: aChapter.id,
        createdBy: admin.id,
      },
    });
    console.log(`  ✅ 创建简答题 #${saQuestion.id}`);

    // 案例题
    csQuestion = await prisma.question.create({
      data: {
        type: 'CASE_STUDY',
        difficulty: 'HARD',
        source: 'MANUAL',
        status: 'PUBLISHED',
        content: '案例：某制造企业年营收50亿，面临产能过剩和利润率下滑。IT部门上线了ERP、MES等系统，但各系统数据孤岛严重，管理层无法实时掌握产能利用率。企业决定启动数字化转型，由CIO牵头成立转型办。\n\n问题：1) 该企业数字化转型面临哪些核心挑战？2) 应如何设计分阶段实施路径？',
        analysis: '核心挑战：数据孤岛、组织协同阻力、技术人才短缺、投入产出不明确。分阶段路径：第一阶段统一数据标准打通核心系统；第二阶段上BI和数据中台实现可视化运营；第三阶段引入AI优化生产计划和质检。',
        subjectId: 1,
        chapterId: aChapter.id,
        createdBy: admin.id,
      },
    });
    console.log(`  ✅ 创建案例题 #${csQuestion.id}`);

    // 加到试卷
    const maxSort = Math.max(...exam.paper.questions.map(pq => pq.sortOrder), 0);
    const pqSA = await prisma.paperQuestion.create({
      data: {
        paperId: exam.paperId,
        questionId: saQuestion.id,
        sortOrder: maxSort + 1,
        score: 15,
        typeSection: 'SHORT_ANSWER',
      },
    });
    console.log(`  ✅ 简答题加入试卷: PaperQuestion #${pqSA.id} (15分)`);

    const pqCS = await prisma.paperQuestion.create({
      data: {
        paperId: exam.paperId,
        questionId: csQuestion.id,
        sortOrder: maxSort + 2,
        score: 25,
        typeSection: 'CASE_STUDY',
      },
    });
    console.log(`  ✅ 案例题加入试卷: PaperQuestion #${pqCS.id} (25分)`);

    // 更新试卷总分
    const allPQs = await prisma.paperQuestion.findMany({ where: { paperId: exam.paperId } });
    const newTotal = allPQs.reduce((s, pq) => s + pq.score, 0);
    await prisma.paper.update({
      where: { id: exam.paperId },
      data: { totalScore: newTotal },
    });
    console.log(`  ✅ 试卷总分更新为 ${newTotal} 分`);
  } else {
    saQuestion = existingQuestions.find(q => q.type === 'SHORT_ANSWER');
    csQuestion = existingQuestions.find(q => q.type === 'CASE_STUDY');
    console.log(`  使用已有主观题: SA #${saQuestion?.id}, CS #${csQuestion?.id}`);
  }

  // ========== 4. 获取所有 PaperQuestion IDs ==========
  const allPQs = await prisma.paperQuestion.findMany({
    where: { paperId: exam.paperId },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`\n试卷题目 (${allPQs.length} 题):`);
  for (const pq of allPQs) {
    const q = await prisma.question.findUnique({ where: { id: pq.questionId }, select: { type: true, content: true } });
    console.log(`  PQ #${pq.id} → Q #${pq.questionId} [${q?.type}] ${pq.score}分 — ${q?.content?.slice(0, 50)}`);
  }

  // ========== 5. 创建考试记录（交卷） ==========
  const studentsToSubmit = students; // 全部3人
  const subjectivePQIds = allPQs.filter(pq =>
    pq.typeSection === 'SHORT_ANSWER' || pq.typeSection === 'CASE_STUDY'
  ).map(pq => pq.id);
  const objectivePQIds = allPQs.filter(pq =>
    !pq.typeSection || !['SHORT_ANSWER', 'CASE_STUDY'].includes(pq.typeSection)
  ).map(pq => pq.id);

  console.log(`\n客观题 PQ IDs: ${objectivePQIds.join(', ')}`);

  for (const student of studentsToSubmit) {
    // 检查是否有已有交卷记录
    let session = await prisma.examSession.findFirst({
      where: { examId: exam.id, studentId: student.id },
    });

    if (session && session.status === 'SUBMITTED') {
      console.log(`  [${student.displayName}] 已有交卷记录 #${session.id}，跳过`);
      continue;
    }

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          examId: exam.id,
          studentId: student.id,
          status: 'SUBMITTED',
          scoringStatus: 'PENDING',
          startedAt: new Date('2026-07-10T09:00:00Z'),
          submittedAt: new Date('2026-07-10T10:00:00Z'),
        },
      });
    } else {
      // 更新为提交状态
      session = await prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'SUBMITTED', scoringStatus: 'PENDING', submittedAt: new Date('2026-07-10T10:00:00Z') },
      });
    }
    console.log(`  [${student.displayName}] 交卷记录 #${session.id}`);

    // 创建各题答案
    const existingAnswers = await prisma.examAnswer.findMany({
      where: { sessionId: session.id },
      select: { paperQuestionId: true },
    });
    const answeredPQIds = new Set(existingAnswers.map(a => a.paperQuestionId));

    for (const pq of allPQs) {
      if (answeredPQIds.has(pq.id)) continue;

      const q = await prisma.question.findUnique({
        where: { id: pq.questionId },
        select: { type: true },
      });
      if (!q) continue;

      let answer: any;
      let isCorrect: boolean | null = null;

      if (q.type === 'SINGLE_CHOICE') {
        const choices = ['A', 'B', 'C', 'D'];
        answer = JSON.stringify(choices[Math.floor(Math.random() * choices.length)]);
        isCorrect = null; // 需要自动判分
      } else if (q.type === 'MULTIPLE_CHOICE') {
        const choices = ['A', 'B', 'C'];
        answer = JSON.stringify(choices.slice(0, 2));
        isCorrect = null;
      } else if (q.type === 'TRUE_FALSE') {
        answer = JSON.stringify(Math.random() > 0.5 ? 'A' : 'B');
        isCorrect = null;
      } else if (q.type === 'SHORT_ANSWER') {
        answer = JSON.stringify('数据驱动决策的核心流程包括：首先需要建立统一的数据采集标准，确保各业务系统数据能够汇聚到数据平台；其次进行数据清洗和治理，保证数据质量；然后是数据分析环节，通过BI工具和统计方法发现业务规律和问题；最后将分析结果转化为可执行的决策建议，并跟踪执行效果形成闭环反馈。');
        isCorrect = null;
      } else if (q.type === 'CASE_STUDY') {
        answer = JSON.stringify('1) 核心挑战：数据孤岛严重，ERP、MES等系统间数据不互通；管理层缺少实时可视化决策工具；组织内部存在变革阻力，各部门不愿共享数据；缺乏数字化人才，技术能力不足；投入产出不清晰，难以说服董事会持续投入。\n\n2) 分阶段实施路径：第一阶段（0-6个月）—成立数据治理委员会，制定数据标准，打通ERP和MES数据接口；第二阶段（6-12个月）—建设数据中台和BI可视化平台，实现产能利用率和质量指标的实时监控；第三阶段（12-24个月）—引入AI预测模型优化生产排程，建立智能质检系统。');
        isCorrect = null;
      }

      if (answer) {
        await prisma.examAnswer.create({
          data: {
            sessionId: session.id,
            questionId: pq.questionId,
            paperQuestionId: pq.id,
            answer,
            isCorrect,
          },
        });
      }
    }
    console.log(`  [${student.displayName}] 答案已生成 (${allPQs.length} 题)`);
  }

  // ========== 6. 创建阅卷分派 ==========
  // graderId 引用 User（不是 Instructor）— 分别是 lecturer01(#18), exam_officer(#19)
  // stu001 → 李讲师 (lecturer01, userId=18) 阅卷
  // stu002 → 考务员小王 (exam_officer, userId=19) 阅卷
  // stu003 → 不分配（做"未分派"对比效果）

  const assignments: Array<{
    grader: typeof lecturer01;
    student: typeof students[0];
    label: string;
  }> = [
    { grader: lecturer01, student: students.find(s => s.username === 'stu001')!, label: 'stu001→李讲师' },
    { grader: examOfficer, student: students.find(s => s.username === 'stu002')!, label: 'stu002→考务员' },
    // stu003 intentionally not assigned
  ];

  // 获取3人的考试记录
  for (const a of assignments) {
    const session = await prisma.examSession.findFirst({
      where: { examId: exam.id, studentId: a.student.id, status: 'SUBMITTED' },
    });
    if (!session) {
      console.log(`  [${a.label}] 无交卷记录，跳过`);
      continue;
    }

    // 清除已有的分派
    await prisma.gradingAssignment.deleteMany({
      where: { examId: exam.id, graderId: a.grader.id },
    });

    // 为该学员的所有主观题创建分派
    for (const pqId of subjectivePQIds) {
      await prisma.gradingAssignment.create({
        data: {
          examId: exam.id,
          graderId: a.grader.id,
          paperQuestionId: pqId,
          sessionId: session.id,
          status: 'ASSIGNED',
        },
      });
    }
    console.log(`  [${a.label}] ✅ 已分派 ${subjectivePQIds.length} 道主观题`);
  }
  console.log(`\n  [stu003→未分配] ⏭️ 故意不分配，做对比`);

  // ========== 7. 列出最终状态 ==========
  console.log('\n========== 最终数据状态 ==========\n');

  const allSessions = await prisma.examSession.findMany({
    where: { examId: exam.id },
    include: { student: { select: { displayName: true, username: true } } },
    orderBy: { id: 'asc' },
  });

  console.log(`考试 #${exam.id} "${exam.title}" 的学员记录:`);
  for (const s of allSessions) {
    console.log(`  [#${s.id}] ${s.student.displayName}(${s.student.username}) — ${s.status} / ${s.scoringStatus}`);
  }

  const allGradingAssignments = await prisma.gradingAssignment.findMany({
    where: { examId: exam.id },
    include: {
      grader: { select: { displayName: true, username: true } },
      session: { include: { student: { select: { displayName: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`\n阅卷分派记录 (共 ${allGradingAssignments.length} 条):`);
  for (const ga of allGradingAssignments) {
    console.log(`  [#${ga.id}] ${ga.grader.displayName}(${ga.grader.username}) → ${ga.session.student.displayName} [PQ #${ga.paperQuestionId}] ${ga.status}`);
  }

  console.log('\n========== ✅ 测试数据生成完毕 ==========');
  console.log('\n查看效果方式:');
  console.log('  1. 启动 dev server');
  console.log('  2. 登录 lecturer01/123456 → 进阅卷页面 → 应看到 stu001 可评，stu002/stu003 不可见');
  console.log('  3. 登录 exam_officer/123456 → 应看到 stu002 可评，stu001/stu003 不可见');
  console.log('  4. 登录 admin/123456 → 应看到所有学员');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
