import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; search?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const sourceWhere: any = { source: { not: null } };
    if (params.search) sourceWhere.source = { contains: params.search };

    // Total distinct sources (unpaginated)
    const allGroups = await this.prisma.knowledgeChunk.groupBy({
      by: ['source'],
      where: sourceWhere,
      _count: { id: true },
    });

    // Paginated result
    const groups = await this.prisma.knowledgeChunk.groupBy({
      by: ['source'],
      where: sourceWhere,
      _count: { id: true },
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = await Promise.all(
      groups.map(async (g) => {
        const firstChunk = await this.prisma.knowledgeChunk.findFirst({
          where: { source: g.source },
          include: { subject: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        });
        return {
          source: g.source,
          chunkCount: g._count.id,
          createdAt: g._min.createdAt,
          subjectId: firstChunk?.subjectId,
          subjectName: firstChunk?.subject?.name,
        };
      }),
    );

    return { items, total: allGroups.length, page, pageSize };
  }

  async deleteBySource(source: string) {
    const result = await this.prisma.knowledgeChunk.deleteMany({
      where: { source },
    });
    return { deleted: result.count };
  }
}
