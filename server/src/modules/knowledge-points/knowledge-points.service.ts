import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class KnowledgePointsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════
  //  权限辅助：知识点管理权跟随科目归属
  // ═══════════════════════════════════════════

  /**
   * 检查用户是否有权管理指定科目下的知识点
   * 规则：SUPER_ADMIN 全权 | 科目归属组织可管理 | 其余只读
   */
  private async assertSubjectManageable(subjectId: number, userOrgId: number | null, userRoles: string[]) {
    if (userRoles.includes('SUPER_ADMIN')) return; // 超管全权

    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { orgId: true } });
    if (!subject) throw new NotFoundException('科目不存在');

    // 科目无归属（平台级）→ 仅 SUPER_ADMIN 可管理（上面已返回）
    if (subject.orgId === null) {
      throw new ForbiddenException('平台级科目的知识点仅超级管理员可管理');
    }
    // 科目归属当前用户组织 → 可管理
    if (subject.orgId === userOrgId) return;

    throw new ForbiddenException('无权管理其他组织定义的科目下的知识点');
  }

  /** 判断某科目对当前用户是否可管理（不抛异常，返回布尔） */
  private async isSubjectManageable(subjectId: number, userOrgId: number | null, userRoles: string[]): Promise<boolean> {
    if (userRoles.includes('SUPER_ADMIN')) return true;
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { orgId: true } });
    if (!subject) return false;
    if (subject.orgId === null) return false;
    return subject.orgId === userOrgId;
  }

  // ═══════════════════════════════════════════
  //  CRUD
  // ═══════════════════════════════════════════

  /** 获取树形结构，可按科目过滤，附带 manageable 标记 */
  async getTree(subjectId?: number, userOrgId?: number | null, userRoles?: string[]) {
    const where: any = { isActive: true };
    if (subjectId !== undefined) where.subjectId = subjectId;
    const all = await this.prisma.knowledgePoint.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { subject: { select: { orgId: true } } },
    });

    const roles = userRoles || [];
    const isSuperAdmin = roles.includes('SUPER_ADMIN');

    // 为每个节点附加 manageable
    const enriched = all.map(kp => ({
      ...kp,
      manageable: isSuperAdmin ? true : (kp.subject?.orgId != null && kp.subject?.orgId === userOrgId),
    }));

    return this.buildTree(enriched, null);
  }

  private buildTree(nodes: any[], parentId: number | null): any[] {
    return nodes
      .filter(n => n.parentId === parentId)
      .map(n => ({ ...n, children: this.buildTree(nodes, n.id) }));
  }

  async getOne(id: number) {
    const kp = await this.prisma.knowledgePoint.findUnique({
      where: { id },
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!kp) throw new NotFoundException('知识点不存在');
    return kp;
  }

  async create(data: { name: string; code?: string; description?: string; subjectId?: number; parentId?: number; sortOrder?: number }, userOrgId?: number | null, userRoles?: string[]) {
    // 权限校验：必须有 subjectId 且用户对该科目有管理权
    if (!data.subjectId) throw new ForbiddenException('创建知识点必须指定科目（subjectId）');
    await this.assertSubjectManageable(data.subjectId, userOrgId ?? null, userRoles || []);
    return this.prisma.knowledgePoint.create({ data: { ...data, sortOrder: data.sortOrder || 0 } });
  }

  async update(id: number, data: { name?: string; code?: string; description?: string; subjectId?: number; parentId?: number; sortOrder?: number; isActive?: boolean }, userOrgId?: number | null, userRoles?: string[]) {
    const kp = await this.getOne(id);
    // 权限校验：基于知识点所属科目
    if (!kp.subjectId) throw new ForbiddenException('知识点未关联科目，无法校验权限');
    await this.assertSubjectManageable(kp.subjectId, userOrgId ?? null, userRoles || []);
    return this.prisma.knowledgePoint.update({ where: { id }, data });
  }

  async remove(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const kp = await this.getOne(id);
    if (!kp.subjectId) throw new ForbiddenException('知识点未关联科目，无法校验权限');
    await this.assertSubjectManageable(kp.subjectId, userOrgId ?? null, userRoles || []);
    // 软删
    return this.prisma.knowledgePoint.update({ where: { id }, data: { isActive: false } });
  }

  // ═══════════════════════════════════════════
  //  题目 ↔ 知识点关联
  // ═══════════════════════════════════════════

  async getQuestionKnowledgePoints(questionId: number) {
    return this.prisma.questionKnowledgePoint.findMany({
      where: { questionId },
      include: { knowledgePoint: { select: { id: true, name: true, code: true } } },
    });
  }

  async setQuestionKnowledgePoints(questionId: number, knowledgePointIds: number[]) {
    // 删除旧的关联
    await this.prisma.questionKnowledgePoint.deleteMany({ where: { questionId } });
    // 创建新的关联
    if (knowledgePointIds.length > 0) {
      await this.prisma.questionKnowledgePoint.createMany({
        data: knowledgePointIds.map(kpId => ({ questionId, knowledgePointId: kpId })),
      });
    }
    return this.getQuestionKnowledgePoints(questionId);
  }
}
