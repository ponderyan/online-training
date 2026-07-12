import { PrismaService } from '../modules/prisma/prisma.service.js';

/** 主观题题型（需要人工评分 / AI辅助评分） */
export const SUBJECTIVE_TYPES = new Set(['SHORT_ANSWER', 'CASE_STUDY']);

/** 客观题题型（系统自动判分） */
export const OBJECTIVE_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']);

/**
 * 重算 ExamSession 所有成绩字段
 * 在评分/复核改分/申诉批准后调用，确保 session 级汇总字段一致
 */
export async function recalculateSessionScore(
  prisma: PrismaService,
  sessionId: number,
) {
  // 查出该 session 的所有 answer
  const allAnswers = await prisma.examAnswer.findMany({
    where: { sessionId },
  });

  // 查出所有 paperQuestion 的 type
  const paperQuestions = await prisma.paperQuestion.findMany({
    where: { id: { in: allAnswers.map(a => a.paperQuestionId) } },
    include: { question: { select: { type: true } } },
  });
  const pqTypeMap = new Map(paperQuestions.map(pq => [pq.id, pq.question.type]));

  // 主观题总分
  const subjectiveScore = allAnswers
    .filter(a => {
      const qType = pqTypeMap.get(a.paperQuestionId);
      return a.score !== null && qType && SUBJECTIVE_TYPES.has(qType);
    })
    .reduce((sum, a) => sum + (a.score || 0), 0);

  // 总得分
  const totalScore = allAnswers
    .filter(a => a.score !== null)
    .reduce((sum, a) => sum + (a.score || 0), 0);

  // 是否还有未评主观题
  const remainingSubjective = allAnswers
    .filter(a => {
      const qType = pqTypeMap.get(a.paperQuestionId);
      return a.score === null && qType && SUBJECTIVE_TYPES.has(qType);
    })
    .length;

  // 获取 passingScore
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { exam: { include: { paper: true } } },
  });
  const paperTotal = session?.exam?.paper?.totalScore || 100;
  const passingScore = session?.exam?.passingScore ?? Math.floor(paperTotal * 0.6);

  // 更新 session
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      subjectiveScore,
      totalScore,
      finalScore: totalScore,
      isPassed: totalScore >= passingScore,
      scoringStatus: remainingSubjective === 0 ? 'GRADED' : 'GRADING',
    },
  });

  return { subjectiveScore, totalScore, isPassed: totalScore >= passingScore };
}
