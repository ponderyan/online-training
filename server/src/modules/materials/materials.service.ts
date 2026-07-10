import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import { execFile } from 'child_process';
import * as util from 'util';
import * as mammoth from 'mammoth';
const execFileAsync = util.promisify(execFile);

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
    includeArchived?: boolean;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.status) where.status = params.status;
    // 默认排除已归档（除非显式要求包含）
    if (!params.includeArchived) where.archivedAt = null;

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

  /**
   * 将文本按章节标题分割成章节数组
   */
  private parseTextToChapters(text: string): Array<{ title: string; content: string }> {
    const lines = text.split('\n').filter(l => l.trim());
    const sectionPattern = /^(第[一二三四五六七八九十百千]+章|第\d+章|\d+\.\d+(?!\.\d)\s+|#+\s*|Chapter\s+\d+|Part\s+\d+|[一二三四五六七八九十]+、)/i;
    const chapters: Array<{ title: string; content: string }> = [];
    let currentTitle = '全文';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (sectionPattern.test(line.trim())) {
        if (currentContent.length > 0) {
          chapters.push({ title: currentTitle, content: currentContent.join('\n') });
        }
        currentTitle = line.trim().replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentContent.length > 0 || chapters.length === 0) {
      chapters.push({ title: currentTitle, content: currentContent.join('\n') });
    }
    return chapters;
  }

  /**
   * 保存章节到数据库
   */
  private async saveChapters(materialId: number, chapters: Array<{ title: string; content: string }>) {
    for (let i = 0; i < chapters.length; i++) {
      await this.prisma.materialChapter.create({
        data: {
          materialId,
          title: chapters[i].title,
          chapterIndex: i,
          content: chapters[i].content,
          contentLength: Buffer.byteLength(chapters[i].content, 'utf-8'),
          status: 'GENERATED',
          sortOrder: i,
        },
      });
    }
    return chapters.length;
  }

  /**
   * 从 PDF 文件提取文字
   */
  private async extractPdfText(filePath: string): Promise<{ text: string; numPages: number }> {
    const pdfBuffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const result = await parser.getText();
      return { text: result.text, numPages: result.total };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  /**
   * 直接通过文本创建教材（无需上传文件）
   */
  async create(data: {
    name: string;
    subjectId: number;
    createdBy: number;
    batchNote?: string;
    content?: string;
  }) {
    const material = await this.prisma.material.create({
      data: {
        name: data.name,
        fileName: data.name + '.txt',
        fileSize: data.content ? Buffer.byteLength(data.content, 'utf-8') : 0,
        filePath: '',
        subjectId: data.subjectId,
        batchNote: data.batchNote || null,
        status: data.content ? 'OCR_DONE' : 'UPLOADED',
        createdBy: data.createdBy,
      },
    });

    // 如果有内容，自动创建章节
    if (data.content) {
      const chapters = this.parseTextToChapters(data.content);
      const chapterCount = await this.saveChapters(material.id, chapters);

      // 更新章节数
      await this.prisma.material.update({
        where: { id: material.id },
        data: {
          totalPages: chapterCount,
        },
      });
    }

    return this.findOne(material.id);
  }

  async upload(file: Express.Multer.File, body: { subjectId: string; name?: string; batchNote?: string; createdBy: string }) {
    if (!file) throw new BadRequestException('请上传PDF、PPTX或Word文件');

    // 修复文件名编码：浏览器上传的中文文件名可能被 multer 以 Latin-1 解码
    const fixEncoding = (s: string) => {
      try {
        const buf = Buffer.from(s, 'latin1');
        const utf = buf.toString('utf8');
        if (/[一-鿿]/.test(utf)) return utf;
      } catch {}
      return s;
    };

    // ── 魔数检测：从内存 buffer 判断真实文件类型 ──
    const headerHex = file.buffer.slice(0, 4).toString('hex');
    let detectedExt: string;
    let detectedType: string;
    if (headerHex === '25504446') {
      detectedExt = '.pdf'; detectedType = 'pdf';
    } else if (headerHex === '504b0304') {
      // ZIP容器，需区分 PPTX / DOCX
      const detected = detectOfficeType(file.buffer, file.originalname);
      detectedExt = detected.ext;
      detectedType = detected.type;
    } else if (headerHex.startsWith('d0cf11e0')) {
      detectedExt = '.doc'; detectedType = 'doc';
    } else {
      detectedExt = '.pdf'; detectedType = 'unknown';
    }

    const savedName = `${crypto.randomUUID()}${detectedExt}`;
    const filePath = path.join(this.uploadDir, savedName);
    await fs.writeFile(filePath, file.buffer);

    const material = await this.prisma.material.create({
      data: {
        name: body.name || fixEncoding(file.originalname).replace(/\.(pdf|pptx|docx|doc)$/i, ''),
        fileName: fixEncoding(file.originalname),
        fileSize: file.size,
        filePath: savedName,
        fileType: detectedType,
        subjectId: parseInt(body.subjectId),
        batchNote: body.batchNote || null,
        status: 'UPLOADED',
        createdBy: parseInt(body.createdBy),
      },
    });

    // ── 根据格式路由到不同提取管线 ──
    if (detectedType === 'pptx') {
      await this.processPptx(material.id, filePath);
    } else if (detectedType === 'pdf') {
      await this.processPdf(material.id, filePath, file.originalname);
    } else if (detectedType === 'docx') {
      await this.processDocx(material.id, filePath);
    } else if (detectedType === 'doc') {
      await this.processDoc(material.id, filePath);
    } else {
      await this.prisma.material.update({
        where: { id: material.id },
        data: { errorMessage: '未能识别文件格式，请上传 PDF、PPTX 或 DOCX 文件' },
      });
    }

    return this.findOne(material.id);
  }

  /**
   * 处理 PDF 教材：pdf-parse 提取，不足时走 OCR 兜底
   */
  private async processPdf(materialId: number, filePath: string, originalName: string) {
    try {
      const { text, numPages } = await this.extractPdfText(filePath);
      if (text.trim().length < 10) {
        console.warn(`PDF text extraction too little for ${originalName}, trying OCR...`);
        // 走 OCR 兜底
        try {
          const ocrText = await this.ocrPdfFallback(filePath);
          if (ocrText.length > 20) {
            const chapters = this.parseTextToChapters(ocrText);
            await this.saveChapters(materialId, chapters);
            await this.prisma.material.update({
              where: { id: materialId },
              data: { status: 'OCR_DONE', totalPages: numPages || 1, errorMessage: null },
            });
            return;
          }
        } catch {}
        // OCR 也失败，保持 UPLOADED + 提示
        await this.prisma.material.update({
          where: { id: materialId },
          data: { totalPages: numPages || 1, errorMessage: '未能提取到有效文字，PDF 可能为扫描件，建议手动录入正文' },
        });
      } else {
        const chapters = this.parseTextToChapters(text);
        await this.saveChapters(materialId, chapters);
        await this.prisma.material.update({
          where: { id: materialId },
          data: {
            status: 'OCR_DONE',
            totalPages: numPages || Math.ceil(text.length / 2000) || 1,
            errorMessage: null,
          },
        });
      }
    } catch (e: any) {
      console.error('PDF text extraction failed:', e.message);
      await this.prisma.material.update({
        where: { id: materialId },
        data: { errorMessage: 'PDF 文字提取失败：' + e.message },
      }).catch(() => {});
    }
  }

  /**
   * 处理 PPTX 教材：调用 Python 脚本提取幻灯片文字
   */
  private async processPptx(materialId: number, filePath: string) {
    try {
      const { text, totalSlides } = await this.extractPptxText(filePath);
      if (text.trim().length < 10) {
        await this.prisma.material.update({
          where: { id: materialId },
          data: { totalPages: totalSlides, errorMessage: 'PPTX 中未找到文字内容，PPT 可能为纯图片' },
        });
      } else {
        const chapters = this.parseTextToChapters(text);
        await this.saveChapters(materialId, chapters);
        await this.prisma.material.update({
          where: { id: materialId },
          data: { status: 'OCR_DONE', totalPages: totalSlides, errorMessage: null },
        });
      }
    } catch (e: any) {
      console.error('PPTX extraction failed:', e.message);
      await this.prisma.material.update({
        where: { id: materialId },
        data: { errorMessage: 'PPTX 文字提取失败：' + e.message },
      }).catch(() => {});
    }
  }

  /**
   * 检测文件魔数以确定真实格式（从磁盘文件读取）
   */
  private async detectFileTypeFromPath(filePath: string): Promise<'pdf' | 'pptx' | 'unknown'> {
    const fd = await fs.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(4);
      await fd.read(buf, 0, 4, 0);
      const hex = buf.toString('hex');
      if (hex === '25504446') return 'pdf';
      if (hex === '504b0304') return 'pptx';
      return 'unknown';
    } finally {
      await fd.close();
    }
  }

  /**
   * 通过 Python 脚本提取 PPTX 幻灯片文字
   */
  private async extractPptxText(filePath: string): Promise<{ text: string; totalSlides: number }> {
    const scriptPath = path.resolve('scripts/extract-pptx-text.py');
    try {
      const { stdout } = await execFileAsync('python3', [scriptPath, filePath], {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const result = JSON.parse(stdout);
      if (result.error) throw new Error(result.error);
      const text = result.slides.map((s: any) => s.text).filter(Boolean).join('\n\n');
      return { text, totalSlides: result.total };
    } catch (e: any) {
      throw new Error(`PPTX 文字提取失败: ${e.message}`);
    }
  }

  /**
   * OCR 兜底 — 调用 Python ocr-pdf.py 脚本
   */
  private async ocrPdfFallback(filePath: string): Promise<string> {
    const scriptPath = path.resolve('scripts/ocr-pdf.py');
    const outPath = filePath + '_ocr.txt';
    try {
      await execFileAsync('python3', [scriptPath, filePath, outPath], {
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const text = await fs.readFile(outPath, 'utf-8');
      await fs.unlink(outPath).catch(() => {});
      return text.trim();
    } catch (e: any) {
      throw new Error(`OCR 识别失败: ${e.message}`);
    }
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

    // 解析 batchNote 中各题型总量，按章节内容长度比例分配
    const typeCounts = this.parseQuestionCounts(material.batchNote || '');
    const hasTypeCounts = Object.keys(typeCounts).length > 0;
    const chapterCounts = new Map<number, Record<string, number>>();
    if (hasTypeCounts) {
      const totalQCount = Object.values(typeCounts).reduce((a, b) => a + b, 0);
      const validChapters = material.chapters.filter(ch => (ch.content || '').trim().length >= 20);
      const totalLength = validChapters.reduce((sum, ch) => sum + (ch.content || '').length, 0);
      const typeNames = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
      for (const ch of validChapters) {
        const ratio = (ch.content || '').length / totalLength;
        let chTotal = Math.round(totalQCount * ratio);
        if (chTotal === 0 && (ch.content || '').length >= 200) chTotal = 1;
        if (chTotal === 0) continue;
        const perCh: Record<string, number> = {};
        let remaining = chTotal;
        for (let i = 0; i < typeNames.length; i++) {
          const [type, total] = typeNames[i];
          if (i === typeNames.length - 1) {
            perCh[type] = remaining;
          } else {
            const count = Math.min(remaining, Math.round(total * ratio));
            perCh[type] = count;
            remaining -= count;
          }
        }
        if (Object.values(perCh).reduce((a, b) => a + b, 0) > 0) {
          chapterCounts.set(ch.id, perCh);
        }
      }
    }

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
          config, material, chapter, content, chapterCounts.get(chapter.id)
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

    if (allQuestions.length > 0) {
      await this.prisma.material.update({ where: { id }, data: { status: 'GENERATED' } });
    }

    return {
      total: allQuestions.length,
      chapters: material.chapters.length,
      tokens: totalTokens,
      status: allQuestions.length > 0 ? 'GENERATED' : 'FAILED',
    };
  }

  // 调用大模型 API 生成试题
  private async callAiForQuestions(
    config: any, material: any, chapter: any, content: string,
    chapterCounts?: Record<string, number>
  ): Promise<{ questions: any[]; tokens: number }> {
    const url = config.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions';

    const systemPrompt = `你是一名资深学科命题专家。请根据提供的教材内容，生成符合中国考试标准的试题。

要求：
1. 严格基于教材内容出题，不要编造教材中没有的知识点
2. 题型包括：单选题(SINGLE_CHOICE)、多选题(MULTIPLE_CHOICE)、判断题(TRUE_FALSE)、填空题(FILL_BLANK)、简答题(SHORT_ANSWER)
3. 每题标注难度：EASY(易)、MEDIUM_EASY(较易)、MEDIUM_HARD(较难)、HARD(难)
4. 标注所属知识点(knowledgePoint)
5. 单选题需提供4个选项(A/B/C/D)，多选题提供4-5个选项
6. 判断题答案填 true 或 false
7. 填空题需给出正确答案
8. 简答题需给出参考答案要点
9. 题目覆盖教材的重点和难点
10. 返回严格的 JSON 格式，不要包含任何其他文字
11. 每道题必须包含以下所有字段（不可省略任一）：
    - type - difficulty - knowledgePoint - sourceChunk(20-50字原文引用)
    - content - options(选择题必填) - blanks(填空题必填)
    - answer - explanation(答案解析，必须包含)
    - suggestedGroup(默认"EXAM_GROUP")`;

    // 如果有按比例分配的章节题量，优先使用；否则回退到 batchNote 整份说明
    let countNote = '';
    if (chapterCounts) {
      countNote = `本小节需严格按照以下题型和数量出题：\n${this.formatChapterCounts(chapterCounts)}。`;
    } else if (material.batchNote) {
      countNote = `教材说明：${material.batchNote}`;
    }

    const userPrompt = `教材名称：${material.name}
${countNote}
章节：${chapter.title}

以下为章节内容：

${content.slice(0, 20000)}

${
  chapterCounts
    ? '请根据以上内容严格按照本小节要求的题型和数量生成试题，总量不要超过要求。'
    : '请根据以上内容和教材说明中的题型数量要求生成试题，题型分布要符合教材说明的要求，总量可适当超出说明以覆盖考点。'
}
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
        signal: AbortSignal.timeout(300000), // 5分钟，55道题生成需要时间
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

      const questions = parseAIJsonResponse(reply);

      // 验证和清洗
      const validQuestions = questions
        .filter((q: any) => q.content && q.type)
        .map((q: any) => {
          const { question, warnings } = validateAndFixQuestion(q);
          if (warnings.length > 0) {
            console.warn(`[AI出题质量] 章节 "${chapter.title}" 题目: ${warnings.join('; ')}`);
          }
          return {
            ...question,
            type: question.type,
            difficulty: question.difficulty,
          };
        });

      return { questions: validQuestions, tokens: totalTokens };
    } catch (e: any) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        throw new Error('AI 请求超时，请检查模型配置或稍后重试');
      }
      throw e;
    }
  }

  /**
   * 归档教材 — 软删除，不影响已入库试题
   */
  async archive(id: number) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { questions: { where: { questionId: { not: null } }, select: { questionId: true } } },
    });
    if (!material) throw new NotFoundException('教材不存在');
    if (material.archivedAt) throw new BadRequestException('教材已归档');

    // 标记已入库试题的来源快照
    const questionIds = material.questions.map(q => q.questionId).filter(Boolean) as number[];
    if (questionIds.length > 0) {
      const note = `来源教材：${material.name}（该教材已归档）`;
      await this.prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: { sourceNote: note },
      });
    }

    // 清理知识块
    await this.prisma.knowledgeChunk.deleteMany({
      where: { source: { contains: material.fileName } },
    }).catch(() => {});

    await this.prisma.material.update({ where: { id }, data: { archivedAt: new Date() } });
    return this.findOne(id);
  }

  /**
   * 取消归档
   */
  async unarchive(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('教材不存在');
    if (!material.archivedAt) throw new BadRequestException('教材未归档');

    await this.prisma.material.update({ where: { id }, data: { archivedAt: null } });
    return this.findOne(id);
  }

  async delete(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('教材不存在');

    // 删除物理文件
    try {
      await fs.unlink(path.join(this.uploadDir, material.filePath));
    } catch {}

    // 清除相关知识块
    await this.prisma.knowledgeChunk.deleteMany({
      where: { source: { contains: material.fileName } },
    }).catch(() => {});

    return this.prisma.material.delete({ where: { id } });
  }

  // 解析 batchNote 中各题型总量（如"单选题10道、判断题5道、简答题2道"）
  private parseQuestionCounts(batchNote: string): Record<string, number> {
    const mapping: Record<string, string> = {
      '单选题': 'SINGLE_CHOICE',
      '多选题': 'MULTIPLE_CHOICE',
      '判断题': 'TRUE_FALSE',
      '填空题': 'FILL_BLANK',
      '简答题': 'SHORT_ANSWER',
    };
    const counts: Record<string, number> = {};
    for (const [cn, en] of Object.entries(mapping)) {
      const match = batchNote.match(new RegExp(`${cn}(\\d+)道`));
      if (match) counts[en] = parseInt(match[1], 10);
    }
    return counts;
  }

  // 格式化章节题目数量，如"单选题2道、判断题1道、简答题1道"
  private formatChapterCounts(counts: Record<string, number>): string {
    const labelMap: Record<string, string> = {
      'SINGLE_CHOICE': '单选题',
      'MULTIPLE_CHOICE': '多选题',
      'TRUE_FALSE': '判断题',
      'FILL_BLANK': '填空题',
      'SHORT_ANSWER': '简答题',
    };
    const parts: string[] = [];
    for (const [type, count] of Object.entries(counts)) {
      if (count > 0) {
        parts.push(`${labelMap[type] || type}${count}道`);
      }
    }
    return parts.join('、');
  }

  // ═══════════════════════════════════════════════
  // 章节编辑 API
  // ═══════════════════════════════════════════════

  /**
   * 编辑章节标题
   */
  async updateChapter(materialId: number, chapterId: number, data: { title: string }) {
    const chapter = await this.prisma.materialChapter.findFirst({
      where: { id: chapterId, materialId },
    });
    if (!chapter) throw new NotFoundException('章节不存在');
    if (chapter.status === 'STRUCTURED') throw new BadRequestException('章节已确认结构化，不可编辑');
    if (!data.title?.trim()) throw new BadRequestException('标题不能为空');

    return this.prisma.materialChapter.update({
      where: { id: chapterId },
      data: { title: data.title.trim() },
    });
  }

  /**
   * 合并相邻章节
   */
  async mergeChapters(materialId: number, data: { chapterIds: number[] }) {
    if (!data.chapterIds || data.chapterIds.length < 2) throw new BadRequestException('请至少选择2个章节合并');

    const chapters = await this.prisma.materialChapter.findMany({
      where: { id: { in: data.chapterIds }, materialId },
      orderBy: { sortOrder: 'asc' },
    });

    if (chapters.length !== data.chapterIds.length) throw new NotFoundException('部分章节不存在');
    if (chapters.some(c => c.status === 'STRUCTURED')) throw new BadRequestException('章节已确认结构化，不可编辑');

    // 验证连续性
    for (let i = 1; i < chapters.length; i++) {
      if (chapters[i].sortOrder !== chapters[i - 1].sortOrder + 1) {
        throw new BadRequestException('只能合并相邻章节（sortOrder 连续）');
      }
    }

    const first = chapters[0];
    const mergedContent = chapters.map(c => c.content || '').join('\n\n');

    // 更新第一个章节，删除其余
    await this.prisma.materialChapter.update({
      where: { id: first.id },
      data: { content: mergedContent, contentLength: Buffer.byteLength(mergedContent, 'utf-8') },
    });
    await this.prisma.materialChapter.deleteMany({
      where: { id: { in: chapters.slice(1).map(c => c.id) } },
    });

    // 重新整理 sortOrder
    const remaining = await this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.materialChapter.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i, chapterIndex: i + 1 },
      });
    }

    return this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 分割章节
   */
  async splitChapter(materialId: number, data: { chapterId: number; splitPosition: number }) {
    const chapter = await this.prisma.materialChapter.findFirst({
      where: { id: data.chapterId, materialId },
    });
    if (!chapter) throw new NotFoundException('章节不存在');
    if (chapter.status === 'STRUCTURED') throw new BadRequestException('章节已确认结构化，不可编辑');
    if (!chapter.content || chapter.content.length <= data.splitPosition) {
      throw new BadRequestException('分割位置超出内容长度');
    }

    const before = chapter.content.slice(0, data.splitPosition);
    const after = chapter.content.slice(data.splitPosition);

    // 更新原章节为前半段
    await this.prisma.materialChapter.update({
      where: { id: chapter.id },
      data: {
        content: before,
        contentLength: Buffer.byteLength(before, 'utf-8'),
      },
    });

    // 创建新章节（后半段）
    const maxSortOrder = await this.prisma.materialChapter.aggregate({
      where: { materialId },
      _max: { sortOrder: true },
    });
    const newSortOrder = (maxSortOrder._max.sortOrder || 0) + 1;

    await this.prisma.materialChapter.create({
      data: {
        materialId,
        title: chapter.title + '(续)',
        chapterIndex: newSortOrder + 1,
        content: after,
        contentLength: Buffer.byteLength(after, 'utf-8'),
        sortOrder: newSortOrder,
      },
    });

    // 重新整理 sortOrder
    const remaining = await this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.materialChapter.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i, chapterIndex: i + 1 },
      });
    }

    return this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 删除章节
   */
  async deleteChapter(materialId: number, chapterId: number) {
    const chapter = await this.prisma.materialChapter.findFirst({
      where: { id: chapterId, materialId },
    });
    if (!chapter) throw new NotFoundException('章节不存在');
    if (chapter.status === 'STRUCTURED') throw new BadRequestException('章节已确认结构化，不可删除');

    await this.prisma.materialChapter.delete({ where: { id: chapterId } });

    // 重新整理 sortOrder
    const remaining = await this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.materialChapter.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i, chapterIndex: i + 1 },
      });
    }

    return this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 确认章节结构
   */
  async confirmStructure(materialId: number) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('教材不存在');

    const chapters = await this.prisma.materialChapter.findMany({
      where: { materialId },
    });
    if (chapters.length === 0) throw new BadRequestException('暂无章节，请先上传教材或录入正文');

    // 将所有章节标记为 STRUCTURED
    await this.prisma.materialChapter.updateMany({
      where: { materialId },
      data: { status: 'STRUCTURED' },
    });

    // 更新教材状态
    await this.prisma.material.update({
      where: { id: materialId },
      data: { status: 'STRUCTURED' },
    });

    return this.findOne(materialId);
  }

  /**
   * 获取教材精简列表（供筛选下拉框用）
   */
  async listForFilter() {
    const items = await this.prisma.material.findMany({
      where: { status: { notIn: ['UPLOADED', 'FAILED'] } },
      select: { id: true, name: true, subject: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(m => ({ id: m.id, name: `${m.subject?.code || ''} - ${m.name}` }));
  }

  /**
   * 获取章节正文内容
   */
  async getChapterContent(materialId: number, chapterId: number) {
    const chapter = await this.prisma.materialChapter.findFirst({
      where: { id: chapterId, materialId },
      select: { id: true, title: true, content: true, contentLength: true, status: true },
    });
    if (!chapter) throw new NotFoundException('章节不存在');
    return chapter;
  }

  // ═══════════════════════════════════════════════
  // 出题计划 API（Part B）
  // ═══════════════════════════════════════════════

  /**
   * 获取教材的所有出题计划
   */
  async getQuestionPlans(materialId: number) {
    return this.prisma.materialQuestionPlan.findMany({
      where: { materialId },
      include: {
        configs: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 创建新的出题计划
   */
  async createQuestionPlan(materialId: number, data: {
    name?: string;
    configs: { chapterId: number; type: string; count: number; difficultyEasy?: number; difficultyMedium?: number; difficultyHard?: number; focusKeywords?: string }[];
  }) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('教材不存在');
    if (!data.configs?.length) throw new BadRequestException('请至少添加一个出题配置');

    const planName = data.name || `出题计划 ${new Date().toLocaleDateString('zh-CN')} #${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const plan = await this.prisma.materialQuestionPlan.create({
      data: {
        materialId,
        name: planName,
        status: 'DRAFT',
        configs: {
          create: data.configs.map((c, i) => ({
            chapterId: c.chapterId,
            type: c.type,
            count: c.count,
            difficultyEasy: c.difficultyEasy ?? 30,
            difficultyMedium: c.difficultyMedium ?? 50,
            difficultyHard: c.difficultyHard ?? 20,
            focusKeywords: c.focusKeywords || null,
            sortOrder: i,
          })),
        },
      },
      include: { configs: { orderBy: { sortOrder: 'asc' } } },
    });

    return plan;
  }

  /**
   * 执行出题计划（并发出题）
   */
  async executeQuestionPlan(materialId: number, planId: number) {
    const plan = await this.prisma.materialQuestionPlan.findFirst({
      where: { id: planId, materialId },
      include: {
        configs: {
          include: { chapter: { select: { id: true, title: true, content: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('出题计划不存在');
    if (plan.status !== 'DRAFT') throw new BadRequestException('计划只能从 DRAFT 状态执行');

    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: { subject: true },
    });
    if (!material) throw new NotFoundException('教材不存在');

    const config = await this.prisma.aiConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new BadRequestException('请先在系统设置中配置大模型');

    // 更新状态
    await this.prisma.materialQuestionPlan.update({
      where: { id: planId },
      data: { status: 'EXECUTING' },
    });
    await this.prisma.material.update({
      where: { id: materialId },
      data: { status: 'PROCESSING' },
    });

    // 删除旧生成的试题
    await this.prisma.materialQuestion.deleteMany({ where: { materialId } });

    // 过滤有内容且 count > 0 的配置
    const validConfigs = plan.configs.filter(c => c.count > 0 && c.chapter?.content && c.chapter.content.trim().length >= 20);

    let totalGenerated = 0;
    let totalFailed = 0;

    // 分批并发（每批5个）
    const BATCH_SIZE = 5;
    for (let i = 0; i < validConfigs.length; i += BATCH_SIZE) {
      const batch = validConfigs.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(cfg =>
          this.callAiForPlanConfig(material, config, cfg)
            .then(async (questions) => {
              if (questions.length > 0) {
                for (const q of questions) {
                  await this.prisma.materialQuestion.create({
                    data: {
                      materialId,
                      chapterId: cfg.chapterId,
                      type: q.type || cfg.type,
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
                }
                totalGenerated += questions.length;
                return { cfgId: cfg.id, count: questions.length, error: null };
              }
              return { cfgId: cfg.id, count: 0, error: 'AI 返回了空结果' };
            })
            .catch((err) => {
              totalFailed++;
              return { cfgId: cfg.id, count: 0, error: err.message };
            })
        )
      );

      // 更新每个 config 的状态
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { cfgId, count, error } = result.value;
          if (error) {
            await this.prisma.materialQuestionPlanConfig.update({
              where: { id: cfgId },
              data: { errorMessage: error },
            });
          } else {
            await this.prisma.materialQuestionPlanConfig.update({
              where: { id: cfgId },
              data: { errorMessage: null },
            });
          }
        }
      }
    }

    // 更新章节题数
    for (const cfg of validConfigs) {
      if (!cfg.chapterId) continue;
      const cnt = await this.prisma.materialQuestion.count({
        where: { materialId, chapterId: cfg.chapterId },
      });
      await this.prisma.materialChapter.update({
        where: { id: cfg.chapterId },
        data: { questionCount: cnt },
      });
    }

    // 完成 — 只更新素材状态到 GENERATED（有题时），0题时不降级
    await this.prisma.materialQuestionPlan.update({
      where: { id: planId },
      data: { status: totalGenerated > 0 ? 'COMPLETED' : 'FAILED' },
    });
    if (totalGenerated > 0) {
      await this.prisma.material.update({
        where: { id: materialId },
        data: { status: 'GENERATED' },
      });
    }

    const chaptersProcessed = new Set(validConfigs.filter(c => c.chapterId).map(c => c.chapterId)).size;
    return {
      total: totalGenerated,
      failed: totalFailed,
      configs: validConfigs.length,
      chapters: chaptersProcessed,
      status: totalGenerated > 0 ? 'GENERATED' : 'FAILED',
    };
  }

  /**
   * 为单个出题配置调用 AI 生成试题
   */
  private async callAiForPlanConfig(
    material: any,
    config: any,
    cfg: { id: number; type: string; count: number; difficultyEasy?: number | null; difficultyMedium?: number | null; difficultyHard?: number | null; focusKeywords?: string | null; chapter?: any },
  ): Promise<any[]> {
    const content = cfg.chapter?.content || '';
    if (content.trim().length < 20) return [];

    const typeLabel: Record<string, string> = {
      'SINGLE_CHOICE': '单选题',
      'MULTIPLE_CHOICE': '多选题',
      'TRUE_FALSE': '判断题',
      'FILL_BLANK': '填空题',
      'SHORT_ANSWER': '简答题',
    };

    const typeInstructions = cfg.type === 'SINGLE_CHOICE' ? '提供4个选项(A/B/C/D)' :
      cfg.type === 'MULTIPLE_CHOICE' ? '提供4-5个选项' :
      cfg.type === 'TRUE_FALSE' ? '答案填true或false' :
      cfg.type === 'FILL_BLANK' ? '给出正确答案及填空位置' :
      cfg.type === 'SHORT_ANSWER' ? '给出参考答案要点' : '';

    const difficultyNote = `难度分布：易${cfg.difficultyEasy ?? 30}%、中${cfg.difficultyMedium ?? 50}%、难${cfg.difficultyHard ?? 20}%`;
    const focusNote = cfg.focusKeywords ? `重点关注的考点/关键词：${cfg.focusKeywords}` : '';

    const url = (config.apiBaseUrl?.replace(/\/+$/, '') || 'https://api.deepseek.com') + '/chat/completions';

    const systemPrompt = `你是一名资深学科命题专家。请根据提供的教材内容，生成符合中国考试标准的${typeLabel[cfg.type] || cfg.type}。

要求：
1. 严格基于教材内容出题，不要编造教材中没有的知识点
2. 题型：${typeLabel[cfg.type] || cfg.type}
3. ${typeInstructions}
4. 标注难度：EASY/MEDIUM_EASY/MEDIUM_HARD/HARD
5. 标注所属知识点(knowledgePoint)
6. 返回严格的JSON数组格式
7. 每道题必须包含以下所有字段（不可省略任一）：
   - type - difficulty - knowledgePoint - sourceChunk(20-50字原文引用)
   - content - options(选择题必填) - blanks(填空题必填)
   - answer - explanation(答案解析，必须包含)
   - suggestedGroup(默认"EXAM_GROUP")`;

    const userPrompt = `教材名称：${material.name}
${material.batchNote ? '教材说明：' + material.batchNote + '\n' : ''}
章节：${cfg.chapter?.title || ''}
${difficultyNote}
${focusNote}

以下为章节内容：
${content.slice(0, 15000)}

请根据以上内容生成 ${cfg.count} 道${typeLabel[cfg.type] || cfg.type}，难度分布遵循要求。
返回格式（严格 JSON 数组，不要有任何其他文字）：
[
  {
    "type": "${cfg.type}",
    "difficulty": "EASY|MEDIUM_EASY|MEDIUM_HARD|HARD",
    "knowledgePoint": "知识点名称",
    "sourceChunk": "引用的原文片段(20-50字)",
    "content": "题目内容",
    "options": [ { "label": "A", "content": "选项内容", "isCorrect": false } ],
    "blanks": [ { "blankIndex": 0, "answer": "正确答案" } ],
    "answer": "参考答案",
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
          temperature: Math.min(config.temperature || 0.7, 0.5),
          max_tokens: config.maxTokens || 4096,
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

      const questions = parseAIJsonResponse(reply);

      return questions
        .filter((q: any) => q.content)
        .map((q: any) => {
          const { question, warnings } = validateAndFixQuestion(q);
          if (warnings.length > 0) {
            console.warn(`[AI出题质量] 章节 "${cfg.chapter?.title || ''}" 题型 ${cfg.type}: ${warnings.join('; ')}`);
          }
          return {
            ...question,
            type: cfg.type,
            difficulty: question.difficulty,
          };
        });
    } catch (e: any) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        throw new Error('AI 请求超时');
      }
      throw e;
    }
  }

  /**
   * 查询出题进度
   */
  async getPlanProgress(materialId: number, planId: number) {
    const plan = await this.prisma.materialQuestionPlan.findFirst({
      where: { id: planId, materialId },
      include: { configs: true },
    });
    if (!plan) throw new NotFoundException('出题计划不存在');

    const totalConfigs = plan.configs.length;
    const completedConfigs = plan.configs.filter(c => !c.errorMessage && c.count > 0).length;
    const failedConfigs = plan.configs.filter(c => c.errorMessage).length;

    const totalQuestions = plan.configs.reduce((sum, c) => sum + c.count, 0);
    const generatedQuestions = await this.prisma.materialQuestion.count({ where: { materialId } });

    return {
      planStatus: plan.status,
      totalConfigs,
      completedConfigs,
      failedConfigs,
      totalQuestions,
      generatedQuestions,
    };
  }

  /**
   * 从 batchNote 生成出题计划并执行（兼容旧流程）
   */
  async generateFromBatchNote(materialId: number) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: {
        chapters: { where: { content: { not: null } }, orderBy: { chapterIndex: 'asc' } },
        subject: true,
      },
    });
    if (!material) throw new NotFoundException('教材不存在');
    if (!material.batchNote?.trim()) throw new BadRequestException('该教材没有出题要求(batchNote)，无法自动生成出题计划');

    const counts = this.parseQuestionCounts(material.batchNote);
    const validTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
    const configs: any[] = [];

    for (const ch of material.chapters) {
      // 只有有内容且足够多的章节才出题
      if ((ch.content?.length || 0) < 20) continue;
      for (const type of validTypes) {
        if ((counts[type] || 0) > 0) {
          // 在章节间均匀分配
          const perChapter = Math.max(1, Math.floor((counts[type] || 0) / material.chapters.length));
          if (perChapter > 0) {
            configs.push({ chapterId: ch.id, type, count: perChapter });
          }
        }
      }
    }

    if (configs.length === 0) throw new BadRequestException('batchNote 解析后无有效出题配置');

    // 创建计划
    const plan = await this.createQuestionPlan(materialId, {
      name: `${material.name} 自动出题`,
      configs,
    });

    // 执行
    return this.executeQuestionPlan(materialId, plan.id);
  }

  /**
   * 处理 DOCX 教材 — 使用 mammoth 提取文字
   */
  private async processDocx(materialId: number, filePath: string) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      if (text.trim().length < 10) {
        await this.prisma.material.update({
          where: { id: materialId },
          data: { errorMessage: 'Word文档中未找到文字内容' },
        });
      } else {
        const chapters = this.parseTextToChapters(text);
        await this.saveChapters(materialId, chapters);
        await this.prisma.material.update({
          where: { id: materialId },
          data: {
            status: 'OCR_DONE',
            totalPages: Math.ceil(text.length / 2000) || 1,
            errorMessage: null,
          },
        });
      }
    } catch (e: any) {
      console.error('Word text extraction failed:', e.message);
      await this.prisma.material.update({
        where: { id: materialId },
        data: { errorMessage: 'Word文字提取失败：' + e.message },
      }).catch(() => {});
    }
  }

  /**
   * 处理旧版 DOC 教材 — 尝试 catdoc，失败则提示转换
   */
  private async processDoc(materialId: number, filePath: string) {
    try {
      const { stdout } = await execFileAsync('catdoc', [filePath], {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const text = stdout.trim();
      if (text.length < 10) throw new Error('catdoc returned empty');
      const chapters = this.parseTextToChapters(text);
      await this.saveChapters(materialId, chapters);
      await this.prisma.material.update({
        where: { id: materialId },
        data: { status: 'OCR_DONE', totalPages: Math.ceil(text.length / 2000) || 1, errorMessage: null },
      });
    } catch {
      await this.prisma.material.update({
        where: { id: materialId },
        data: { errorMessage: '旧版 .doc 格式暂不支持自动提取，请转换为 .docx 后重试，或使用"录入正文"功能手动输入' },
      });
    }
  }
}

/**
 * 去除JSON中的尾随逗号（Node原生JSON.parse不支持尾逗号）
 */
function removeTrailingCommas(s: string): string {
  // 去掉对象/数组最后一个元素后的逗号：{...}, → {...} 以及 [...] → [...]
  return s.replace(/,\s*([}\]])/g, '$1');
}

/**
 * 多策略JSON解析：从AI回复中提取试题数组
 *
 * 策略说明：
 *  ① 直接 JSON.parse
 *  ② 去 markdown 代码块 → JSON.parse
 *  ③ 去尾部非JSON文本（截断到最后一个 ]）→ JSON.parse
 *  ④ 去代码块 + 去尾部文本
 *  ⑤ 去掉所有 ``` 标记后尝试解析
 *  ⑥ 以上策略均配合去除尾逗号再试一次（共12条路径）
 *
 *  ⑦ 兜底：去掉所有 markdown 标记 + 在中括号级别上平衡提取
 */
function parseAIJsonResponse(reply: string): any[] {
  // 去除尾逗号的包装器
  const withClean = (fn: (s: string) => any) =>
    (s: string) => fn(removeTrailingCommas(s));

  const strategies = [
    // 策略1：直接解析
    (s: string) => JSON.parse(s),
    withClean((s: string) => JSON.parse(s)),

    // 策略2：去markdown代码块
    (s: string) => {
      const m = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
      if (m) return JSON.parse(m[1].trim());
      throw new Error('no code block');
    },
    withClean((s: string) => {
      const m = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
      if (m) return JSON.parse(m[1].trim());
      throw new Error('no code block');
    }),

    // 策略3：去尾部非JSON文本（找到最后一个 ] 后截断）
    (s: string) => {
      const lastBracket = s.lastIndexOf(']');
      if (lastBracket >= 0) return JSON.parse(s.slice(0, lastBracket + 1));
      throw new Error('no array');
    },
    withClean((s: string) => {
      const lastBracket = s.lastIndexOf(']');
      if (lastBracket >= 0) return JSON.parse(s.slice(0, lastBracket + 1));
      throw new Error('no array');
    }),

    // 策略4：去markdown + 去尾部文本
    (s: string) => {
      const m = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
      if (m) {
        const trimmed = m[1].trim();
        const lastB = trimmed.lastIndexOf(']');
        if (lastB >= 0) return JSON.parse(trimmed.slice(0, lastB + 1));
      }
      throw new Error('all strategies failed');
    },
    withClean((s: string) => {
      const m = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
      if (m) {
        const trimmed = m[1].trim();
        const lastB = trimmed.lastIndexOf(']');
        if (lastB >= 0) return JSON.parse(trimmed.slice(0, lastB + 1));
      }
      throw new Error('all strategies failed');
    }),

    // 策略5：去掉所有 ``` 标记（含json/JSON语言标注），剩下的纯文本尝试解析
    (s: string) => {
      const cleaned = s.replace(/```(?:json|JSON)?\s*/g, '').replace(/\s*```/g, '').trim();
      const lastB = cleaned.lastIndexOf(']');
      if (lastB >= 0) return JSON.parse(cleaned.slice(0, lastB + 1));
      throw new Error('no array after stripping markers');
    },
    withClean((s: string) => {
      const cleaned = s.replace(/```(?:json|JSON)?\s*/g, '').replace(/\s*```/g, '').trim();
      const lastB = cleaned.lastIndexOf(']');
      if (lastB >= 0) return JSON.parse(cleaned.slice(0, lastB + 1));
      throw new Error('no array after stripping markers');
    }),

    // 策略6：提取第一个 [ 到最后一个 ] 之间的内容（去除头部和尾部的非JSON文本）
    (s: string) => {
      const firstBracket = s.indexOf('[');
      const lastBracket = s.lastIndexOf(']');
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        return JSON.parse(s.slice(firstBracket, lastBracket + 1));
      }
      throw new Error('no bracket pair');
    },
    withClean((s: string) => {
      const firstBracket = s.indexOf('[');
      const lastBracket = s.lastIndexOf(']');
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        return JSON.parse(s.slice(firstBracket, lastBracket + 1));
      }
      throw new Error('no bracket pair');
    }),
  ];

  for (const fn of strategies) {
    try {
      const result = fn(reply);
      if (Array.isArray(result) && result.length > 0) return result;
    } catch { /* try next */ }
  }

  // 全策略失败，尝试逐行提取：找内容最多的 [ 和 ] 之间的文本
  throw new Error('AI返回的JSON无法解析：不是有效的JSON数组');
}

/**
 * 逐题校验和修复
 */
function validateAndFixQuestion(q: any): { question: any; warnings: string[] } {
  const warnings: string[] = [];
  const fixed = { ...q };

  // 1. 类型验证
  const VALID_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
  if (!VALID_TYPES.includes(fixed.type)) {
    warnings.push(`无效题型: ${fixed.type}，回退至 SINGLE_CHOICE`);
    fixed.type = 'SINGLE_CHOICE';
  }

  // 2. 难度标准化
  const VALID_DIFF = ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'];
  if (!VALID_DIFF.includes(fixed.difficulty)) {
    const d = String(fixed.difficulty || '').toLowerCase();
    if (d.includes('易') || d === 'easy') fixed.difficulty = 'EASY';
    else if (d.includes('较易') || d === 'medium_easy') fixed.difficulty = 'MEDIUM_EASY';
    else if (d.includes('较难') || d === 'medium_hard' || d.includes('中')) fixed.difficulty = 'MEDIUM_HARD';
    else if (d.includes('难') || d === 'hard') fixed.difficulty = 'HARD';
    else {
      warnings.push(`无效难度: ${fixed.difficulty}，回退至 MEDIUM_EASY`);
      fixed.difficulty = 'MEDIUM_EASY';
    }
  }

  // 3. 答案解析强制提示
  if (!fixed.explanation || !fixed.explanation.trim()) {
    warnings.push('缺少答案解析(explanation)');
  }

  // 4. 知识点提示
  if (!fixed.knowledgePoint || !fixed.knowledgePoint.trim()) {
    warnings.push('缺少知识点(knowledgePoint)');
  }

  // 5. 原文引用提示
  if (!fixed.sourceChunk || !fixed.sourceChunk.trim()) {
    warnings.push('缺少原文引用(sourceChunk)');
  }

  // 6. 选择题校验
  if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(fixed.type)) {
    if (!fixed.options || !Array.isArray(fixed.options) || fixed.options.length < 2) {
      warnings.push('选择题选项不足');
    }
    if (fixed.type === 'SINGLE_CHOICE') {
      const correct = (fixed.options || []).filter((o: any) => o.isCorrect);
      if (correct.length !== 1) {
        warnings.push(`单选题应有1个正确选项，当前${correct.length}个`);
      }
    }
  }

  // 7. 判断题答案标准化
  if (fixed.type === 'TRUE_FALSE') {
    const ans = String(fixed.answer || '').trim().toLowerCase();
    if (['true', 't', '对', '正确', '√', '✓', '是', '1'].includes(ans)) {
      fixed.answer = 'true';
    } else if (['false', 'f', '错', '错误', '×', '✕', '否', '0'].includes(ans)) {
      fixed.answer = 'false';
    } else if (fixed.answer) {
      warnings.push(`判断题答案格式异常: ${fixed.answer}，未标准化`);
    }
  }

  // 8. 填空题校验
  if (fixed.type === 'FILL_BLANK') {
    if (!fixed.blanks || !Array.isArray(fixed.blanks) || fixed.blanks.length === 0) {
      warnings.push('填空题缺少空白(blanks)');
    }
  }

  // 9. 清洗options标签
  if (fixed.options && Array.isArray(fixed.options)) {
    fixed.options = fixed.options.map((o: any, i: number) => ({
      ...o,
      label: o.label || String.fromCharCode(65 + i),
    }));
  }

  return { question: fixed, warnings };
}

/**
 * 通过 ZIP 内部路径区分 DOCX / PPTX
 */
function detectOfficeType(buffer: Buffer, originalName: string): { ext: string; type: string } {
  const str = buffer.toString('utf-8', 0, Math.min(buffer.length, 100 * 1024));
  if (str.includes('word/')) return { ext: '.docx', type: 'docx' };
  if (str.includes('ppt/')) return { ext: '.pptx', type: 'pptx' };
  // 回退到文件扩展名
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.docx') return { ext: '.docx', type: 'docx' };
  if (ext === '.doc') return { ext: '.doc', type: 'doc' };
  return { ext: '.pptx', type: 'pptx' };
}
