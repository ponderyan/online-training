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

  async create(data: any) {
    // 兼容 types / typeConfigs 两种字段名
    if (data.types && !data.typeConfigs) data.typeConfigs = data.types;
    const { typeConfigs, types, ...templateData } = data;
    return this.prisma.paperTemplate.create({
      data: {
        ...templateData,
        name: templateData.name,
        subjectId: templateData.subjectId,
        totalScore: templateData.totalScore,
        createdBy: templateData.createdBy,
        durationMinutes: templateData.durationMinutes ?? 90,
        isOpenBook: templateData.isOpenBook ?? false,
        chapterStrategy: (templateData.chapterStrategy as ChapterStrategy) || 'EVEN',
        difficultyDistribution: templateData.difficultyDistribution ?? {},
        sourceMix: templateData.sourceMix ?? 80,
        typeConfigs: typeConfigs ? { create: (typeConfigs as any[]).map((tc: any, i: number) => ({ ...tc, sortOrder: i, questionType: tc.questionType as any })) } : undefined,
      },
      include: { typeConfigs: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(id: number, data: any) {
    // 兼容 types / typeConfigs 两种字段名
    if (data.types && !data.typeConfigs) data.typeConfigs = data.types;
    const { typeConfigs, types, ...templateData } = data;
    if (typeConfigs) {
      await this.prisma.paperTemplateType.deleteMany({ where: { templateId: id } });
    }
    const updateData: any = { ...templateData };
    if (updateData.difficultyDistribution === undefined) delete updateData.difficultyDistribution;
    if (typeConfigs) {
      updateData.typeConfigs = {
        create: (typeConfigs as any[]).map((tc: any, i: number) => ({
          ...tc, sortOrder: i, questionType: tc.questionType as any,
        })),
      };
    }
    return this.prisma.paperTemplate.update({
      where: { id },
      data: updateData,
      include: { typeConfigs: { orderBy: { sortOrder: 'asc' } }, subject: { select: { name: true, code: true } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.paperTemplate.delete({ where: { id } });
  }
}
