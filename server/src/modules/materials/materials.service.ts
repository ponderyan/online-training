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

  // ═══════════════════════════════════════════════
  // AI 出题：调用 DeepSeek 等大模型生成试题
  // ═══════════════════════════════════════════════

  async generateQuestions(id: number) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        chapters: { where: { content: { not: null } }, orderBy: { chapterIndex: 'asc' } },
        subject: true,
      },
    });
    if (!material) throw new NotFoundException('教材不存在');
    if (material.chapters.length === 0) throw new BadRequestException('教材暂无章节内容，请先录入或OCR识别后再出题');

    // 获取已启用的 AI 配置
    const config = await this.prisma.aiConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new BadRequestException('请先在系统设置中配置大模型并保存');

    // 更新状态为出题中
    await this.prisma.material.update({ where: { id }, data: { status: 'PROCESSING' } });
    for (const ch of material.chapters) {
      await this.prisma.materialChapter.update({ where: { id: ch.id }, data: { status: 'GENERATING' } });
    }

    // 删除旧生成的题目（重新生成）
    await this.prisma.materialQuestion.deleteMany({ where: { materialId: id } });

    const allQuestions: any[] = [];
    let totalTokens = 0;

    for (const chapter of material.chapters) {
      const content = chapter.content || '';
      if (content.trim().length < 20) continue;

      try {
        const result = await this.callAiForQuestions(
          config, material, chapter, content
        );
        if (result.questions?.length > 0) {
          for (const q of result.questions) {
            const saved = await this.prisma.materialQuestion.create({
              data: {
                materialId: material.id,
                chapterId: chapter.id,
                type: q.type || 'SINGLE_CHOICE',
                difficulty: q.difficulty || 'MEDIUM_EASY',
                knowledgePoint: q.knowledgePoint || null,
                sourceChunk: q.sourceChunk || null,
                content: q.content || '',
                options: q.options || undefined,
                blanks: q.blanks || undefined,
                answer: q.answer || null,
                explanation: q.explanation || null,
                suggestedGroup: q.suggestedGroup || 'EXAM_GROUP',
                reviewStatus: 'PENDING',
              },
            });
            allQuestions.push(saved);
          }
        }
        totalTokens += result.tokens || 0;

        await this.prisma.materialChapter.update({
          where: { id: chapter.id },
          data: { status: 'GENERATED', questionCount: (result.questions || []).length },
        });
      } catch (e: any) {
        await this.prisma.materialChapter.update({
          where: { id: chapter.id },
          data: { status: 'PENDING' },
        });
        console.error(`章节 ${chapter.title} 出题失败:`, e.message);
      }
    }

    const finalStatus = allQuestions.length > 0 ? 'GENERATED' : 'UPLOADED';
    await this.prisma.material.update({ where: { id }, data: { status: finalStatus } });

    return {
      total: allQuestions.length,
      chapters: material.chapters.length,
      tokens: totalTokens,
      status: finalStatus,
    };
  }

  // 调用大模型 API 生成试题
  private async callAiForQuestions(
    config: any, material: any, chapter: any, content: string
  ): Promise<{ questions: any[]; tokens: number }> {
    const url = config.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions';

    const systemPrompt = `你是一名资深学科命题专家。请根据提供的教材内容，生成符合中国考试标准的试题。

要求：
1. 严格基于教材内容出题，不要编造教材中没有的知识点
2. 题型包括：单选题(SINGLE_CHOICE)、多选题(MULTIPLE_CHOICE)、判断题(TRUE_FALSE)、填空题(FILL_BLANK)、简答题(SHORT_ANSWER)
3. 每题标注难度：EASY(易)、MEDIUM_EASY(较易)、MEDIUM_HARD(较难)、HARD(难)
4. 标注所属知识点
5. 单选题需提供4个选项(A/B/C/D)，多选题提供4-5个选项
6. 判断题答案填 true 或 false
7. 填空题需给出正确答案
8. 简答题需给出参考答案要点
9. 题目覆盖教材的重点和难点
10. 返回严格的 JSON 格式，不要包含任何其他文字`;

    const userPrompt = `教材名称：${material.name}
${material.batchNote ? '教材说明：' + material.batchNote + '\n' : ''}
章节：${chapter.title}

以下为章节内容：

${content.slice(0, 8000)}

请根据以上内容生成8-15道试题，尽量覆盖多种题型，分布合理。
返回格式（严格 JSON 数组，不要有任何其他文字）：
[
  {
    "type": "SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE|FILL_BLANK|SHORT_ANSWER",
    "difficulty": "EASY|MEDIUM_EASY|MEDIUM_HARD|HARD",
    "knowledgePoint": "知识点名称",
    "sourceChunk": "引用的原文片段(20-50字)",
    "content": "题目内容",
    "options": [ { "label": "A", "content": "选项内容", "isCorrect": false } ],
    "blanks": [ { "blankIndex": 0, "answer": "正确答案" } ],
    "answer": "参考答案（填空题逗号分隔多空，简答题写要点）",
    "explanation": "答案解析",
    "suggestedGroup": "EXAM_GROUP"
  }
]`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelVersion,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: Math.min(config.temperature || 0.7, 0.5), // 出题需要较低温度保证准确性
          max_tokens: config.maxTokens || 8192,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        let detail = '';
        try { const body: any = await response.json(); detail = body.error?.message || JSON.stringify(body); }
        catch { detail = await response.text().catch(() => ''); }
        throw new Error(`API 错误 (${response.status}): ${detail}`);
      }

      const body: any = await response.json();
      const reply = body.choices?.[0]?.message?.content || '';
      const usage = body.usage || {};
      const totalTokens = (usage.total_tokens || 0) + (usage.completion_tokens || 0);

      // 解析 JSON — 可能被 markdown 代码块包裹
      let jsonStr = reply.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      const questions = JSON.parse(jsonStr);
      if (!Array.isArray(questions)) throw new Error('AI 返回格式异常：非数组');

      // 验证和清洗
      const validQuestions = questions.filter((q: any) => q.content && q.type).map((q: any) => ({
        ...q,
        type: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'].includes(q.type) ? q.type : 'SINGLE_CHOICE',
        difficulty: ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'].includes(q.difficulty) ? q.difficulty : 'MEDIUM_EASY',
      }));

      return { questions: validQuestions, tokens: totalTokens };
    } catch (e: any) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        throw new Error('AI 请求超时，请检查模型配置或稍后重试');
      }
      throw e;
    }
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
