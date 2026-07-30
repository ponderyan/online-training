import { Controller, Get, Post, Param, Body, ParseIntPipe, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { ExamAccessService } from '../../common/services/exam-access.service.js';
import { recalculateSessionScore } from '../../common/grading.utils.js';

@Controller('api/grading-reviews')
export class ReviewController {
  constructor(private prisma: PrismaService, private examAccess: ExamAccessService) {}

  @Get(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getReviews(@Param('examId', ParseIntPipe) examId: number, @Req() req: any, @Query('status') status?: string) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const where: any = { examId };
    if (status) where.status = status;
    const items = await this.prisma.gradingReview.findMany({ where, orderBy: { createdAt: 'desc' } });
    // Enrich with student info
    const sessionIds = [...new Set(items.map(i => i.sessionId))];
    const sessions = sessionIds.length > 0 ? await this.prisma.examSession.findMany({ where: { id: { in: sessionIds } }, include: { student: { select: { id: true, displayName: true } } } }) : [];
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    return items.map(i => ({ ...i, session: sessionMap.get(i.sessionId) || null }));
  }

  @Post(':examId/request')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async requestReview(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() data: { answerId: number; sessionId: number; reason: string; originalScore: number },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const existing = await this.prisma.gradingReview.findFirst({ where: { answerId: data.answerId, status: { in: ['PENDING', 'IN_REVIEW'] } } });
    if (existing) return { error: '该答案已有待处理的复核' };
    return this.prisma.gradingReview.create({
      data: { examId, answerId: data.answerId, sessionId: data.sessionId, reason: data.reason, originalScore: data.originalScore },
    });
  }

  @Post(':examId/:reviewId/resolve')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async resolveReview(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body() data: { reviewedScore?: number; reviewerNote?: string; action: 'RESOLVED' | 'DISMISSED' },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const review = await this.prisma.gradingReview.findUnique({ where: { id: reviewId } });
    if (!review) return { error: '复核不存在' };

    if (data.action === 'RESOLVED' && data.reviewedScore !== undefined) {
      // ★ G2 修复：复核改分需校验满分（与 gradeAnswer 一致）
      const answer = await this.prisma.examAnswer.findUnique({
        where: { id: review.answerId },
        select: { paperQuestionId: true },
      });
      const pq = answer ? await this.prisma.paperQuestion.findUnique({
        where: { id: answer.paperQuestionId },
        select: { score: true },
      }) : null;
      const maxScore = pq?.score ?? 0;
      if (data.reviewedScore < 0) return { error: '评分不能为负数' };
      if (data.reviewedScore > maxScore) return { error: `评分不能超过该题满分 ${maxScore} 分` };

      await this.prisma.examAnswer.update({
        where: { id: review.answerId },
        data: { score: data.reviewedScore },
      });
      // 重算 ExamSession 成绩字段（和 gradeAnswer 共用逻辑）
      await recalculateSessionScore(this.prisma, review.sessionId);
    }
    return this.prisma.gradingReview.update({
      where: { id: reviewId },
      data: { status: data.action, reviewedScore: data.reviewedScore || review.reviewedScore, resolvedAt: new Date() },
    });
  }
}
