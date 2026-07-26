import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService, private notificationService: NotificationsService) {}

  async findAll(params: { page?: number; pageSize?: number; programId?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const where: any = {};
    if (params.programId) where.programId = params.programId;

    const [items, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          course: { select: { id: true, name: true, code: true } },
          instructor: { select: { id: true, realName: true, title: true } },
          program: { select: { id: true, name: true, location: true } },
        },
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByProgram(programId: number) {
    return this.prisma.schedule.findMany({
      where: { programId },
      include: {
        course: { select: { id: true, name: true, code: true, hours: true } },
        instructor: { select: { id: true, realName: true, title: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: number) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, code: true } },
        instructor: { select: { id: true, realName: true, title: true } },
        program: { select: { id: true, name: true } },
      },
    });
    if (!schedule) throw new NotFoundException('排课记录不存在');
    return schedule;
  }

  async create(data: any) {
    // 校验时间段不重叠
    await this.validateNoOverlap(data.programId, data.startTime, data.endTime, undefined, data.instructorId || null);

    // 校验 instructor 状态
    if (data.instructorId) {
      const instructor = await this.prisma.instructor.findUnique({ where: { id: data.instructorId } });
      if (!instructor || instructor.status !== 'ACTIVE') throw new BadRequestException('讲师不存在或非活跃状态');
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        programId: data.programId,
        courseId: data.courseId,
        instructorId: data.instructorId || null,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        location: data.location || null,
        remark: data.remark || null,
      },
    });

    // 通知讲师
    if (data.instructorId) {
      void this.notifyInstructor(data.instructorId, data.programId, 'ASSIGNED');
    }

    return schedule;
  }

  async update(id: number, data: any) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('排课记录不存在');

    const upd: any = {};
    if (data.courseId !== undefined) upd.courseId = data.courseId;
    if (data.instructorId !== undefined) upd.instructorId = data.instructorId || null;
    if (data.startTime) upd.startTime = new Date(data.startTime);
    if (data.endTime) upd.endTime = new Date(data.endTime);
    if (data.location !== undefined) upd.location = data.location;
    if (data.remark !== undefined) upd.remark = data.remark;

    // 如果时间变了，校验不重叠
    const programId = data.programId || schedule.programId;
    const startTime = upd.startTime || schedule.startTime;
    const endTime = upd.endTime || schedule.endTime;
    const instructorId = data.instructorId !== undefined ? data.instructorId : schedule.instructorId;
    if (data.startTime || data.endTime) {
      await this.validateNoOverlap(programId, startTime, endTime, id, instructorId);
    }

    // 校验 instructor 状态
    if (instructorId) {
      const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
      if (!instructor || instructor.status !== 'ACTIVE') throw new BadRequestException('讲师不存在或非活跃状态');
    }

    const updated = await this.prisma.schedule.update({ where: { id }, data: upd });

    // 讲师变更时通知新讲师
    if (data.instructorId !== undefined && data.instructorId && data.instructorId !== schedule.instructorId) {
      void this.notifyInstructor(data.instructorId, updated.programId, 'ASSIGNED');
    }

    return updated;
  }

  async delete(id: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('排课记录不存在');
    return this.prisma.schedule.delete({ where: { id } });
  }

  private async validateNoOverlap(programId: number, startTime: Date | string, endTime: Date | string, excludeId?: number, instructorId?: number | null) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 同培训班时间冲突
    const where: any = {
      programId,
      AND: [
        { startTime: { lt: end } },
        { endTime: { gt: start } },
      ],
    };
    if (excludeId) where.id = { not: excludeId };

    const overlapping = await this.prisma.schedule.findFirst({ where });
    if (overlapping) throw new BadRequestException('该时间段与已有排课冲突');

    // 跨培训班讲师时间冲突（P2-1）
    if (instructorId) {
      const instructorConflict = await this.prisma.schedule.findFirst({
        where: {
          instructorId,
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        include: { program: { select: { name: true } } },
      });
      if (instructorConflict) {
        throw new BadRequestException(
          `该讲师在「${instructorConflict.program?.name || '其他培训班'}」已有同时段排课（${new Date(instructorConflict.startTime).toLocaleString('zh-CN')}）`,
        );
      }
    }
  }

  /** 通知讲师排课变更 */
  private async notifyInstructor(instructorId: number, programId: number, action: 'ASSIGNED' | 'CHANGED') {
    try {
      const instructor = await this.prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { userId: true, realName: true },
      });
      if (!instructor?.userId) return;
      const program = await this.prisma.trainingProgram.findUnique({
        where: { id: programId },
        select: { name: true },
      });
      await this.notificationService.create(
        instructor.userId,
        'SCHEDULE_ASSIGNED' as any,
        action === 'ASSIGNED' ? '您有新的排课安排' : '您的排课已变更',
        `【${program?.name || ''}】已为您安排授课，请查看课表`,
        programId, 'program',
      );
    } catch { /* 通知失败不影响主流程 */ }
  }
}
