import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; level?: string; type?: string; workUnit?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.realName = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.level) where.level = params.level;
    if (params.type) where.type = params.type;
    if (params.workUnit) where.workUnit = { contains: params.workUnit };

    const [items, total] = await Promise.all([
      this.prisma.instructor.findMany({
        where,
        include: { user: { select: { id: true, displayName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.instructor.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, username: true, phone: true, email: true } },
        _count: { select: { schedules: true, evaluations: true } },
      },
    });
    if (!instructor) throw new NotFoundException('讲师不存在');
    return instructor;
  }

  private async generateInstructorNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `INS${y}${m}${d}`;
    const last = await this.prisma.instructor.findFirst({
      where: { instructorNo: { startsWith: prefix } },
      orderBy: { instructorNo: 'desc' },
      select: { instructorNo: true },
    });
    const seq = last?.instructorNo ? parseInt(last.instructorNo.slice(-3)) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async create(data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new BadRequestException('关联用户不存在');
    const existing = await this.prisma.instructor.findUnique({ where: { userId: data.userId } });
    if (existing) throw new BadRequestException('该用户已注册为讲师');

    const instructorNo = await this.generateInstructorNo();

    return this.prisma.instructor.create({
      data: { ...data, instructorNo },
    });
  }

  async update(id: number, data: any) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id } });
    if (!instructor) throw new NotFoundException('讲师不存在');

    const upd: any = {};
    const fields = ['realName', 'title', 'phone', 'email', 'avatar', 'bio', 'expertise',
      'qualification', 'level', 'status', 'isGrader', 'remark',
      'type', 'workUnit', 'education', 'school', 'gender', 'idCard', 'bankAccount', 'contractExpire'];
    for (const f of fields) {
      if (data[f] !== undefined) upd[f] = data[f];
    }
    if (data.contractExpire !== undefined) upd.contractExpire = data.contractExpire ? new Date(data.contractExpire) : null;

    return this.prisma.instructor.update({ where: { id }, data: upd });
  }

  async delete(id: number) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id } });
    if (!instructor) throw new NotFoundException('讲师不存在');
    return this.prisma.instructor.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async getAvailableGraders() {
    return this.prisma.instructor.findMany({
      where: { status: 'ACTIVE', isGrader: true },
      select: { id: true, realName: true, title: true },
      orderBy: { realName: 'asc' },
    });
  }

  async getStats(id: number) {
    const schedules = await this.prisma.schedule.findMany({
      where: { instructorId: id },
      include: {
        course: { select: { name: true, hours: true } },
        program: { select: { name: true } },
      },
    });

    const evaluations = await this.prisma.evaluation.findMany({
      where: { instructorId: id },
      select: { instructorRating: true, overallRating: true },
    });

    return {
      totalSchedules: schedules.length,
      totalHours: schedules.reduce((sum, s) => sum + (s.course?.hours || 0), 0),
      avgInstructorRating: evaluations.length
        ? evaluations.reduce((sum, e) => sum + e.instructorRating, 0) / evaluations.length
        : null,
      avgOverallRating: evaluations.length
        ? evaluations.reduce((sum, e) => sum + e.overallRating, 0) / evaluations.length
        : null,
      schedules: schedules.map(s => ({
        courseName: s.course?.name,
        programName: s.program?.name,
        startTime: s.startTime,
        endTime: s.endTime,
        hours: s.course?.hours,
      })),
    };
  }
}
