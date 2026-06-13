import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChapterStrategy } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(subjectId?: number) {
    const where = subjectId ? { subjectId } : {};
    return this.prisma.paperTemplate.findMany({
      where,
      include: {
        typeConfigs: { orderBy: { sortOrder: 'asc' } },
        subject: { select: { name: true, code: true } },
        creator: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const t = await this.prisma.paperTemplate.findUnique({
      where: { id },
      include: {
        typeConfigs: { orderBy: { sortOrder: 'asc' } },
        subject: { select: { name: true, code: true } },
        creator: { select: { displayName: true } },
      },
    });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  async create(data: {
    name: string; subjectId: number; totalScore: number; createdBy: number;
    durationMinutes?: number; isOpenBook?: boolean;
    difficultyDistribution: any; chapterStrategy?: string; sourceMix?: number;
    typeConfigs: { questionType: string; count: number; scorePerQuestion: number }[];
  }) {
    const { typeConfigs, ...templateData } = data;
    return this.prisma.paperTemplate.create({
      data: {
        ...templateData,
        chapterStrategy: templateData.chapterStrategy as ChapterStrategy,
        difficultyDistribution: templateData.difficultyDistribution,
        typeConfigs: { create: typeConfigs.map((tc, i) => ({ ...tc, sortOrder: i, questionType: tc.questionType as any })) },
      },
      include: { typeConfigs: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.paperTemplate.delete({ where: { id } });
  }
}
