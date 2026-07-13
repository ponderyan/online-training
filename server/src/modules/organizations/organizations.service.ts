import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// 树节点类型（含子节点与计数）
export interface OrgNode {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  level: number;
  path: string | null;
  sortOrder: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  userCount: number;
  programCount: number;
  childOrgCount: number;
  children: OrgNode[];
}

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  /** 平级列表（保留旧接口） */
  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { users: true, programs: true, children: true } } },
    });
  }

  async findOne(id: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, programs: true, children: true } } },
    });
    if (!org) throw new NotFoundException('机构不存在');
    return org;
  }

  /** 完整组织树（嵌套结构） */
  async getTree(): Promise<OrgNode[]> {
    const orgs = await this.prisma.organization.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { users: true, programs: true, children: true } } },
    });

    const nodeMap = new Map<number, OrgNode>();
    for (const o of orgs) {
      nodeMap.set(o.id, {
        id: o.id, name: o.name, code: o.code,
        parentId: o.parentId, level: o.level, path: o.path, sortOrder: o.sortOrder,
        contactName: o.contactName, contactPhone: o.contactPhone, contactEmail: o.contactEmail,
        isActive: o.isActive,
        userCount: o._count.users, programCount: o._count.programs,
        childOrgCount: o._count.children,
        children: [],
      });
    }

    const roots: OrgNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** 创建组织（支持 parentId，自动算 level/path） */
  async create(data: {
    name: string; code: string; parentId?: number | null;
    contactName?: string; contactPhone?: string; contactEmail?: string;
  }) {
    const existing = await this.prisma.organization.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('机构编码已存在');

    let level = 1;
    let parentPath: string | null = null;
    let sortOrder = 0;

    if (data.parentId) {
      const parent = await this.prisma.organization.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new BadRequestException('父级组织不存在');
      level = parent.level + 1;
      parentPath = parent.path;
      sortOrder = await this.prisma.organization.count({ where: { parentId: data.parentId } });
    } else {
      sortOrder = await this.prisma.organization.count({ where: { parentId: null } });
    }

    const created = await this.prisma.organization.create({
      data: {
        name: data.name,
        code: data.code,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        parentId: data.parentId || null,
        level,
        sortOrder,
      },
    });

    // 补全物化路径：父path + id + '/'
    const fullPath = `${parentPath || '/'}${created.id}/`.replace('//', '/');
    return this.prisma.organization.update({
      where: { id: created.id },
      data: { path: fullPath },
    });
  }

  async update(id: number, data: { name?: string; contactName?: string; contactPhone?: string; contactEmail?: string; isActive?: boolean; sortOrder?: number }) {
    await this.findOne(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  /** 移动组织到新父级下（重算 level/path 及所有子孙） */
  async move(id: number, newParentId: number | null) {
    if (newParentId === id) throw new BadRequestException('不能将组织移动到自身下');

    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('机构不存在');

    let newLevel = 1;
    let newParentPath: string | null = null;

    if (newParentId) {
      const newParent = await this.prisma.organization.findUnique({ where: { id: newParentId } });
      if (!newParent) throw new BadRequestException('目标父级组织不存在');
      // 防止移动到自己的子孙下（会造成环）
      if (newParent.path && org.path && newParent.path.startsWith(org.path)) {
        throw new BadRequestException('不能将组织移动到其下属组织下');
      }
      newLevel = newParent.level + 1;
      newParentPath = newParent.path;
    }

    const oldPath = org.path;
    const newPath = `${newParentPath || '/'}${id}/`.replace('//', '/');
    const levelDelta = newLevel - org.level;

    // 更新自身
    await this.prisma.organization.update({
      where: { id },
      data: { parentId: newParentId, level: newLevel, path: newPath },
    });

    // 更新所有子孙：path 前缀替换 + level 偏移
    if (oldPath && newPath !== oldPath) {
      const descendants = await this.prisma.organization.findMany({
        where: { path: { startsWith: oldPath }, NOT: { id } },
      });
      for (const d of descendants) {
        if (d.path && oldPath) {
          const updatedPath = newPath + d.path.slice(oldPath.length);
          await this.prisma.organization.update({
            where: { id: d.id },
            data: { path: updatedPath, level: d.level + levelDelta },
          });
        }
      }
    }

    return this.findOne(id);
  }

  /** 删除组织（有下级/用户/培训班不可删） */
  async remove(id: number) {
    const org = await this.findOne(id);
    // 检查下级组织
    const childCount = await this.prisma.organization.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('请先删除下级组织');
    }
    const userCount = await this.prisma.user.count({ where: { orgId: id } });
    const programCount = await this.prisma.trainingProgram.count({ where: { orgId: id } });
    if (userCount > 0 || programCount > 0) {
      throw new BadRequestException(`该组织下还有 ${userCount} 个用户和 ${programCount} 个培训班，无法删除`);
    }
    return this.prisma.organization.delete({ where: { id } });
  }

  /**
   * 批量导入组织
   * - parentName 匹配已有组织名称确定 parentId；为空或未匹配则创建为根组织
   * - 自动计算 level / path / sortOrder
   * - 返回导入结果（成功数、跳过数、错误明细）
   */
  async importOrganizations(rows: { name: string; parentName?: string; sortOrder?: number }[]) {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 预加载所有组织名称 → id 映射（含本次新建的，便于后续行引用）
    const nameToId = new Map<string, number>();
    const existing = await this.prisma.organization.findMany({ select: { id: true, name: true } });
    for (const o of existing) nameToId.set(o.name, o.id);

    // 已用编码集合（避免导入时重复 code）—— 导入场景下 code 由 name 拼音/序号生成
    const usedCodes = new Set<string>(
      (await this.prisma.organization.findMany({ select: { code: true } })).map(o => o.code),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 2; // Excel 第1行是表头，数据从第2行开始
      const name = (row.name || '').trim();
      if (!name) {
        errors.push(`第${lineNo}行：组织名称不能为空`);
        skipped++;
        continue;
      }
      if (nameToId.has(name)) {
        errors.push(`第${lineNo}行：组织名称「${name}」已存在，跳过`);
        skipped++;
        continue;
      }

      // 解析父级
      let parentId: number | null = null;
      let level = 1;
      let parentPath: string | null = null;
      const parentName = (row.parentName || '').trim();
      if (parentName) {
        const pid = nameToId.get(parentName);
        if (!pid) {
          errors.push(`第${lineNo}行：上级组织「${parentName}」未找到，已作为根组织创建`);
          // 不阻断，降级为根组织
        } else {
          parentId = pid;
          const parent = await this.prisma.organization.findUnique({ where: { id: pid } });
          if (parent) {
            level = parent.level + 1;
            parentPath = parent.path;
          }
        }
      }

      // 生成唯一 code（ORG-时间戳-序号，避免冲突）
      let code = `ORG-${Date.now().toString(36).toUpperCase()}-${imported + 1}`;
      while (usedCodes.has(code)) {
        code = `ORG-${Date.now().toString(36).toUpperCase()}-${imported + 1}-${Math.floor(Math.random() * 1000)}`;
      }
      usedCodes.add(code);

      // sortOrder：用户指定优先，否则取同级现有数量
      const sortOrder = row.sortOrder ?? await this.prisma.organization.count({
        where: { parentId },
      });

      try {
        const created = await this.prisma.organization.create({
          data: { name, code, parentId, level, sortOrder },
        });
        const fullPath = `${parentPath || '/'}${created.id}/`.replace('//', '/');
        await this.prisma.organization.update({ where: { id: created.id }, data: { path: fullPath } });
        nameToId.set(name, created.id);
        imported++;
      } catch (e: any) {
        errors.push(`第${lineNo}行：创建失败（${e.message || '未知错误'}）`);
        skipped++;
      }
    }

    return { success: true, imported, skipped, errors };
  }

  /**
   * 迁移学员：将该组织下所有学员用户的 orgId 更新为目标组织
   * - 学时记录 / 考试记录通过 studentId 关联 User，User.orgId 变更后自动归属新组织
   * - moveHours / moveExams 选项保留兼容（数据本身随用户迁移，此处仅做计数返回）
   * - 防止迁移到自身或子孙组织
   */
  async migrateStudents(id: number, targetOrgId: number, options?: { moveHours?: boolean; moveExams?: boolean }) {
    const org = await this.findOne(id);
    if (id === targetOrgId) throw new BadRequestException('不能迁移到自身组织');
    const target = await this.findOne(targetOrgId);
    // 防止迁移到自己的子孙下
    if (target.path && org.path && target.path.startsWith(org.path)) {
      throw new BadRequestException('不能迁移到下属组织');
    }

    // 该组织下的学员用户（含子孙组织下的学员也一并迁移）
    let orgIds = [id];
    if (org.path) {
      const descendants = await this.prisma.organization.findMany({
        where: { path: { startsWith: org.path }, NOT: { id } },
        select: { id: true },
      });
      orgIds = orgIds.concat(descendants.map(d => d.id));
    }

    const students = await this.prisma.user.findMany({
      where: { orgId: { in: orgIds }, roleAssignments: { some: { role: { code: 'STUDENT' } } } },
      select: { id: true },
    });
    const studentIds = students.map(s => s.id);

    if (studentIds.length === 0) {
      return { migrated: 0, message: '该组织下无学员' };
    }

    // 更新学员的 orgId
    const result = await this.prisma.user.updateMany({
      where: { id: { in: studentIds } },
      data: { orgId: targetOrgId },
    });

    return {
      migrated: result.count,
      targetOrgName: target.name,
      moveHours: options?.moveHours ?? false,
      moveExams: options?.moveExams ?? false,
    };
  }

  /** 数据范围预览：该组织 + 所有子孙下的可见数据量 */
  async getDataScope(id: number) {
    const org = await this.findOne(id);
    // 收集该组织 + 所有子孙 id
    let orgIds = [id];
    if (org.path) {
      const descendants = await this.prisma.organization.findMany({
        where: { path: { startsWith: org.path }, NOT: { id } },
        select: { id: true },
      });
      orgIds = orgIds.concat(descendants.map(d => d.id));
    }

    const orgCount = orgIds.length;

    // 该组织+子孙下的学员（Certificate 无 orgId，需经学员间接统计）
    const studentUsers = await this.prisma.user.findMany({
      where: { orgId: { in: orgIds }, roleAssignments: { some: { role: { code: 'STUDENT' } } } },
      select: { id: true },
    });
    const studentIds = studentUsers.map(s => s.id);
    const studentCount = studentIds.length;

    const [examCount, programCount, certCount] = await Promise.all([
      this.prisma.exam.count({ where: { orgId: { in: orgIds } } }),
      this.prisma.trainingProgram.count({ where: { orgId: { in: orgIds } } }),
      this.prisma.certificate.count({ where: { studentId: { in: studentIds } } }),
    ]);

    return {
      orgCount,
      descendantCount: orgCount - 1,
      examCount,
      studentCount,
      programCount,
      certCount,
    };
  }

  /** 该组织下的用户列表（按角色分组） */
  async getOrgUsers(id: number) {
    await this.findOne(id);
    const users = await this.prisma.user.findMany({
      where: { orgId: id },
      select: {
        id: true, username: true, displayName: true, isActive: true,
        roleAssignments: { include: { role: { select: { id: true, name: true, code: true, color: true } } } },
      },
      orderBy: { displayName: 'asc' },
    });

    // 按角色分组
    const groups: Record<string, { roleId: number; roleName: string; roleCode: string; color: string | null; users: any[] }> = {};
    for (const u of users) {
      for (const ra of u.roleAssignments) {
        const key = ra.role.code;
        if (!groups[key]) {
          groups[key] = { roleId: ra.role.id, roleName: ra.role.name, roleCode: ra.role.code, color: ra.role.color, users: [] };
        }
        groups[key].users.push({
          id: u.id, username: u.username, displayName: u.displayName, isActive: u.isActive,
        });
      }
    }
    return { total: users.length, groups: Object.values(groups) };
  }
}
