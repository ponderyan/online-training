import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import { execFile } from 'child_process';
import * as util from 'util';
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
    if (!file) throw new BadRequestException('请上传PDF或PPTX文件');

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
    if (headerHex === '25504446') { detectedExt = '.pdf'; detectedType = 'pdf'; }
    else if (headerHex === '504b0304') { detectedExt = '.pptx'; detectedType = 'pptx'; }
    else { detectedExt = '.pdf'; detectedType = 'unknown'; }

    const savedName = `${crypto.randomUUID()}${detectedExt}`;
    const filePath = path.join(this.uploadDir, savedName);
    await fs.writeFile(filePath, file.buffer);

    const material = await this.prisma.material.create({
      data: {
        name: body.name || fixEncoding(file.originalname).replace(/\.(pdf|pptx)$/i, ''),
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
    } else {
      await this.prisma.material.update({
        where: { id: material.id },
        data: { errorMessage: '未能识别文件格式，请上传 PDF 或 PPTX 文件' },
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
    config: any, material: any, chapter: any, content: string,
    chapterCounts?: Record<string, number>
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
}
