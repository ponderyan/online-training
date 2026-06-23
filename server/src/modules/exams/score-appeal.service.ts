import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ScoreAppealService {
  constructor(private prisma: PrismaService) {}

  async create(examId: number, studentId: number, data: { reason: string; description: string }) {
    // Verify exam exists
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('考试不存在');

    // Verify session exists and belongs to student
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.studentId !== studentId) throw new ForbiddenException('无权提交申诉');
    if (session.scoringStatus !== 'PUBLISHED' && session.scoringStatus !== 'ADJUSTED') {
      throw new BadRequestException('成绩未发布或已确认，无法申诉');
    }

    // Check deadline
    const appealDeadlineHours = exam.appealDeadlineHours ?? 72;
    if (appealDeadlineHours > 0 && session.scoringPublishedAt) {
      const deadline = new Date(session.scoringPublishedAt);
      deadline.setHours(deadline.getHours() + appealDeadlineHours);
      if (new Date() > deadline) throw new BadRequestException('申诉已截止');
    }
    if (appealDeadlineHours === 0) throw new BadRequestException('该考试不允许申诉');

    // Check duplicate
    const existing = await this.prisma.scoreAppeal.findFirst({
      where: { examId, sessionId: session.id, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('已有待处理的申诉，请勿重复提交');

    return this.prisma.scoreAppeal.create({
      data: {
        examId,
        sessionId: session.id,
        studentId,
        reason: data.reason,
        description: data.description,
        oldScore: session.totalScore,
      },
    });
  }

  async findByExam(examId: number, status?: string) {
    const where: any = { examId };
    if (status) where.status = status;
    return this.prisma.scoreAppeal.findMany({
      where,
      include: {
        student: { select: { id: true, displayName: true, username: true } },
        session: { select: { totalScore: true, finalScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMy(studentId: number) {
    return this.prisma.scoreAppeal.findMany({
      where: { studentId },
      include: {
        exam: { select: { id: true, title: true } },
        session: { select: { totalScore: true, finalScore: true } },
        reviewer: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(id: number, data: { status: string; newScore?: number; reviewNote?: string }, reviewerId: number) {
    const appeal = await this.prisma.scoreAppeal.findUnique({ where: { id } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    if (appeal.status !== 'PENDING') throw new BadRequestException('该申诉已处理');

    const updateData: any = {
      status: data.status,
      reviewerId,
      reviewNote: data.reviewNote || null,
      reviewedAt: new Date(),
    };

    if (data.status === 'APPROVED' && data.newScore !== undefined) {
      updateData.newScore = data.newScore;

      // Update exam session score
      await this.prisma.examSession.update({
        where: { id: appeal.sessionId },
        data: {
          totalScore: data.newScore,
          finalScore: data.newScore,
          scoringStatus: 'PUBLISHED', // Re-publish to show adjusted score
        },
      });

      // Record audit log
      await this.prisma.scoreAuditLog.create({
        data: {
          examId: appeal.examId,
          sessionId: appeal.sessionId,
          studentId: appeal.studentId,
          action: 'APPEAL_ADJUST',
          fieldName: 'totalScore',
          oldValue: appeal.oldScore || 0,
          newValue: data.newScore,
          reason: '申诉批准调分',
          operatorId: reviewerId,
          operatorName: '管理员',
        },
      });
    }

    return this.prisma.scoreAppeal.update({ where: { id }, data: updateData });
  }
}
