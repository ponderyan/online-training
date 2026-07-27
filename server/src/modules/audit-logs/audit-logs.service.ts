import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number; pageSize?: number;
    entityType?: string; action?: string;
    operatorId?: number; operatorName?: string; entityId?: number;
    startDate?: string; endDate?: string;
    sort?: string;
    includeArchived?: boolean;
    changeReason?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};

    if (params.entityType) where.entityType = params.entityType;
    if (params.action) where.action = params.action;
    if (params.operatorName) where.operatorName = { contains: params.operatorName };
    if (params.operatorId) where.operatorId = params.operatorId;
    if (params.entityId) where.entityId = params.entityId;
    if (params.changeReason) where.changeReason = { contains: params.changeReason };

    // 日期范围：显式传了 startDate/endDate 用之；否则默认只查近 365 天（includeArchived=true 才查全部）
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    } else if (!params.includeArchived) {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      where.createdAt = { gte: oneYearAgo };
    }

    const orderBy: any = params.sort === 'createdAt_asc'
      ? { createdAt: 'asc' as const }
      : { createdAt: 'desc' as const };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /** 导出用：复用筛选逻辑但不分页，返回全部匹配记录（上限 10000 条防止过大） */
  async findAllForExport(params: {
    entityType?: string; action?: string;
    operatorId?: number; operatorName?: string; entityId?: number;
    startDate?: string; endDate?: string;
    includeArchived?: boolean;
    changeReason?: string;
  }) {
    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.action) where.action = params.action;
    if (params.operatorName) where.operatorName = { contains: params.operatorName };
    if (params.operatorId) where.operatorId = params.operatorId;
    if (params.entityId) where.entityId = params.entityId;
    if (params.changeReason) where.changeReason = { contains: params.changeReason };
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    } else if (!params.includeArchived) {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      where.createdAt = { gte: oneYearAgo };
    }
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000 });
  }

  /** 获取归档配置（保留天数 + 是否自动清理 + 统计） */
  async getArchiveConfig() {
    const [retentionCfg, enabledCfg, stats] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: 'audit_retention_days' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'audit_auto_cleanup_enabled' } }),
      this.getStats(),
    ]);
    return {
      retentionDays: retentionCfg ? parseInt(retentionCfg.value, 10) || 730 : 730,
      autoCleanupEnabled: enabledCfg ? enabledCfg.value === 'true' : true,
      stats,
    };
  }

  /** 更新归档配置 */
  async updateArchiveConfig(data: { retentionDays?: number; autoCleanupEnabled?: boolean }) {
    if (data.retentionDays !== undefined) {
      const days = Math.max(30, Math.min(3650, data.retentionDays)); // 30~3650 天
      await this.prisma.systemConfig.upsert({
        where: { key: 'audit_retention_days' },
        update: { value: String(days) },
        create: { key: 'audit_retention_days', value: String(days), desc: '审计日志保留天数', group: 'general', inputType: 'number' },
      });
    }
    if (data.autoCleanupEnabled !== undefined) {
      await this.prisma.systemConfig.upsert({
        where: { key: 'audit_auto_cleanup_enabled' },
        update: { value: String(data.autoCleanupEnabled) },
        create: { key: 'audit_auto_cleanup_enabled', value: String(data.autoCleanupEnabled), desc: '是否启用审计日志自动清理', group: 'general', inputType: 'boolean' },
      });
    }
    return this.getArchiveConfig();
  }

  /**
   * ARCH-2: 审计日志归档清理
   * 删除 retentionDays 天前的审计日志（默认 730 天 = 2 年）
   * 仅 SUPER_ADMIN 可调用，由 controller 层做权限校验
   */
  async archive(retentionDays: number = 730): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: result.count };
  }

  /** 获取审计日志统计（总量/最早记录/近30天增量），供前端展示 */
  async getStats() {
    const [total, oldest, recent] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { total, oldestAt: oldest?.createdAt || null, last30Days: recent };
  }
}
