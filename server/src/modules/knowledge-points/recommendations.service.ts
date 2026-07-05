import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * 推荐引擎 — 基于学员过往考试数据，计算知识点掌握率，
 * 识别薄弱环节，推荐关联课程。
 */
@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 替换某考点的课程关联
   */
  async setKpCourses(kpId: number, courseIds: number[]) {
    const kp = await this.prisma.knowledgePoint.findUnique({ where: { id: kpId } });
    if (!kp) throw new NotFoundException('知识点不存在');

    await this.prisma.courseKnowledgePoint.deleteMany({
      where: { knowledgePointId: kpId },
    });

    if (courseIds.length > 0) {
      await this.prisma.courseKnowledgePoint.createMany({
        data: courseIds.map(courseId => ({
          courseId,
          knowledgePointId: kpId,
        })),
      });
    }

    return { success: true, linkedCount: courseIds.length };
  }

  /**
   * 获取某考点的关联课程
   */
  async getKpCourses(kpId: number) {
    const kp = await this.prisma.knowledgePoint.findUnique({
      where: { id: kpId },
      select: { id: true, name: true },
    });
    if (!kp) throw new NotFoundException('知识点不存在');

    const courseKPs = await this.prisma.courseKnowledgePoint.findMany({
      where: { knowledgePointId: kpId },
      include: {
        course: {
          select: { id: true, name: true, code: true, hours: true },
        },
      },
    });

    return {
      kpId: kp.id,
      kpName: kp.name,
      courses: courseKPs.map(ckp => ckp.course),
    };
  }

  /**
   * 学员个性化推荐引擎
   *
   * 算法要点：
   * 1. 取最近 3 场考试（已交卷）
   * 2. 每场考试中，按知识点汇总正确率
   * 3. 时间加权平均（近期权重更高）
   * 4. 按掌握率升序排列，识别薄弱点
   * 5. 排除 ≥ 90% 的优秀知识点
   * 6. 为薄弱知识点匹配关联课程
   */
  async getRecommendations(studentId: number) {
    // ── 1. 取最近 3 场考试 ──
    const sessions = await this.prisma.examSession.findMany({
      where: { studentId, submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        submittedAt: true,
        answers: {
          where: { isCorrect: { not: null } },
          select: { questionId: true, isCorrect: true },
        },
      },
    });

    if (sessions.length === 0) {
      return { weakestKps: [], recommendedCourses: [], learningPath: [] };
    }

    // ── 2. 收集所有题目 ID ──
    const questionIds = [
      ...new Set(sessions.flatMap(s => s.answers.map(a => a.questionId))),
    ];

    if (questionIds.length === 0) {
      return { weakestKps: [], recommendedCourses: [], learningPath: [] };
    }

    // ── 3. 获取题目 → 知识点映射 ──
    const questionKPs = await this.prisma.questionKnowledgePoint.findMany({
      where: { questionId: { in: questionIds } },
      select: {
        questionId: true,
        knowledgePointId: true,
        knowledgePoint: { select: { id: true, name: true } },
      },
    });

    // questionId → [kpId, ...]
    const questionKPMap = new Map<number, number[]>();
    // kpId → { id, name }
    const kpInfoMap = new Map<number, { id: number; name: string }>();

    for (const qkp of questionKPs) {
      if (!questionKPMap.has(qkp.questionId)) {
        questionKPMap.set(qkp.questionId, []);
      }
      questionKPMap.get(qkp.questionId)!.push(qkp.knowledgePointId);
      if (!kpInfoMap.has(qkp.knowledgePointId)) {
        kpInfoMap.set(qkp.knowledgePointId, {
          id: qkp.knowledgePoint.id,
          name: qkp.knowledgePoint.name,
        });
      }
    }

    // ── 4. 按知识点汇总每场考试的正确率 ──
    // kpId → sessionId → { correct, total }
    const kpSessionRates = new Map<number, Map<number, { correct: number; total: number }>>();

    for (const session of sessions) {
      const sessionRates = new Map<number, { correct: number; total: number }>();

      for (const answer of session.answers) {
        const kpIds = questionKPMap.get(answer.questionId) || [];
        for (const kpId of kpIds) {
          if (!sessionRates.has(kpId)) {
            sessionRates.set(kpId, { correct: 0, total: 0 });
          }
          const r = sessionRates.get(kpId)!;
          r.total++;
          if (answer.isCorrect) r.correct++;
        }
      }

      for (const [kpId, rate] of sessionRates) {
        if (!kpSessionRates.has(kpId)) {
          kpSessionRates.set(kpId, new Map());
        }
        kpSessionRates.get(kpId)!.set(session.id, rate);
      }
    }

    // ── 5. 时间加权平均 ──
    // weight = 1 / (daysAgo + 7)
    const now = new Date();
    const kpResults = new Map<number, { weightedRate: number }>();

    for (const [kpId, sessionRates] of kpSessionRates) {
      let weightedSum = 0;
      let totalWeight = 0;

      for (const [sessionId, rate] of sessionRates) {
        const session = sessions.find(s => s.id === sessionId);
        if (!session?.submittedAt) continue;

        const daysAgo = (now.getTime() - session.submittedAt.getTime()) / 86_400_000;
        const weight = 1 / (daysAgo + 7);
        const correctRate = rate.total > 0 ? rate.correct / rate.total : 0;

        weightedSum += correctRate * weight;
        totalWeight += weight;
      }

      const avgRate = totalWeight > 0
        ? Math.round(((weightedSum / totalWeight) * 100) * 100) / 100
        : 0;

      kpResults.set(kpId, { weightedRate: avgRate });
    }

    // ── 6. 按掌握率升序排列 ──
    const sortedKPs = [...kpResults.entries()]
      .map(([kpId, result]) => ({
        kpId,
        avgRate: result.weightedRate,
      }))
      .sort((a, b) => a.avgRate - b.avgRate);

    // ── 7. 构建 weakestKps（全部知识点）──
    const weakestKps = sortedKPs.map(kp => ({
      kpId: kp.kpId,
      kpName: kpInfoMap.get(kp.kpId)?.name || '',
      avgRate: kp.avgRate,
      level: this.getLevel(kp.avgRate),
    }));

    // ── 8. 批量查询关联课程 ──
    const kpIds = sortedKPs.map(kp => kp.kpId);
    const courseKPs = await this.prisma.courseKnowledgePoint.findMany({
      where: { knowledgePointId: { in: kpIds } },
      include: {
        course: { select: { id: true, name: true, code: true, hours: true } },
      },
    });

    // kpId → course[]
    const kpCoursesMap = new Map<number, any[]>();
    for (const ckp of courseKPs) {
      if (!kpCoursesMap.has(ckp.knowledgePointId)) {
        kpCoursesMap.set(ckp.knowledgePointId, []);
      }
      kpCoursesMap.get(ckp.knowledgePointId)!.push(ckp.course);
    }

    // ── 9. learningPath（排除优秀知识点）──
    const nonExcellentKPs = weakestKps.filter(kp => kp.avgRate < 90);
    const learningPath = nonExcellentKPs.map((kp, index) => ({
      step: index + 1,
      kpId: kp.kpId,
      kpName: kp.kpName,
      avgRate: kp.avgRate,
      level: kp.level,
      courses: kpCoursesMap.get(kp.kpId) || [],
    }));

    // ── 10. recommendedCourses（仅包含有课程的知识点）──
    const recommendedCourses = learningPath
      .filter(lp => lp.courses.length > 0)
      .map(lp => ({
        kpId: lp.kpId,
        kpName: lp.kpName,
        reason: `你在「${lp.kpName}」知识点正确率仅 ${lp.avgRate}%，建议加强学习`,
        courses: lp.courses,
      }));

    return { weakestKps, recommendedCourses, learningPath };
  }

  /**
   * 掌握等级映射
   * >= 90  优秀
   * >= 75  良好
   * >= 60  一般
   * >= 40  薄弱
   * < 40   危险
   */
  private getLevel(rate: number): string {
    if (rate >= 90) return '优秀';
    if (rate >= 75) return '良好';
    if (rate >= 60) return '一般';
    if (rate >= 40) return '薄弱';
    return '危险';
  }
}
