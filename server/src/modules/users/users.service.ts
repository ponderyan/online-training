import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** 获取用户可见的组织ID列表（自身 + 所有子孙） */
  private async getVisibleOrgIds(userOrgId: number): Promise<number[]> {
    const org = await this.prisma.organization.findUnique({ where: { id: userOrgId } });
    if (!org?.path) return [userOrgId];
    const prefix = org.path.endsWith('/') ? org.path : org.path + '/';
    const descendants = await this.prisma.organization.findMany({
      where: { path: { startsWith: prefix }, id: { not: userOrgId } },
      select: { id: true },
    });
    return [userOrgId, ...descendants.map(d => d.id)];
  }

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; role?: string; userOrgId?: number | null; userRoles?: string[] }) {
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

    // ★ orgId 隔离：非 SUPER_ADMIN 可见自身+子孙组织的用户
    const isSuperAdmin = params.userRoles?.includes('SUPER_ADMIN');
    if (!isSuperAdmin && params.userOrgId) {
      const visibleOrgIds = await this.getVisibleOrgIds(params.userOrgId);
      where.orgId = { in: visibleOrgIds };
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

  /** 管理员创建用户（可指定角色和组织） */
  async adminCreate(data: {
    username: string;
    password: string;
    displayName: string;
    phone?: string;
    email?: string;
    orgId?: number;
    roles?: string[];
  }, callerOrgId?: number | null) {
    if (!data.username || !data.password || !data.displayName) {
      throw new BadRequestException('缺少必要参数：username, password, displayName');
    }
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictException('用户名已存在');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        passwordHash,
        orgId: data.orgId ?? callerOrgId ?? null,
        phone: data.phone || null,
        email: data.email || null,
        isActive: true,
      },
    });

    // 分配角色（默认 STUDENT）
    const roleCodes = data.roles?.length ? data.roles : ['STUDENT'];
    const roles = await this.prisma.role.findMany({ where: { code: { in: roleCodes } } });
    for (const role of roles) {
      await this.prisma.userRoleAssignment.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    const { passwordHash: _, ...result } = user;
    return { ...result, roles: roleCodes };
  }
}
