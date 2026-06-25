import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; role?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) {
      where.OR = [
        { displayName: { contains: params.keyword } },
        { username: { contains: params.keyword } },
        { phone: { contains: params.keyword } },
      ];
    }
    if (params.role) {
      where.roleAssignments = { some: { role: { code: params.role } } };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, displayName: true,
          phone: true, email: true, orgId: true, isActive: true,
          createdAt: true, lastLoginAt: true, loginCount: true,
          org: { select: { name: true } },
          roleAssignments: {
            select: { role: { select: { code: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = items.map(u => ({
      ...u,
      orgName: (u as any).org?.name || null,
      roles: (u as any).roleAssignments?.map((ra: any) => ra.role.code) || [],
    }));

    return { items: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, displayName: true,
        phone: true, email: true, orgId: true, isActive: true,
        createdAt: true, lastLoginAt: true, loginCount: true,
        org: { select: { name: true } },
        roleAssignments: {
          select: { role: { select: { code: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      ...user,
      orgName: (user as any).org?.name || null,
      roles: (user as any).roleAssignments?.map((ra: any) => ra.role.code) || [],
    };
  }

  async update(id: number, data: { displayName?: string; phone?: string; email?: string; isActive?: boolean; roles?: string[] }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const upd: any = {};
    if (data.displayName !== undefined) upd.displayName = data.displayName;
    if (data.phone !== undefined) upd.phone = data.phone;
    if (data.email !== undefined) upd.email = data.email;
    if (data.isActive !== undefined) upd.isActive = data.isActive;

    const result = await this.prisma.user.update({ where: { id }, data: upd });

    // 更新角色分配
    if (data.roles && Array.isArray(data.roles)) {
      await this.prisma.userRoleAssignment.deleteMany({ where: { userId: id } });
      for (const code of data.roles) {
        const role = await this.prisma.role.findUnique({ where: { code } });
        if (role) {
          await this.prisma.userRoleAssignment.create({ data: { userId: id, roleId: role.id } });
        }
      }
    }

    return result;
  }
}
