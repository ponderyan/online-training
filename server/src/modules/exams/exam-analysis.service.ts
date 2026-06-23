import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ExamAnalysisService {
  constructor(private prisma: PrismaService) {}

  async getOverview(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: { select: { totalScore: true } },
        _count: { select: { sessions: true } },
      },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', finalScore: { not: null } },
      select: { finalScore: true, isPassed: true, studentId: true },
    });

    const totalEnrolled = exam._count.sessions;
    const submittedCount = sessions.length;
    const scores = sessions.map(s => s.finalScore!).sort((a, b) => a - b);
    const passCount = sessions.filter(s => s.isPassed).length;
    const failCount = sessions.filter(s => !s.isPassed).length;

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100
      : 0;
    const maxScore = scores.length > 0 ? scores[scores.length - 1] : 0;
    const minScore = scores.length > 0 ? scores[0] : 0;
    const medianScore = scores.length > 0
      ? scores.length % 2 === 0
        ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
        : scores[Math.floor(scores.length / 2)]
      : 0;
    const passRate = submittedCount > 0
      ? Math.round(passCount / submittedCount * 10000) / 100
      : 0;
    const attendanceRate = totalEnrolled > 0
      ? Math.round(submittedCount / totalEnrolled * 10000) / 100
      : 0;

    return {
      totalStudents: submittedCount,
      avgScore, maxScore, minScore, medianScore,
      passCount, failCount, passRate,
      submittedCount, totalEnrolled, attendanceRate,
      totalScore: exam.paper?.totalScore || 100,
    };
  }

  async getDistribution(examId: number) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', finalScore: { not: null } },
      select: { finalScore: true },
    });

    const buckets = [
      { range: '0-59', count: 0 },
      { range: '60-69', count: 0 },
      { range: '70-79', count: 0 },
      { range: '80-89', count: 0 },
      { range: '90-100', count: 0 },
    ];

    for (const s of sessions) {
      const score = s.finalScore!;
      if (score < 60) buckets[0].count++;
      else if (score < 70) buckets[1].count++;
      else if (score < 80) buckets[2].count++;
      else if (score < 90) buckets[3].count++;
      else buckets[4].count++;
    }

    return { buckets };
  }

  async getQuestionAccuracy(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: {
          include: {
            questions: {
              include: { question: { select: { type: true, content: true } } },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!exam?.paper) throw new NotFoundException('试卷不存在');

    const results: any[] = [];
    for (const pq of exam.paper.questions) {
      const answers = await this.prisma.examAnswer.findMany({
        where: { paperQuestionId: pq.id, session: { examId, status: 'SUBMITTED' } },
        select: { isCorrect: true },
      });
      const totalAnswers = answers.length;
      const correctCount = answers.filter(a => a.isCorrect).length;
      const accuracy = totalAnswers > 0 ? Math.round(correctCount / totalAnswers * 10000) / 100 : 0;

      results.push({
        questionId: pq.questionId,
        index: pq.sortOrder,
        type: pq.question.type,
        content: pq.question.content?.slice(0, 100) || '',
        totalAnswers,
        correctCount,
        accuracy,
        score: pq.score,
      });
    }

    // Sort by accuracy (hardest first)
    results.sort((a, b) => a.accuracy - b.accuracy);

    return { questions: results };
  }
}
