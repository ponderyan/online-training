import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.subject.findMany({
      include: {
        organization: { select: { id: true, name: true, code: true, orgType: true } },
        _count: {
          select: {
            chapters: true,
            questions: true,
            knowledgePoints: true,
            knowledgeChunks: true,
            knowledgeDocuments: true,
            materials: true,
            templates: true,
            papers: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { sortOrder: 'asc' } },
        _count: {
          select: {
            chapters: true,
            questions: true,
            knowledgePoints: true,
            knowledgeChunks: true,
            knowledgeDocuments: true,
            materials: true,
            templates: true,
            papers: true,
          },
        },
      },
    });
    if (!subject) throw new NotFoundException(`Subject ${id} not found`);
    return subject;
  }

  async create(data: { name: string; code: string; description?: string; sortOrder?: number; orgId?: number }) {
    const existing = await this.prisma.subject.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictException(`科目代码 "${data.code}" 已存在`);
    return this.prisma.subject.create({ data });
  }

  async update(id: number, data: { name?: string; code?: string; description?: string; sortOrder?: number; isActive?: boolean }) {
    const subject = await this.findOne(id);
    if (data.code) {
      const existing = await this.prisma.subject.findUnique({ where: { code: data.code } });
      if (existing && existing.id !== id) throw new ConflictException(`科目代码 "${data.code}" 已存在`);
    }
    // 停用前检查：是否有进行中的考试关联此科目的试卷
    if (data.isActive === false && subject.isActive) {
      const activeExams = await this.prisma.exam.count({
        where: {
          status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
          paper: { subjectId: id },
        },
      });
      if (activeExams > 0) {
        throw new BadRequestException(`该科目下有 ${activeExams} 场进行中/已发布的考试，无法停用`);
      }
    }
    return this.prisma.subject.update({ where: { id }, data });
  }

  async remove(id: number) {
    const subject = await this.findOne(id);

    // 系统内置科目禁止删除
    if (subject.isSystem) {
      throw new ForbiddenException('系统内置科目不可删除，仅可停用');
    }

    // 协会级科目（orgId 存在且为顶级组织）禁止删除，仅可停用
    if (subject.orgId) {
      const org = await this.prisma.organization.findUnique({ where: { id: subject.orgId }, select: { orgType: true } });
      if (org?.orgType === 'ASSOCIATION') {
        throw new ForbiddenException('协会级科目不可删除，仅可停用');
      }
    }

    const counts = subject._count;

    // 全面检查所有关联实体
    const issues: string[] = [];
    if (counts.questions > 0) issues.push(`${counts.questions} 道题目`);
    if (counts.knowledgePoints > 0) issues.push(`${counts.knowledgePoints} 个知识点`);
    if (counts.chapters > 0) issues.push(`${counts.chapters} 个章节`);
    if (counts.papers > 0) issues.push(`${counts.papers} 份试卷`);
    if (counts.templates > 0) issues.push(`${counts.templates} 个组卷模板`);
    if (counts.knowledgeDocuments > 0) issues.push(`${counts.knowledgeDocuments} 个知识文档`);
    if (counts.knowledgeChunks > 0) issues.push(`${counts.knowledgeChunks} 个知识块`);
    if (counts.materials > 0) issues.push(`${counts.materials} 份教材`);

    // 检查培训班引用（TrainingProgram.subjectId）
    const programCount = await this.prisma.trainingProgram.count({ where: { subjectId: id } });
    if (programCount > 0) issues.push(`${programCount} 个培训班`);

    if (issues.length > 0) {
      throw new ConflictException(`该科目下还有 ${issues.join('、')}，无法删除。请先迁移或清理关联数据。`);
    }

    return this.prisma.subject.delete({ where: { id } });
  }

  async findPublic() {
    return this.prisma.subject.findMany({
      where: {
        isActive: true,
        questions: { some: { status: 'PUBLISHED', isPublic: true } },
      },
      select: { id: true, name: true, code: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** 获取活跃科目列表（供前端选择器使用，根据用户orgId自动过滤可见范围） */
  async findActive(userOrgId?: number | null) {
    const visibleOrgIds = userOrgId ? await this.getVisibleOrgIds(userOrgId) : null;
    const where: any = { isActive: true };
    if (visibleOrgIds) {
      where.OR = [
        { orgId: null },                    // 平台级（无归属）
        { orgId: { in: visibleOrgIds } },   // 可见组织范围
      ];
    }
    return this.prisma.subject.findMany({
      where,
      select: {
        id: true, name: true, code: true, sortOrder: true, orgId: true,
        organization: { select: { id: true, name: true, code: true, orgType: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** 管理端：全量科目列表（带 ownership 标记） */
  async findAllWithOwnership(userOrgId?: number | null) {
    const subjects = await this.findAll();
    if (!userOrgId) {
      // SUPER_ADMIN 或无orgId用户：全部可管理
      return subjects.map(s => ({ ...s, ownership: 'OWN' as const, manageable: true }));
    }

    const org = await this.prisma.organization.findUnique({ where: { id: userOrgId } });
    const ancestorIds = this.parseAncestorIds(org?.path, userOrgId);
    const descendantIds = await this.getDescendantOrgIds(userOrgId);

    return subjects.map(s => {
      let ownership: 'OWN' | 'ANCESTOR' | 'CHILD' = 'OWN';
      let manageable = true;

      if (s.orgId === null) {
        // 平台级科目：所有人可见，仅SUPER可管理
        ownership = 'ANCESTOR';
        manageable = false;
      } else if (s.orgId === userOrgId) {
        ownership = 'OWN';
        manageable = true;
      } else if (ancestorIds.includes(s.orgId)) {
        ownership = 'ANCESTOR';
        manageable = false;
      } else if (descendantIds.includes(s.orgId)) {
        ownership = 'CHILD';
        manageable = false;
      } else {
        // 不属于可见范围（理论上不应出现）
        ownership = 'CHILD';
        manageable = false;
      }
      return { ...s, ownership, manageable };
    });
  }

  /** 计算用户可见的所有组织ID（自身 + 祖先 + 子孙） */
  private async getVisibleOrgIds(userOrgId: number): Promise<number[]> {
    const org = await this.prisma.organization.findUnique({ where: { id: userOrgId } });
    const ancestorIds = this.parseAncestorIds(org?.path, userOrgId);
    const descendantIds = await this.getDescendantOrgIds(userOrgId);
    return [...new Set([userOrgId, ...ancestorIds, ...descendantIds])];
  }

  /** 从 path 解析祖先ID列表（不含自身） */
  private parseAncestorIds(path: string | null | undefined, selfId: number): number[] {
    if (!path) return [];
    return path.split('/').filter(Boolean).map(Number).filter(id => id !== selfId);
  }

  /** 获取所有子孙组织ID */
  private async getDescendantOrgIds(orgId: number): Promise<number[]> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.path) return [];
    const prefix = org.path.endsWith('/') ? org.path : org.path + '/';
    const descendants = await this.prisma.organization.findMany({
      where: { path: { startsWith: prefix }, id: { not: orgId } },
      select: { id: true },
    });
    return descendants.map(d => d.id);
  }
}
