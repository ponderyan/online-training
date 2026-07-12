import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/grading-assignments')
export class GradingAssignmentController {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {}

  /**
   * (重要：固定路由必须在参数路由之前声明)
   * GET /api/grading-assignments/my/assignments
   * 当前用户被分派的阅卷任务
   */
  @Get('my/assignments')
  async getMyAssignments(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) return [];
    const items = await this.prisma.gradingAssignment.findMany({
      where: { graderId: userId },
    });
    const examIds = [...new Set(items.map(a => a.examId))];
    const exams = examIds.length > 0
      ? await this.prisma.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true } })
      : [];
    const examMap = new Map(exams.map(e => [e.id, e]));
    return items.map(a => ({ ...a, exam: examMap.get(a.examId) || null }));
  }

  /**
   * GET /api/grading-assignments/:examId
   * 获取考试的分派列表，支持按 graderId 过滤，返回增强格式含统计摘要
   */
  @Get(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getAssignments(
    @Param('examId', ParseIntPipe) examId: number,
    @Query('graderId') graderId?: string,
  ) {
    const where: any = { examId };
    if (graderId) where.graderId = parseInt(graderId);

    const items = await this.prisma.gradingAssignment.findMany({
      where,
      include: {
        grader: { select: { id: true, displayName: true } },
        session: { select: { id: true, studentId: true, student: { select: { displayName: true } } } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const graderIds = [...new Set(items.map(a => a.graderId))];
    const sessionIds = [...new Set(items.filter(a => a.sessionId !== null).map(a => a.sessionId))];

    return {
      assignments: items,
      summary: {
        totalGraders: graderIds.length,
        totalStudents: sessionIds.length,
        totalAssignments: items.length,
      },
    };
  }

  /**
   * POST /api/grading-assignments/:examId
   * 组合批量分派：sessionIds × paperQuestionIds 笛卡尔积
   */
  @Post(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async createAssignment(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() data: {
      graderId: number;
      sessionIds?: number[];      // 不传/空=全学员
      paperQuestionIds?: number[]; // 不传/空=全题型
    },
  ) {
    // 校验：不能两个都为空或都不传
    const hasSessions = data.sessionIds && data.sessionIds.length > 0;
    const hasQuestions = data.paperQuestionIds && data.paperQuestionIds.length > 0;
    if (!hasSessions && !hasQuestions) {
      throw new BadRequestException('至少需要指定学员范围或题型范围');
    }

    // 生成组合：sessionIds × paperQuestionIds 笛卡尔积
    const sessionIds = hasSessions ? data.sessionIds! : [null as any];
    const questionIds = hasQuestions ? data.paperQuestionIds! : [null as any];

    const records: any[] = [];
    for (const sid of sessionIds) {
      for (const pqid of questionIds) {
        records.push({
          examId,
          graderId: data.graderId,
          sessionId: sid ?? null,
          paperQuestionId: pqid ?? null,
        });
      }
    }

    // 去重批量创建
    const result = await this.prisma.gradingAssignment.createMany({
      data: records,
      skipDuplicates: true,
    });

    // ← 通知阅卷员
    void (async () => {
      const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { title: true } });
      await this.notificationService.create(
        data.graderId,
        'GRADING_ASSIGNED' as any,
        `你已被指派阅卷`,
        `你已被指派阅卷【${exam?.title || ''}】`,
        examId, 'exam',
      );
    })();

    return { success: true, count: result.count };
  }

  /**
   * DELETE /api/grading-assignments/:examId/clear
   * 清除某阅卷员在该考试的全部分派
   */
  @Delete(':examId/clear')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async clearAssignments(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() data: { graderId: number },
  ) {
    await this.prisma.gradingAssignment.deleteMany({
      where: { examId, graderId: data.graderId },
    });
    return { success: true };
  }

  /**
   * PUT /api/grading-assignments/:examId/:assignmentId
   * 更新单条分派（保留）
   */
  @Put(':examId/:assignmentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async updateAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() data: { graderId?: number; paperQuestionId?: number; status?: string },
  ) {
    return this.prisma.gradingAssignment.update({ where: { id: assignmentId }, data });
  }

  /**
   * DELETE /api/grading-assignments/:examId/:assignmentId
   * 删除单条分派（保留）
   */
  @Delete(':examId/:assignmentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async deleteAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return this.prisma.gradingAssignment.delete({ where: { id: assignmentId } });
  }
}
