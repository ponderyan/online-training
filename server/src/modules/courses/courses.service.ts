import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; type?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        parentCourse: { select: { id: true, name: true } },
        childCourses: { select: { id: true, name: true } },
        videoCourseLinks: {
          include: {
            videoCourse: {
              select: {
                id: true, name: true, description: true,
                duration: true, hours: true, url: true,
                coverUrl: true, type: true, status: true,
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('课程不存在');
    return course;
  }

  async create(data: any) {
    return this.prisma.course.create({ data });
  }

  async update(id: number, data: any) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('课程不存在');
    const upd: any = {};
    const fields = ['name', 'code', 'description', 'hours', 'syllabus', 'status', 'remark', 'type', 'parentCourseId', 'isReviewed'];
    for (const f of fields) {
      if (data[f] !== undefined) upd[f] = data[f];
    }
    return this.prisma.course.update({ where: { id }, data: upd });
  }

  async delete(id: number) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('课程不存在');
    return this.prisma.course.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
