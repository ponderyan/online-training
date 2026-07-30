import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';

/**
 * 考试组织归属校验服务（全局共享）
 *
 * 所有通过 examId 访问考试子资源的端点，都应调用 assertAccess()
 * 验证当前用户是否有权访问该考试（基于组织树可见性）。
 *
 * 规则：
 * - SUPER_ADMIN → 放行
 * - exam.orgId = null（系统级）→ 对所有管理员可见
 * - 非超管 → exam.orgId 必须在用户可见组织列表（自身 + 子孙）内
 */
@Injectable()
export class ExamAccessService {
  constructor(private prisma: PrismaService) {}

  /**
   * 校验用户是否有权访问指定考试。
   * 不满足条件时抛出 NotFoundException（隐藏资源存在性）。
   *
   * @returns 考试的 { id, orgId, examMode } 供后续逻辑使用
   */
  async assertAccess(
    examId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null; examMode: string }> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, orgId: true, examMode: true },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    const roles = userRoles ?? [];

    // SUPER_ADMIN 不受组织隔离限制
    if (roles.includes('SUPER_ADMIN')) return exam;

    // 系统级考试（orgId=null）对所有管理员可见
    if (exam.orgId === null) return exam;

    // 无组织的用户不能访问组织级考试
    const uOrgId = userOrgId ?? null;
    if (uOrgId === null) throw new NotFoundException('考试不存在');

    // 检查考试所属组织是否在用户可见范围内
    const visibleOrgIds = await this.getVisibleOrgIds(uOrgId);
    if (!visibleOrgIds.includes(exam.orgId)) {
      throw new NotFoundException('考试不存在');
    }

    return exam;
  }

  /** 获取用户可见的组织ID列表（自身 + 所有子孙） */
  private async getVisibleOrgIds(userOrgId: number): Promise<number[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: userOrgId },
      select: { path: true },
    });
    if (!org?.path) return [userOrgId];
    const prefix = org.path.endsWith('/') ? org.path : org.path + '/';
    const descendants = await this.prisma.organization.findMany({
      where: { path: { startsWith: prefix }, id: { not: userOrgId } },
      select: { id: true },
    });
    return [userOrgId, ...descendants.map(d => d.id)];
  }
}
