import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class MaterialsService {
  private uploadDir = path.resolve('uploads');

  constructor(private prisma: PrismaService) {
    fs.mkdir(this.uploadDir, { recursive: true }).catch(() => {});
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    subjectId?: number;
    status?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: {
          subject: true,
          creator: { select: { id: true, displayName: true } },
          _count: { select: { chapters: true, questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        subject: true,
        creator: { select: { id: true, displayName: true } },
        chapters: { orderBy: { chapterIndex: 'asc' } },
        questions: {
          orderBy: [{ chapterId: 'asc' }, { id: 'asc' }],
          include: { chapter: { select: { id: true, title: true } } },
        },
      },
    });
    if (!material) throw new NotFoundException('教材不存在');
    return material;
  }

  async upload(file: Express.Multer.File, body: { subjectId: string; name?: string; batchNote?: string; createdBy: string }) {
    if (!file) throw new BadRequestException('请上传PDF文件');
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      throw new BadRequestException('仅支持PDF格式');
    }

    const savedName = `${crypto.randomUUID()}.pdf`;
    const filePath = path.join(this.uploadDir, savedName);
    await fs.writeFile(filePath, file.buffer);

    const material = await this.prisma.material.create({
      data: {
        name: body.name || file.originalname.replace(/\.pdf$/i, ''),
        fileName: file.originalname,
        fileSize: file.size,
        filePath: savedName,
        subjectId: parseInt(body.subjectId),
        batchNote: body.batchNote || null,
        status: 'UPLOADED',
        createdBy: parseInt(body.createdBy),
      },
    });

    return material;
  }

  async getStats(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('教材不存在');

    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.materialQuestion.count({ where: { materialId: id } }),
      this.prisma.materialQuestion.count({ where: { materialId: id, reviewStatus: 'PENDING' } }),
      this.prisma.materialQuestion.count({ where: { materialId: id, reviewStatus: 'APPROVED' } }),
      this.prisma.materialQuestion.count({ where: { materialId: id, reviewStatus: 'REJECTED' } }),
    ]);

    return { total, pending, approved, rejected };
  }

  // 审核操作
  async reviewQuestion(id: number, data: {
    reviewStatus: 'APPROVED' | 'REJECTED' | 'EDITED';
    reviewNote?: string;
    content?: string;
    options?: any;
    blanks?: any;
    answer?: string;
    explanation?: string;
    difficulty?: string;
    suggestedGroup?: string;
  }) {
    const question = await this.prisma.materialQuestion.findUnique({
      where: { id },
      include: { material: true },
    });
    if (!question) throw new NotFoundException('试题不存在');

    const updateData: any = { reviewStatus: data.reviewStatus };
    if (data.reviewNote) updateData.reviewNote = data.reviewNote;
    if (data.content) updateData.content = data.content;
    if (data.options) updateData.options = data.options;
    if (data.blanks) updateData.blanks = data.blanks;
    if (data.answer) updateData.answer = data.answer;
    if (data.explanation) updateData.explanation = data.explanation;
    if (data.difficulty) updateData.difficulty = data.difficulty;
    if (data.suggestedGroup) updateData.suggestedGroup = data.suggestedGroup;

    // 如果审核通过，同时导入到正式题库
    if (data.reviewStatus === 'APPROVED' || data.reviewStatus === 'EDITED') {
      const finalContent = data.content || question.content;
      const finalOptions = data.options || question.options;
      const finalBlanks = data.blanks || question.blanks;
      const finalAnswer = data.answer || question.answer;
      const finalExplanation = data.explanation || question.explanation;
      const finalDifficulty = data.difficulty || question.difficulty;

      // 导入到正式题库
      const imported = await this.importToQuestionBank(
        question.material.subjectId,
        question.type as any,
        finalContent,
        finalDifficulty as any,
        finalOptions,
        finalBlanks,
        finalAnswer,
        finalExplanation,
        question.knowledgePoint,
        question.sourceChunk,
      );

      updateData.questionId = imported.id;
    }

    return this.prisma.materialQuestion.update({
      where: { id },
      data: updateData,
      include: { chapter: { select: { id: true, title: true } } },
    });
  }

  async batchReview(materialId: number, data: {
    action: 'approve' | 'reject';
    questionIds?: number[]; // 不传则操作全部待审核
  }) {
    const where: any = { materialId, reviewStatus: 'PENDING' };
    if (data.questionIds?.length) where.id = { in: data.questionIds };

    const pendingQuestions = await this.prisma.materialQuestion.findMany({ where });

    if (data.action === 'reject') {
      await this.prisma.materialQuestion.updateMany({
        where,
        data: { reviewStatus: 'REJECTED' },
      });
      return { updated: pendingQuestions.length, action: 'rejected' };
    }

    // approve: 逐条导入题库
    let imported = 0;
    for (const q of pendingQuestions) {
      const result = await this.importToQuestionBank(
        (await this.prisma.material.findUnique({ where: { id: materialId }, select: { subjectId: true } }))!.subjectId,
        q.type as any,
        q.content,
        q.difficulty as any,
        q.options,
        q.blanks,
        q.answer,
        q.explanation,
        q.knowledgePoint,
        q.sourceChunk,
      );
      await this.prisma.materialQuestion.update({
        where: { id: q.id },
        data: { reviewStatus: 'APPROVED', questionId: result.id },
      });
      imported++;
    }

    return { updated: imported, action: 'approved' };
  }

  private async importToQuestionBank(
    subjectId: number,
    type: string,
    content: string,
    difficulty: string,
    options: any,
    blanks: any,
    answer: string | null,
    explanation: string | null,
    knowledgePoint: string | null,
    sourceChunk: string | null,
  ) {
    // 创建正式试题
    const question = await this.prisma.question.create({
      data: {
        subjectId,
        chapterId: 1, // 默认章节，后续可以从 sourceChunk 解析更精确的章节
        type: type as any,
        content,
        analysis: explanation || '',
        difficulty: difficulty as any,
        source: 'AI_IMPORT',
        status: 'PUBLISHED',
      },
    });

    // 处理选项（选择题）
    if (options && Array.isArray(options)) {
      await this.prisma.questionOption.createMany({
        data: options.map((opt: any, i: number) => ({
          questionId: question.id,
          label: opt.label || String.fromCharCode(65 + i),
          content: opt.content,
          isCorrect: opt.isCorrect || false,
          sortOrder: i,
        })),
      });
    }

    // 处理填空答案
    if (blanks && Array.isArray(blanks)) {
      await this.prisma.questionBlank.createMany({
        data: blanks.map((b: any, i: number) => ({
          questionId: question.id,
          blankIndex: b.position || i,
          answer: b.answer,
          sortOrder: i,
        })),
      });
    }

    return question;
  }

  async delete(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('教材不存在');

    // 删除物理文件
    try {
      await fs.unlink(path.join(this.uploadDir, material.filePath));
    } catch {}

    return this.prisma.material.delete({ where: { id } });
  }
}
