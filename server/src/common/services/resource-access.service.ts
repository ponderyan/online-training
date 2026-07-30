import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';

/**
 * 通用资源组织归属校验服务（全局共享）
 *
 * 覆盖 TrainingProgram / Paper / Certificate / LearningHourCertificate / Material 等
 * 拥有 orgId 字段（或间接关联 orgId）的实体。
 *
 * 规则（与 ExamAccessService 一致）：
 * - SUPER_ADMIN → 放行
 * - entity.orgId = null（系统级）→ 对所有管理员可见
 * - 非超管 → entity.orgId 必须在用户可见组织列表（自身 + 子孙）内
 */
@Injectable()
export class ResourceAccessService {
  constructor(private prisma: PrismaService) {}

  // ─── 培训班 ───
  async assertProgramAccess(
    programId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null }> {
    const entity = await this.prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: { id: true, orgId: true },
    });
    if (!entity) throw new NotFoundException('培训班不存在');
    return this.checkOrg(entity, '培训班', userOrgId, userRoles);
  }

  // ─── 试卷 ───
  async assertPaperAccess(
    paperId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null }> {
    const entity = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, orgId: true },
    });
    if (!entity) throw new NotFoundException('试卷不存在');
    return this.checkOrg(entity, '试卷', userOrgId, userRoles);
  }

  // ─── 证书 ───
  async assertCertificateAccess(
    certId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null }> {
    const entity = await this.prisma.certificate.findUnique({
      where: { id: certId },
      select: { id: true, orgId: true },
    });
    if (!entity) throw new NotFoundException('证书不存在');
    return this.checkOrg(entity, '证书', userOrgId, userRoles);
  }

  // ─── 学时证明 ───
  async assertLhcAccess(
    lhcId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null }> {
    const entity = await this.prisma.learningHourCertificate.findUnique({
      where: { id: lhcId },
      select: { id: true, orgId: true },
    });
    if (!entity) throw new NotFoundException('学时证明不存在');
    return this.checkOrg(entity, '学时证明', userOrgId, userRoles);
  }

  // ─── 教材（间接隔离：通过 subject.orgId）───
  async assertMaterialAccess(
    materialId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number }> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, subject: { select: { orgId: true } } },
    });
    if (!material) throw new NotFoundException('教材不存在');
    const orgId = material.subject?.orgId ?? null;
    return this.checkOrg({ id: material.id, orgId }, '教材', userOrgId, userRoles);
  }

  // ─── 通用：获取可见组织 ID 列表（供列表过滤使用）───
  async getVisibleOrgIds(userOrgId: number): Promise<number[]> {
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

  // ─── 学时记录（通过 student.orgId 间接隔离）───
  async assertLearningHourAccess(
    recordId: number,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number }> {
    const record = await this.prisma.learningHourRecord.findUnique({
      where: { id: recordId },
      select: { id: true, student: { select: { orgId: true } } },
    });
    if (!record) throw new NotFoundException('学时记录不存在');
    const orgId = record.student?.orgId ?? null;
    return this.checkOrg({ id: record.id, orgId }, '学时记录', userOrgId, userRoles);
  }

  // ─── 内部通用校验 ───
  private async checkOrg(
    entity: { id: number; orgId: number | null },
    label: string,
    userOrgId?: number | null,
    userRoles?: string[],
  ): Promise<{ id: number; orgId: number | null }> {
    const roles = userRoles ?? [];
    if (roles.includes('SUPER_ADMIN')) return entity;
    if (entity.orgId === null) return entity;
    const uOrgId = userOrgId ?? null;
    if (uOrgId === null) throw new NotFoundException(`${label}不存在`);
    const visibleOrgIds = await this.getVisibleOrgIds(uOrgId);
    if (!visibleOrgIds.includes(entity.orgId)) {
      throw new NotFoundException(`${label}不存在`);
    }
    return entity;
  }
}

