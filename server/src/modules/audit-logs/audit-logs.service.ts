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
}
