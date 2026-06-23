import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number; pageSize?: number;
    entityType?: string; action?: string;
    operatorId?: number; entityId?: number;
    startDate?: string; endDate?: string;
    sort?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};

    if (params.entityType) where.entityType = params.entityType;
    if (params.action) where.action = params.action;
    if (params.operatorId) where.operatorId = params.operatorId;
    if (params.entityId) where.entityId = params.entityId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
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
}
