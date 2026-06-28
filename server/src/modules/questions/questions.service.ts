import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    subjectId?: number; chapterId?: number; type?: QuestionType;
    difficulty?: string; status?: string; keyword?: string;
    isPublic?: boolean; page?: number; pageSize?: number;
    createdBy?: number;
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
    if (params.createdBy !== undefined) where.createdBy = params.createdBy;

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
    createdBy?: number;
  }) {
    const { options, blanks, subQuestions, tagIds, createdBy, ...questionData } = data;

    return this.prisma.question.create({
      data: {
        ...questionData,
        createdBy,
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

    // 引用保护：被试卷引用的试题不能删除
    const paperCount = await this.prisma.paperQuestion.count({ where: { questionId: id } });
    if (paperCount > 0) {
      throw new BadRequestException(
        `该试题已被 ${paperCount} 份试卷引用，无法删除。建议使用「停用」功能归档。`
      );
    }

    // 解除教材审核关联（如果有）
    await this.prisma.materialQuestion.updateMany({
      where: { questionId: id },
      data: { questionId: null },
    });

    return this.prisma.question.delete({ where: { id } });
  }

  async getReferencedPapers(questionId: number) {
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        paperQuestions: {
          include: {
            paper: {
              select: { id: true, name: true, paperNumber: true, status: true, totalScore: true },
            },
          },
        },
      },
    });
    if (!q) throw new NotFoundException(`Question ${questionId} not found`);
    return {
      count: q.paperQuestions.length,
      papers: q.paperQuestions.map(pq => ({
        paperId: pq.paper.id,
        name: pq.paper.name,
        paperNumber: pq.paper.paperNumber,
        status: pq.paper.status,
        score: pq.score,
        sortOrder: pq.sortOrder,
      })),
    };
  }

  async getPracticeQuestions(
    count: number = 10,
    subjectId?: number,
    types?: string[],
    chapterId?: number,
  ) {
    const where: any = {
      status: 'PUBLISHED',
      practiceVisible: true,
    };
    if (subjectId) where.subjectId = subjectId;
    if (types && types.length > 0) where.type = { in: types };
    if (chapterId) where.chapterId = chapterId;

    const items = await this.prisma.question.findMany({
      where,
      take: count,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { name: true } },
        chapter: { select: { name: true } },
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
      },
    });

    // 随机打乱
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
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
            createdBy: q.createdBy ?? undefined,
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

  async getPracticeAnswer(questionId?: number) {
    if (!questionId) throw new NotFoundException('题目ID不能为空');
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('题目不存在');

    const correctAnswer = this.formatCorrectAnswer(question);
    return { correctAnswer, analysis: question.analysis };
  }

  // ── 练习模式 ──

  async submitPractice(data: { studentId: number; questionId: number; answer: any }) {
    const question = await this.prisma.question.findUnique({
      where: { id: data.questionId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('题目不存在');

    const isCorrect = this.checkAnswer(question, data.answer);

    const record = await this.prisma.practiceRecord.upsert({
      where: {
        studentId_questionId: { studentId: data.studentId, questionId: data.questionId },
      },
      create: {
        studentId: data.studentId,
        questionId: data.questionId,
        answer: data.answer,
        isCorrect,
      },
      update: {
        answer: data.answer,
        isCorrect,
      },
    });

    const correctAnswer = this.formatCorrectAnswer(question);
    return { isCorrect, correctAnswer, analysis: question.analysis };
  }

  async getPracticeRecords(params: { studentId: number; onlyWrong?: boolean; subjectId?: number }) {
    const where: any = { studentId: params.studentId };
    if (params.onlyWrong) where.isCorrect = false;

    const records = await this.prisma.practiceRecord.findMany({
      where,
      include: {
        question: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            blanks: { orderBy: { blankIndex: 'asc' } },
            subject: { select: { name: true } },
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let filtered = records;
    if (params.subjectId) {
      filtered = records.filter(r => r.question.subjectId === params.subjectId);
    }

    return { total: filtered.length, items: filtered };
  }

  async getPracticeStats(studentId: number) {
    const total = await this.prisma.practiceRecord.count({ where: { studentId } });
    const correct = await this.prisma.practiceRecord.count({ where: { studentId, isCorrect: true } });
    const wrong = await this.prisma.practiceRecord.count({ where: { studentId, isCorrect: false } });

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT q.subject_id, ANY_VALUE(s.name) as subject_name,
        COUNT(*) as total,
        SUM(CASE WHEN pr.is_correct THEN 1 ELSE 0 END) as correct
      FROM practice_records pr
      JOIN questions q ON q.id = pr.question_id
      JOIN subjects s ON s.id = q.subject_id
      WHERE pr.student_id = ?
      GROUP BY q.subject_id
    `, studentId);

    const bySubject = rows.map((r: any) => ({
      subject_id: Number(r.subject_id),
      subject_name: r.subject_name,
      total: Number(r.total),
      correct: Number(r.correct),
    }));

    return {
      total,
      correct,
      wrong,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      bySubject,
    };
  }

  async toggleFavorite(studentId: number, questionId: number) {
    const existing = await this.prisma.questionFavorite.findUnique({
      where: { studentId_questionId: { studentId, questionId } },
    });
    if (existing) {
      await this.prisma.questionFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.questionFavorite.create({ data: { studentId, questionId } });
    return { favorited: true };
  }

  async getFavoriteQuestions(params: { studentId: number; subjectId?: number }) {
    const where: any = { studentId: params.studentId };
    const records = await this.prisma.questionFavorite.findMany({
      where,
      include: {
        question: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            blanks: { orderBy: { blankIndex: 'asc' } },
            subject: { select: { name: true } },
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    let items = records.map(r => r.question);
    if (params.subjectId) items = items.filter(q => q.subjectId === params.subjectId);
    return { total: items.length, items };
  }

  async getFavoriteIds(studentId: number) {
    const records = await this.prisma.questionFavorite.findMany({
      where: { studentId },
      select: { questionId: true },
    });
    return records.map(r => r.questionId);
  }

  private checkAnswer(question: any, studentAnswer: any): boolean {
    switch (question.type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE': {
        const correct = question.options?.find((o: any) => o.isCorrect);
        return studentAnswer === correct?.label;
      }
      case 'MULTIPLE_CHOICE': {
        const correctLabels = new Set(
          question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label)
        );
        const studentLabels = new Set(Array.isArray(studentAnswer) ? studentAnswer : []);
        if (correctLabels.size !== studentLabels.size) return false;
        for (const l of correctLabels) if (!studentLabels.has(l)) return false;
        return true;
      }
      case 'FILL_BLANK': {
        const blanks = question.blanks || [];
        const studentBlanks = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        if (blanks.length !== studentBlanks.length) return false;
        return blanks.every((b: any, i: number) =>
          String(studentBlanks[i] || '').trim().toLowerCase() === String(b.answer || '').trim().toLowerCase()
        );
      }
      case 'SHORT_ANSWER':
      case 'CASE_STUDY':
        return false;
      default:
        return false;
    }
  }

  private formatCorrectAnswer(question: any): string {
    switch (question.type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE':
        return question.options?.find((o: any) => o.isCorrect)?.label || '—';
      case 'MULTIPLE_CHOICE':
        return question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join(', ') || '—';
      case 'FILL_BLANK':
        return question.blanks?.map((b: any) => b.answer).join(' | ') || '—';
      case 'SHORT_ANSWER':
      case 'CASE_STUDY':
        return (question as any).analysis || '参考答案见解析';
      default:
        return '—';
    }
  }
}
