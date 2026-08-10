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
   * ★ 每分钟检查：endTime 已过的线上考试 → 统一结算
   * 1. ACTIVE 会话强制收卷（覆盖学员关闭浏览器/心跳中断场景）
   * 2. ASSIGNED/PAUSED 会话自动标记缺考（0 分）——与线下 markAbsent 行为一致
   * 3. 推进考试状态（全员结算后自动 FINISHED）
   * 兼作存量清理：服务重启后对历史卡住的过期考试同样生效
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoSettleExpiredExams() {
    const now = new Date();

    const expiredExams = await this.prisma.exam.findMany({
      where: {
        endTime: { lte: now },
        status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        examMode: 'ONLINE',
      },
      select: { id: true, title: true },
    });

    if (expiredExams.length === 0) return;

    for (const exam of expiredExams) {
      try {
        const r = await this.settleExpiredExam(exam.id);
        if (r.settled > 0) {
          this.logger.log(`过期考试结算: ${exam.title} (id=${exam.id}) 收卷${r.forceSubmitted}人 缺考${r.markedAbsent}人`);
        }
      } catch (err) {
        this.logger.error(`过期考试结算失败: ${exam.title} (id=${exam.id})`, err);
      }
    }
  }

  /**
   * 结算单场过期考试（供定时任务与测试调用）
   */
  async settleExpiredExam(examId: number) {
    const now = new Date();

    // 1. ACTIVE → 强制收卷 + 自动判分
    const activeSessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const session of activeSessions) {
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'SUBMITTED', submittedAt: now, remainingTime: 0, scoringStatus: 'PENDING' },
      });
      await this.examsService.autoGrade(session.id);
    }

    // 2. ASSIGNED/PAUSED → 自动缺考（与线下 markAbsent 一致：SUBMITTED + 0 分 + absent 标记）
    const absentResult = await this.prisma.examSession.updateMany({
      where: { examId, status: { in: ['ASSIGNED', 'PAUSED'] } },
      data: {
        absent: true,
        status: 'SUBMITTED',
        submittedAt: now,
        totalScore: 0,
        finalScore: 0,
        isPassed: false,
        scoringStatus: 'PENDING',
      },
    });

    // 3. 统一收口推进考试状态（全员 SUBMITTED → FINISHED）
    await this.examsService.syncExamProgress(examId);

    return { settled: activeSessions.length + absentResult.count, forceSubmitted: activeSessions.length, markedAbsent: absentResult.count };
  }
}
