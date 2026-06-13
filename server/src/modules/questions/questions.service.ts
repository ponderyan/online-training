import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    subjectId?: number; chapterId?: number; type?: QuestionType;
    difficulty?: string; status?: string; keyword?: string;
    isPublic?: boolean; page?: number; pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuestionWhereInput = {};
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.chapterId) where.chapterId = params.chapterId;
    if (params.type) where.type = params.type;
    if (params.difficulty) where.difficulty = params.difficulty as any;
    if (params.status) where.status = params.status as any;
    if (params.keyword) where.content = { contains: params.keyword };
    if (params.isPublic !== undefined) where.isPublic = params.isPublic;

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { name: true, code: true } },
          chapter: { select: { name: true } },
          tags: { include: { tag: true } },
          _count: { select: { paperQuestions: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true, code: true } },
        chapter: { select: { name: true } },
        tags: { include: { tag: true } },
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
        subQuestions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!q) throw new NotFoundException(`Question ${id} not found`);
    return q;
  }

  async create(data: {
    subjectId: number; chapterId: number; type: QuestionType;
    content: string; difficulty: string; isPublic?: boolean; analysis?: string;
    options?: { label: string; content: string; isCorrect: boolean }[];
    blanks?: { answer: string }[];
    subQuestions?: { content: string; answer?: string; score?: number }[];
    tagIds?: number[];
  }) {
    const { options, blanks, subQuestions, tagIds, ...questionData } = data;

    return this.prisma.question.create({
      data: {
        ...questionData,
        difficulty: data.difficulty as any,
        options: options ? { create: options.map((o, i) => ({ ...o, sortOrder: i })) } : undefined,
        blanks: blanks ? { create: blanks.map((b, i) => ({ ...b, blankIndex: i, sortOrder: i })) } : undefined,
        subQuestions: subQuestions ? { create: subQuestions.map((s, i) => ({ ...s, sortOrder: i })) } : undefined,
        tags: tagIds ? { create: tagIds.map(tagId => ({ tagId })) } : undefined,
      },
      include: {
        options: true, blanks: true, subQuestions: true, tags: true,
      },
    });
  }

  async update(id: number, data: {
    content?: string; difficulty?: string; analysis?: string; status?: string;
    chapterId?: number;
  }) {
    await this.findOne(id);
    return this.prisma.question.update({ where: { id }, data: data as any });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.question.delete({ where: { id } });
  }

  async batchCreate(questions: any[]) {
    const results: { index: number; success: boolean; id?: number; error?: string }[] = [];

    for (let i = 0; i < questions.length; i++) {
      try {
        const q = questions[i];
        const created = await this.prisma.question.create({
          data: {
            subjectId: q.subjectId,
            chapterId: q.chapterId || undefined,
            type: q.type,
            content: q.content,
            difficulty: q.difficulty,
            source: q.source || 'BATCH_IMPORT',
            status: q.status || 'PUBLISHED',
            analysis: q.analysis || undefined,
            isPublic: q.isPublic || false,
            options: q.options ? { create: q.options.map((o: any, idx: number) => ({ ...o, sortOrder: idx })) } : undefined,
            blanks: q.blanks ? { create: q.blanks.map((b: any, idx: number) => ({ ...b, blankIndex: idx, sortOrder: idx })) } : undefined,
            subQuestions: q.subQuestions ? { create: q.subQuestions.map((s: any, idx: number) => ({ ...s, sortOrder: idx })) } : undefined,
          },
        });
        results.push({ index: i, success: true, id: created.id });
      } catch (e: any) {
        results.push({ index: i, success: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return { total: questions.length, successCount, failCount: questions.length - successCount, results };
  }
}
