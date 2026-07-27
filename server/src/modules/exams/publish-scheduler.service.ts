import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExamsService } from './exams.service.js';

/**
 * 成绩发布调度器
 * - SCHEDULED 模式：每分钟检查是否有到点的定时发布
 */
@Injectable()
export class PublishSchedulerService {
  private readonly logger = new Logger(PublishSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private examsService: ExamsService,
  ) {}

  /**
   * 每分钟检查一次：SCHEDULED 模式的考试是否到发布时间
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublish() {
    const now = new Date();

    const exams = await this.prisma.exam.findMany({
      where: {
        scorePublishMode: 'SCHEDULED',
        publishAt: { lte: now },
        status: { in: ['FINISHED', 'IN_PROGRESS'] },
      },
      select: { id: true, title: true },
    });

    for (const exam of exams) {
      try {
        await this.examsService.publishScores(exam.id);
        this.logger.log(`定时发布成功: ${exam.title} (id=${exam.id})`);
      } catch (err) {
        this.logger.error(`定时发布失败: ${exam.title} (id=${exam.id})`, err);
      }
    }
  }

  /**
   * ★ 每分钟检查：endTime 已到但仍有 ACTIVE 会话 → 强制收卷
   * 覆盖场景：学员关闭浏览器（心跳中断）后，session 不会被自动交卷
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async forceEndExpiredSessions() {
    const now = new Date();

    // 找出所有 endTime 已过、仍有 ACTIVE session 的考试
    const activeSessions = await this.prisma.examSession.findMany({
      where: {
        status: 'ACTIVE',
        exam: { endTime: { lte: now } },
      },
      select: { id: true, examId: true },
    });

    if (activeSessions.length === 0) return;

    this.logger.log(`强制收卷: 发现 ${activeSessions.length} 个超时会话`);

    for (const session of activeSessions) {
      try {
        await this.prisma.examSession.update({
          where: { id: session.id },
          data: { status: 'SUBMITTED', submittedAt: now, remainingTime: 0, scoringStatus: 'PENDING' },
        });
        await this.examsService.autoGrade(session.id);
        await this.examsService.syncExamProgress(session.examId);
      } catch (err) {
        this.logger.error(`强制收卷失败: sessionId=${session.id}`, err);
      }
    }
  }
}
