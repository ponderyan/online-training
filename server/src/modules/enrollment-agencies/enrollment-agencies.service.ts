import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EnrollmentAgenciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; keyword?: string }) {
    const page = params.page || 1;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
    const [items, total] = await Promise.all([
      this.prisma.enrollmentAgency.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
      this.prisma.enrollmentAgency.count({ where }),
    ]);
    return { items, total, page, pageSize: 20, totalPages: Math.ceil(total / 20) };
  }

  async findOne(id: number) { return this.prisma.enrollmentAgency.findUnique({ where: { id } }); }
  async create(data: any) { return this.prisma.enrollmentAgency.create({ data }); }
  async update(id: number, data: any) { return this.prisma.enrollmentAgency.update({ where: { id }, data }); }
  async delete(id: number) { return this.prisma.enrollmentAgency.delete({ where: { id } }); }
}
