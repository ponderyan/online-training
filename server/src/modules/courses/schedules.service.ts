import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

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
    await this.validateNoOverlap(data.programId, data.startTime, data.endTime);

    // 校验 instructor 状态
    if (data.instructorId) {
      const instructor = await this.prisma.instructor.findUnique({ where: { id: data.instructorId } });
      if (!instructor || instructor.status !== 'ACTIVE') throw new BadRequestException('讲师不存在或非活跃状态');
    }

    return this.prisma.schedule.create({
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
    if (data.startTime || data.endTime) {
      await this.validateNoOverlap(programId, startTime, endTime, id);
    }

    // 校验 instructor 状态
    const instructorId = data.instructorId !== undefined ? data.instructorId : schedule.instructorId;
    if (instructorId) {
      const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
      if (!instructor || instructor.status !== 'ACTIVE') throw new BadRequestException('讲师不存在或非活跃状态');
    }

    return this.prisma.schedule.update({ where: { id }, data: upd });
  }

  async delete(id: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('排课记录不存在');
    return this.prisma.schedule.delete({ where: { id } });
  }

  private async validateNoOverlap(programId: number, startTime: Date | string, endTime: Date | string, excludeId?: number) {
    const start = new Date(startTime);
    const end = new Date(endTime);

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
  }
}
