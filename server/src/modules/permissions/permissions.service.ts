import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Permissions, ROLE_PERMISSIONS } from '../../common/permissions.constants.js';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /** 获取所有角色（含用户计数） */
  async getRoles() {
    const roles = await this.prisma.role.findMany({ orderBy: { sortOrder: 'asc' } });
    const counts = await this.prisma.userRoleAssignment.groupBy({
      by: ['roleId'],
      _count: true,
    });
    const countMap = new Map(counts.map(c => [c.roleId, c._count]));
    return roles.map(r => ({
      ...r,
      userCount: countMap.get(r.id) || 0,
    }));
  }

  /** 创建角色（支持从已有角色复制权限） */
  async createRole(data: { name: string; code: string; description?: string; color?: string; copyFromRoleId?: number }) {
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || '',
        color: data.color || null,
        sortOrder: 99,
      },
    });

    if (data.copyFromRoleId) {
      const sourcePerms = await this.prisma.rolePermission.findMany({
        where: { roleId: data.copyFromRoleId },
      });
      if (sourcePerms.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: sourcePerms.map(p => ({
            roleId: role.id,
            permission: p.permission,
            isGranted: p.isGranted,
          })),
        });
      }
    }

    return role;
  }

  /** 更新角色 */
  async updateRole(id: number, data: { name?: string; description?: string; isActive?: boolean; color?: string }) {
    return this.prisma.role.update({ where: { id }, data });
  }

  /** 删除角色（系统角色不可删） */
  async deleteRole(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new Error('角色不存在');
    if (role.isSystem) throw new Error('系统内置角色不可删除');
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  /** 获取角色下的用户列表（分页） */
  async getRoleUsers(roleId: number, page = 1, pageSize = 20, search?: string) {
    const where: any = {
      roleAssignments: { some: { roleId } },
    };
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { displayName: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, displayName: true,
          isActive: true, createdAt: true,
          org: { select: { name: true } },
          roleAssignments: {
            where: { roleId },
            select: { id: true, createdAt: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(u => ({
        id: u.id, username: u.username, displayName: u.displayName,
        isActive: u.isActive, createdAt: u.createdAt,
        orgName: u.org?.name || '—',
        assignmentId: u.roleAssignments[0]?.id || null,
        assignedAt: u.roleAssignments[0]?.createdAt || null,
      })),
      total, page, pageSize,
    };
  }

  /** 移除用户的某个角色 */
  async removeUserRole(assignmentId: number) {
    return this.prisma.userRoleAssignment.delete({ where: { id: assignmentId } });
  }

  /** 为用户添加角色 */
  async addUserRole(userId: number, roleId: number) {
    return this.prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  /** 获取所有角色-权限映射 */
  async getAll() {
    const roles = await this.prisma.role.findMany({ orderBy: { sortOrder: 'asc' } });
    const overrides = await this.prisma.rolePermission.findMany();
    const overrideMap = new Map(overrides.map(r => [`${r.roleId}:${r.permission}`, r.isGranted]));

    const allPermissions = Object.values(Permissions);

    const matrix = roles.map(role => {
      const defaultPerms = ROLE_PERMISSIONS[role.code as keyof typeof ROLE_PERMISSIONS] || [];
      const perms = allPermissions.map(perm => {
        const key = `${role.id}:${perm}`;
        const granted = overrideMap.has(key) ? overrideMap.get(key) : defaultPerms.includes(perm);
        return { permission: perm, granted };
      });
      return { roleId: role.id, role: role.code, roleName: role.name, color: role.color, isSystem: role.isSystem, permissions: perms };
    });

    return { roles, permissions: allPermissions, matrix };
  }

  /** 初始化种子数据 */
  async seed() {
    const roles = await this.prisma.role.findMany();
    const allPermissions = Object.values(Permissions);

    for (const role of roles) {
      const defaultPerms = ROLE_PERMISSIONS[role.code as keyof typeof ROLE_PERMISSIONS] || [];
      for (const perm of allPermissions) {
        const isGranted = defaultPerms ? defaultPerms.includes(perm) : false;
        await this.prisma.rolePermission.upsert({
          where: { roleId_permission: { roleId: role.id, permission: perm } },
          create: { roleId: role.id, permission: perm, isGranted },
          update: { isGranted },
        });
      }
    }
    return { success: true };
  }

  /** 更新角色权限（含审计日志） */
  async updateRolePerms(roleId: number, permissions: { permission: string; granted: boolean }[]) {
    const before = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: true, isGranted: true },
    });
    const beforeMap = new Map(before.map(p => [p.permission, p.isGranted]));

    for (const p of permissions) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permission: { roleId, permission: p.permission } },
        create: { roleId, permission: p.permission, isGranted: p.granted },
        update: { isGranted: p.granted },
      });
    }

    const changes: { permission: string; from: boolean | null; to: boolean }[] = [];
    for (const p of permissions) {
      const beforeVal = beforeMap.get(p.permission) ?? null;
      if (beforeVal !== p.granted) {
        changes.push({ permission: p.permission, from: beforeVal, to: p.granted });
      }
    }
    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'Role',
          entityId: roleId,
          action: 'UPDATE_PERMISSIONS',
          after: { changes },
          operatorId: 0,
          operatorName: 'system',
        },
      });
    }

    return { success: true };
  }
}
