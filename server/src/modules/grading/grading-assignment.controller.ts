import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Req } from '@nestjs/common';
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

  @Get(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getAssignments(@Param('examId', ParseIntPipe) examId: number) {
    const items = await this.prisma.gradingAssignment.findMany({ where: { examId }, orderBy: { assignedAt: 'desc' } });
    const ids = [...new Set(items.map(a => a.graderId))];
    const graders = ids.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }) : [];
    const map = new Map(graders.map(g => [g.id, g]));
    return items.map(a => ({ ...a, grader: map.get(a.graderId) || null }));
  }

  @Post(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async createAssignment(@Param('examId', ParseIntPipe) examId: number, @Body() data: { graderId: number; paperQuestionId?: number }) {
    const result = await this.prisma.gradingAssignment.create({ data: { examId, graderId: data.graderId, paperQuestionId: data.paperQuestionId || null } });

    // ← 通知被指派的阅卷员
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

    return result;
  }

  @Put(':examId/:assignmentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async updateAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number, @Body() data: { graderId?: number; paperQuestionId?: number; status?: string }) {
    return this.prisma.gradingAssignment.update({ where: { id: assignmentId }, data });
  }

  @Delete(':examId/:assignmentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async deleteAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return this.prisma.gradingAssignment.delete({ where: { id: assignmentId } });
  }

  @Get('my/assignments')
  async getMyAssignments(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) return [];
    const items = await this.prisma.gradingAssignment.findMany({ where: { graderId: userId } });
    const examIds = [...new Set(items.map(a => a.examId))];
    const exams = examIds.length > 0 ? await this.prisma.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true } }) : [];
    const examMap = new Map(exams.map(e => [e.id, e]));
    return items.map(a => ({ ...a, exam: examMap.get(a.examId) || null }));
  }
}
