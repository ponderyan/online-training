import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, programs: true } } },
    });
  }

  async findOne(id: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, programs: true } } },
    });
    if (!org) throw new NotFoundException('机构不存在');
    return org;
  }

  async create(data: { name: string; code: string; contactName?: string; contactPhone?: string; contactEmail?: string }) {
    const existing = await this.prisma.organization.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('机构编码已存在');
    return this.prisma.organization.create({ data });
  }

  async update(id: number, data: { name?: string; contactName?: string; contactPhone?: string; contactEmail?: string; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    // 检查是否有用户或培训班关联
    const userCount = await this.prisma.user.count({ where: { orgId: id } });
    const programCount = await this.prisma.trainingProgram.count({ where: { orgId: id } });
    if (userCount > 0 || programCount > 0) {
      throw new BadRequestException(`该机构下还有 ${userCount} 个用户和 ${programCount} 个培训班，无法删除`);
    }
    return this.prisma.organization.delete({ where: { id } });
  }
}
