import { PrismaService } from '../modules/prisma/prisma.service.js';

/** 主观题题型（需要人工评分 / AI辅助评分） */
export const SUBJECTIVE_TYPES = new Set(['SHORT_ANSWER', 'CASE_STUDY']);

/** 客观题题型（系统自动判分） */
export const OBJECTIVE_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']);

/**
 * 统一获取合格分数线
 * 语义：绝对分（非百分比）。若 exam.passingScore 未设置，默认取试卷满分的 60%。
 * 所有需要判定 isPassed 的地方必须调用此函数，避免 fallback 逻辑散落。
 */
export function getPassingScore(examPassingScore: number | null | undefined, paperTotalScore: number | undefined): number {
  if (examPassingScore != null && examPassingScore > 0) return examPassingScore;
  return Math.floor((paperTotalScore || 100) * 0.6);
}

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

  // 获取 passingScore（统一工具函数）
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { exam: { include: { paper: true } } },
  });
  const passingScore = getPassingScore(session?.exam?.passingScore, session?.exam?.paper?.totalScore);

  // ★ 修复：仅当所有主观题已评完时才判定 isPassed，否则留 null
  const allGraded = remainingSubjective === 0;
  const isPassed = allGraded ? totalScore >= passingScore : null;

  // 更新 session
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      subjectiveScore,
      totalScore,
      finalScore: allGraded ? totalScore : undefined,
      isPassed,
      scoringStatus: allGraded ? 'GRADED' : 'GRADING',
    },
  });

  return { subjectiveScore, totalScore, isPassed };
}
