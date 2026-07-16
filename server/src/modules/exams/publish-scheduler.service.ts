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
}
