import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ExamAnalysisService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════
  //   质检报告
  // ═══════════════════════════════════════════

  /**
   * 获取考试质检报告概览 + 题目列表
   */
  async getQualityReport(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: { select: { id: true, totalScore: true } },
      },
    });
    if (!exam) throw new NotFoundException('考试不存在');
    if (!exam.paper) throw new NotFoundException('试卷不存在');

    // 1. 获取所有已提交答卷
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', finalScore: { not: null } },
      select: { id: true, studentId: true, finalScore: true },
      orderBy: { finalScore: 'desc' },
    });

    const totalExaminees = sessions.length;
    const scores = sessions.map(s => s.finalScore!);
    const avgScore = totalExaminees > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / totalExaminees * 100) / 100
      : 0;
    const maxScore = totalExaminees > 0 ? scores[0] : 0;
    const minScore = totalExaminees > 0 ? scores[scores.length - 1] : 0;
    const passingScore = exam.passingScore || Math.round(exam.paper.totalScore * 0.6);
    const passCount = sessions.filter(s => s.finalScore! >= passingScore).length;
    const passRate = totalExaminees > 0 ? Math.round(passCount / totalExaminees * 10000) / 100 : 0;
    const stdDev = this.calcStdDev(scores, avgScore);

    // 2. 分档: 前27% / 中间46% / 后27%
    const highCount = Math.max(1, Math.round(totalExaminees * 0.27));
    const lowCount = Math.max(1, Math.round(totalExaminees * 0.27));
    const highGroupIds = sessions.slice(0, highCount).map(s => s.id);
    const lowGroupIds = sessions.slice(-lowCount).map(s => s.id);
    const midGroupIds = sessions.slice(highCount, totalExaminees - lowCount).map(s => s.id);

    // 3. 试卷中的所有题目
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: exam.paper.id },
      include: {
        question: { select: { id: true, type: true, content: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // 4. 批量获取所有答案
    const allAnswers = await this.prisma.examAnswer.findMany({
      where: { session: { examId, status: 'SUBMITTED' } },
      select: {
        id: true,
        sessionId: true,
        questionId: true,
        isCorrect: true,
        answer: true,
        paperQuestionId: true,
      },
    });

    // 将答案按 paperQuestionId 分组
    const answersByPq = new Map<number, typeof allAnswers>();
    for (const a of allAnswers) {
      if (!answersByPq.has(a.paperQuestionId)) answersByPq.set(a.paperQuestionId, []);
      answersByPq.get(a.paperQuestionId)!.push(a);
    }

    const questions = paperQuestions.map((pq, index) => {
      const answers = answersByPq.get(pq.id) || [];
      const totalAns = answers.length;
      const correctCount = answers.filter(a => a.isCorrect === true).length;
      const correctRate = totalAns > 0 ? Math.round(correctCount / totalAns * 10000) / 100 : 0;

      // 区分度计算
      let discrimination: number | null = null;
      if (totalExaminees >= 10) {
        const highCorrect = answers.filter(a => highGroupIds.includes(a.sessionId) && a.isCorrect === true).length;
        const lowCorrect = answers.filter(a => lowGroupIds.includes(a.sessionId) && a.isCorrect === true).length;
        const highRate = highGroupIds.length > 0 ? highCorrect / highGroupIds.length : 0;
        const lowRate = lowGroupIds.length > 0 ? lowCorrect / lowGroupIds.length : 0;
        discrimination = Math.round((highRate - lowRate) * 10000) / 10000;
      }

      return {
        id: pq.question.id,
        index: index + 1,
        type: pq.question.type,
        content: pq.question.content?.slice(0, 40) || '',
        correctRate,
        discrimination,
        avgTime: 0, // 暂不实现平均用时
        sampleCount: totalAns,
      };
    });

    // 按区分度升序排序（最差的排最前面）
    questions.sort((a, b) => {
      const da = a.discrimination ?? -999;
      const db = b.discrimination ?? -999;
      return da - db;
    });

    // 重新赋予排序后的序号
    questions.forEach((q, i) => { q.index = i + 1; });

    return {
      overview: {
        totalExaminees,
        avgScore,
        maxScore,
        minScore,
        passRate,
        stdDev,
        totalScore: exam.paper.totalScore,
        passingScore,
      },
      questions,
    };
  }

  /**
   * 获取单题详情（选项分析 + 三段分层答对率）
   */
  async getQuestionDetail(examId: number, questionId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { paperId: true, id: true },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    // 获取题目信息 + 选项
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { sortOrder: 'asc' } },
        subQuestions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('题目不存在');

    // 找到 paperQuestion 记录
    const paperQuestion = await this.prisma.paperQuestion.findFirst({
      where: { paperId: exam.paperId!, questionId },
    });
    if (!paperQuestion) throw new NotFoundException('题目不在本试卷中');

    // 获取所有已提交答卷
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', finalScore: { not: null } },
      select: { id: true, studentId: true, finalScore: true },
      orderBy: { finalScore: 'desc' },
    });

    const totalExaminees = sessions.length;

    // 获取本题的所有答案
    const answers = await this.prisma.examAnswer.findMany({
      where: { session: { examId, status: 'SUBMITTED' }, questionId },
      select: { id: true, sessionId: true, isCorrect: true, answer: true },
    });

    const totalAns = answers.length;
    const correctCount = answers.filter(a => a.isCorrect === true).length;
    const correctRate = totalAns > 0 ? Math.round(correctCount / totalAns * 10000) / 100 : 0;

    // ── 分档 ──
    const highCount = Math.max(1, Math.round(totalExaminees * 0.27));
    const lowCount = Math.max(1, Math.round(totalExaminees * 0.27));
    const highGroupIds = new Set(sessions.slice(0, highCount).map(s => s.id));
    const lowGroupIds = new Set(sessions.slice(-lowCount).map(s => s.id));
    const midGroupIds = new Set(sessions.slice(highCount, totalExaminees - lowCount).map(s => s.id));

    const tierHigh = answers.filter(a => highGroupIds.has(a.sessionId));
    const tierMid = answers.filter(a => midGroupIds.has(a.sessionId));
    const tierLow = answers.filter(a => lowGroupIds.has(a.sessionId));

    const tierStats = {
      highGroup: {
        correct: tierHigh.filter(a => a.isCorrect === true).length,
        total: tierHigh.length,
        rate: tierHigh.length > 0 ? Math.round(tierHigh.filter(a => a.isCorrect === true).length / tierHigh.length * 10000) / 100 : 0,
      },
      midGroup: {
        correct: tierMid.filter(a => a.isCorrect === true).length,
        total: tierMid.length,
        rate: tierMid.length > 0 ? Math.round(tierMid.filter(a => a.isCorrect === true).length / tierMid.length * 10000) / 100 : 0,
      },
      lowGroup: {
        correct: tierLow.filter(a => a.isCorrect === true).length,
        total: tierLow.length,
        rate: tierLow.length > 0 ? Math.round(tierLow.filter(a => a.isCorrect === true).length / tierLow.length * 10000) / 100 : 0,
      },
    };

    // ── 区分度 ──
    let discrimination: number | null = null;
    if (totalExaminees >= 10) {
      const highCorrect = tierHigh.filter(a => a.isCorrect === true).length;
      const lowCorrect = tierLow.filter(a => a.isCorrect === true).length;
      const highRate = highGroupIds.size > 0 ? highCorrect / highGroupIds.size : 0;
      const lowRate = lowGroupIds.size > 0 ? lowCorrect / lowGroupIds.size : 0;
      discrimination = Math.round((highRate - lowRate) * 10000) / 10000;
    }

    // ── 选项选择率分析（单选 + 判断）──
    let optionSelection: { label: string; count: number; rate: number }[] = [];
    let options: { label: string; text: string; isCorrect: boolean }[] = [];

    if (question.type === 'SINGLE_CHOICE' || question.type === 'TRUE_FALSE') {
      options = question.options.map(o => ({
        label: o.label,
        text: o.content,
        isCorrect: o.isCorrect,
      }));

      // 统计每个选项的选择次数
      const optionCount = new Map<string, number>();
      for (const o of question.options) {
        optionCount.set(o.label, 0);
      }
      for (const a of answers) {
        const ans = a.answer as any;
        const chosen = ans?.label || ans?.selected || ans;
        if (typeof chosen === 'string') {
          optionCount.set(chosen, (optionCount.get(chosen) || 0) + 1);
        }
      }
      optionSelection = Array.from(optionCount.entries()).map(([label, count]) => ({
        label,
        count,
        rate: totalAns > 0 ? Math.round(count / totalAns * 10000) / 100 : 0,
      })).sort((a, b) => a.label.localeCompare(b.label));
    } else if (question.type === 'MULTIPLE_CHOICE') {
      options = question.options.map(o => ({
        label: o.label,
        text: o.content,
        isCorrect: o.isCorrect,
      }));

      // 多选题统计每个选项的选择次数
      const optionCount = new Map<string, number>();
      for (const o of question.options) {
        optionCount.set(o.label, 0);
      }
      for (const a of answers) {
        const ans = a.answer as any;
        const selected = ans?.labels || ans?.selected || [];
        if (Array.isArray(selected)) {
          for (const lbl of selected) {
            if (typeof lbl === 'string') {
              optionCount.set(lbl, (optionCount.get(lbl) || 0) + 1);
            }
          }
        }
      }
      optionSelection = Array.from(optionCount.entries()).map(([label, count]) => ({
        label,
        count,
        rate: totalAns > 0 ? Math.round(count / totalAns * 10000) / 100 : 0,
      })).sort((a, b) => a.label.localeCompare(b.label));
    }

    return {
      id: question.id,
      content: question.content,
      type: question.type,
      options,
      correctRate,
      discrimination,
      avgTime: 0,
      optionSelection,
      tierStats,
      sampleCount: totalAns,
    };
  }

  /** 计算标准差 */
  private calcStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.round(Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

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
