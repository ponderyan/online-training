import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ScoreAppealService } from './score-appeal.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class ScoreAppealController {
  constructor(
    private service: ScoreAppealService,
    private notificationService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /** 学员提交申诉 */
  @Post(':examId/appeals')
  async create(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() data: { reason: string; description: string; studentId: number },
  ) {
    const result = await this.service.create(examId, data.studentId, data);

    // ← 通知有 GRADING_PUBLISH 权限的管理员
    void (async () => {
      // 从 UserRoleAssignment 查询管理员
      const adminRoles = await this.prisma.role.findMany({
        where: { code: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] } },
      });
      const adminAssignments = await this.prisma.userRoleAssignment.findMany({
        where: { roleId: { in: adminRoles.map(r => r.id) } },
        select: { userId: true },
      });
      const admins = await this.prisma.user.findMany({
        where: { id: { in: adminAssignments.map(a => a.userId) }, isActive: true },
        select: { id: true },
      });
      const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { title: true } });
      const student = await this.prisma.user.findUnique({ where: { id: data.studentId }, select: { displayName: true } });
      await this.notificationService.createMany(
        admins.map(a => a.id),
        'APPEAL_SUBMITTED' as any,
        `新的成绩申诉`,
        `学员【${student?.displayName || '未知'}】提交了【${exam?.title || ''}】的成绩申诉`,
        result?.id, 'appeal',
      );
    })();

    return result;
  }

  /** 管理员：查看某考试的所有申诉 */
  @Get(':examId/appeals')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async findByExam(
    @Param('examId', ParseIntPipe) examId: number,
    @Query('status') status?: string,
  ) {
    return this.service.findByExam(examId, status);
  }

  /** 学员：查看自己的申诉列表 */
  @Get('appeals/my')
  async findMy(@Query('studentId', ParseIntPipe) studentId: number) {
    return this.service.findMy(studentId);
  }

  /** 管理员：审核申诉 */
  @Patch('appeals/:id/review')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { status: string; newScore?: number; reviewNote?: string; reviewerId: number },
  ) {
    const result = await this.service.review(id, data, data.reviewerId);

    // ← 通知学员申诉结果
    void (async () => {
      const appeal = await this.prisma.scoreAppeal.findUnique({
        where: { id },
        select: { studentId: true, examId: true },
      });
      if (appeal) {
        await this.notificationService.create(
          appeal.studentId,
          'APPEAL_RESOLVED' as any,
          `申诉已${data.status === 'APPROVED' ? '批准' : '驳回'}`,
          data.reviewNote || `你的成绩申诉已被${data.status === 'APPROVED' ? '批准' : '驳回'}`,
          id, 'appeal',
        );
      }
    })();

    return result;
  }
}
