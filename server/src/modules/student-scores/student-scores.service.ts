import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentScoresService {
  constructor(private prisma: PrismaService) {}

  /**
   * 学员成绩变动记录（脱敏版：不返回操作人，只显示分数变化 + 原因）
   * 数据源：score_audit_logs 按 examId + 当前学员筛选
   */
  async getScoreChanges(examId: number, studentId: number) {
    const [logs, exam] = await Promise.all([
      this.prisma.scoreAuditLog.findMany({
        where: { examId, studentId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exam.findUnique({
        where: { id: examId },
        select: { title: true },
      }),
    ]);

    return {
      changes: logs.map(log => ({
        timestamp: log.createdAt.toISOString(),
        fromScore: log.oldValue,
        toScore: log.newValue,
        reason: log.reason || '',
        action: log.action, // ADJUST / UNLOCK / APPEAL 等
        relatedExamName: exam?.title || '',
      })),
    };
  }
}
