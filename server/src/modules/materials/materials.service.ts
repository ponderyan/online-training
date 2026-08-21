import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AiUnavailableException } from '../../common/exceptions/ai-unavailable.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChunkingService } from '../ai-assistant/chunking.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
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
  private readonly logger = new Logger(MaterialsService.name);
  private uploadDir = path.resolve('uploads');
  /** ★ 2026-08-20 P1 后台化：进程内串行处理队列（OCR 为 CPU 密集 Python 子进程，串行避免资源打满） */
  private processingChain: Promise<void> = Promise.resolve();

  constructor(private prisma: PrismaService, private chunking: ChunkingService, private systemConfig: SystemConfigService) {
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
    // 剔除 OCR 多页合并时的页分隔标记（"=== 第 N 页 ==="），避免混入章节正文
    const lines = text.split('\n').filter(l => l.trim() && !/^=== 第 \d+ 页 ===$/.test(l.trim()));
    // 章级标题：第X章 / 第N章 / Chapter / Part / Markdown标题 / "一、"
    const chapterPattern = /^(第[一二三四五六七八九十百千]+章|第\d+章|Chapter\s+\d+|Part\s+\d+|#+\s*|[一二三四五六七八九十]+、)/i;
    // 节级标题（如 "1.1 "）：仅在整篇未出现章级标题时充当章节，
    // 避免"第二章标题 + 2.1 标题"紧邻时，空内容的章级标题被节级标题覆盖吞掉
    const sectionPattern = /^\d+\.\d+(?!\.\d)\s+/;
    const chapters: Array<{ title: string; content: string }> = [];
    let currentTitle = '全文';
    let currentContent: string[] = [];
    let sawChapter = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (chapterPattern.test(trimmed)) {
        sawChapter = true;
        if (currentContent.length > 0) {
          chapters.push({ title: currentTitle, content: currentContent.join('\n') });
        }
        currentTitle = trimmed.replace(/^#+\s*/, '');
        currentContent = [];
      } else if (sectionPattern.test(trimmed) && !sawChapter) {
        if (currentContent.length > 0) {
          chapters.push({ title: currentTitle, content: currentContent.join('\n') });
        }
        currentTitle = trimmed;
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
   * 保存章节到数据库（Part 3.2: 单章节大文档自动触发 AI 分章）
   */
  private async saveChapters(materialId: number, chapters: Array<{ title: string; content: string }>, materialName?: string) {
    // Part 3.2: 如果只有1章且内容>5000字，尝试 AI 辅助分章
    if (chapters.length === 1 && chapters[0].content.length > 5000 && materialName) {
      const aiChapters = await this.aiSplitChapters(chapters[0].content, materialName);
      if (aiChapters.length > 1) {
        console.log(`[AI分章] 教材 "${materialName}" 从1章拆分为${aiChapters.length}章`);
        chapters = aiChapters;
      }
    }

    for (let i = 0; i < chapters.length; i++) {
      await this.prisma.materialChapter.create({
        data: {
          materialId,
          // ★ 2026-08-22 修复：AI 分章可能返回超长标题，title 列 varchar(500) 超限触发 P2000 导致整份教材章节保存失败；
          // 顺手去除目录点线引导符（如 "6.4 工艺设计……123"）
          title: (String(chapters[i].title || `第${i + 1}章`)
            .replace(/[.．…·]{4,}\s*\d*\s*$/, '')
            .trim()
            .slice(0, 490)) || `第${i + 1}章`,
          chapterIndex: i,
          content: chapters[i].content,
          contentLength: Buffer.byteLength(chapters[i].content, 'utf-8'),
          status: 'GENERATED',
          sortOrder: i,
        },
      });
    }
    // 自动生成知识块（异步，不阻塞主流程）
    this.chunking.rebuildForMaterial(materialId).catch((e: any) => {
      this.logger.warn(`[分块] 教材 #${materialId} 知识块生成失败: ${e.message}`);
    });
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
      const chapterCount = await this.saveChapters(material.id, chapters, data.name);

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
    } else if (headerHex.startsWith('89504e47')) {
      detectedExt = '.png'; detectedType = 'image';
    } else if (headerHex.startsWith('ffd8ff')) {
      detectedExt = '.jpg'; detectedType = 'image';
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

    // ── 根据格式路由到不同提取管线（★ 2026-08-20 P1 后台化：入队后台串行处理，接口立即返回） ──
    // 前端轮询 GET /materials/:id 看 status/processingProgress；失败可 POST :id/reprocess 重试
    this.enqueueProcessing(material.id, filePath, detectedType, file.originalname);

    return this.findOne(material.id);
  }

  /**
   * ★ 2026-08-20 P1 后台化：串行队列执行提取管线（上传接口不再阻塞等待 OCR）
   * 状态机：UPLOADED → PROCESSING(+进度) → OCR_DONE / 失败(errorMessage，进度置 null)
   */
  private enqueueProcessing(materialId: number, filePath: string, detectedType: string, originalName: string) {
    this.processingChain = this.processingChain
      .then(async () => {
        await this.prisma.material.update({
          where: { id: materialId },
          data: { status: 'PROCESSING', processingProgress: 5, errorMessage: null },
        }).catch(() => {});
        if (detectedType === 'pptx') await this.processPptx(materialId, filePath);
        else if (detectedType === 'pdf') await this.processPdf(materialId, filePath, originalName);
        else if (detectedType === 'docx') await this.processDocx(materialId, filePath);
        else if (detectedType === 'doc') await this.processDoc(materialId, filePath);
        else if (detectedType === 'image') await this.processImage(materialId, filePath, originalName);
        else {
          await this.prisma.material.update({
            where: { id: materialId },
            data: { errorMessage: '未能识别文件格式，请上传 PDF、PPTX、DOCX 或图片（PNG/JPG）文件' },
          });
        }
        // 收尾：成功补满进度；失败回退 UPLOADED（前端卡片才会显示「重试识别」入口，轮询也会停止）
        const after = await this.prisma.material.findUnique({ where: { id: materialId }, select: { status: true } });
        await this.prisma.material.update({
          where: { id: materialId },
          data: after?.status === 'OCR_DONE'
            ? { processingProgress: 100 }
            : { status: 'UPLOADED', processingProgress: null },
        }).catch(() => {});
      })
      .catch((e) => {
        this.logger.error(`教材 ${materialId} 后台处理失败：${(e as Error)?.message}`);
        this.prisma.material.update({
          where: { id: materialId },
          data: { status: 'UPLOADED', errorMessage: '处理失败：' + (e as Error)?.message, processingProgress: null },
        }).catch(() => {});
      });
  }

  /** 进度里程碑（失败静默，不阻断主管线） */
  private async setProgress(materialId: number, pct: number) {
    await this.prisma.material.update({ where: { id: materialId }, data: { processingProgress: pct } }).catch(() => {});
  }

  /**
   * ★ 2026-08-20 P1 后台化：失败/卡住教材重试（无需重新上传）
   */
  async reprocess(id: number) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m || m.archivedAt) throw new BadRequestException('教材不存在或已归档');
    const filePath = path.join(this.uploadDir, m.filePath);
    await fs.access(filePath).catch(() => {
      throw new BadRequestException('源文件已丢失，无法重试，请重新上传');
    });
    // ★ 2026-08-22 修复：重试识别 = 重建章节结构，先清旧章节与未审核题目，
    // 否则会追加重复章节；已入库题目仅断开章节关联（外键无 onDelete）
    await this.prisma.materialQuestion.deleteMany({
      where: { materialId: id, reviewStatus: { in: ['PENDING', 'REJECTED'] } },
    });
    await this.prisma.materialQuestion.updateMany({
      where: { materialId: id },
      data: { chapterId: null },
    });
    await this.prisma.materialChapter.deleteMany({ where: { materialId: id } });
    await this.prisma.material.update({
      where: { id },
      data: { status: 'UPLOADED', errorMessage: null, processingProgress: 0 },
    });
    this.enqueueProcessing(id, filePath, m.fileType || 'unknown', m.fileName);
    return this.findOne(id);
  }

  /**
   * 处理 PDF 教材：pdf-parse 提取，不足时走 OCR 兜底
   */
  private async processPdf(materialId: number, filePath: string, originalName: string) {
    try {
      const { text, numPages } = await this.extractPdfText(filePath);
      await this.setProgress(materialId, 30); // 文本提取完成
      // 有效文本判定：pdf-parse 对纯图片/扫描 PDF 会输出 "-- N of M --" 分页标记垃圾，
      // 需剔除后再判断是否走 OCR，否则 ≥10 字符的标记会绕过 OCR 触发。
      // ★ 2026-08-22 修复：仅有少量文字层的扫描件（如只提到目录）还需按"字/页"密度判定，
      // 否则少量垃圾文本绕过 OCR 导致章节结构为空（教材#19 根因）
      const meaningful = this.meaningfulTextLen(text);
      // ★ 2026-08-22 密度阈值提到 100字/页：仅有目录文字层的扫描件（教材#19，184页只提到3.8KB）
      // 在 20字/页阈值下会绕过 OCR；真实文字层教材页均≥150字，不会误伤
      const minExpected = Math.max(500, (numPages || 1) * 100);
      if (meaningful < minExpected) {
        console.warn(`PDF text too little for ${originalName} (${meaningful} chars / ${numPages} pages, expected ≥${minExpected}), trying OCR...`);
        await this.setProgress(materialId, 40); // OCR 开始
        // 走 OCR 兜底
        try {
          const ocrText = await this.ocrPdfFallback(filePath, numPages);
          if (this.meaningfulTextLen(ocrText) > 20) {
            const chapters = this.parseTextToChapters(ocrText);
            await this.saveChapters(materialId, chapters, originalName);
            await this.prisma.material.update({
              where: { id: materialId },
              data: { status: 'OCR_DONE', totalPages: numPages || 1, errorMessage: null },
            });
            return;
          }
        } catch (ocrErr: any) {
          // ★ 2026-08-22 修复：不再静默吞错 — 此前 OCR 超时被 catch{} 吞掉，完全看不到失败原因
          console.error(`OCR fallback failed for ${originalName}: ${ocrErr.message}`);
        }
        // OCR 也失败，保持 UPLOADED + 提示
        await this.prisma.material.update({
          where: { id: materialId },
          data: { totalPages: numPages || 1, errorMessage: '未能提取到有效文字（OCR 未成功），PDF 可能为扫描件或页数过多，建议重试或手动录入正文' },
        });
      } else {
        const chapters = this.parseTextToChapters(cleanPdfText(text));
        await this.saveChapters(materialId, chapters, originalName);
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
        data: { errorMessage: 'PDF 文字提取失败：' + (e.message || '未知错误') },
      }).catch(() => {});
      // ★ 2026-08-22 修复：向上抛出，让后台队列回退 UPLOADED；
      // 否则教材卡在中间态，前端不显示「重试识别」入口（教材#19 卡死根因）
      throw e;
    }
  }

  /**
   * 处理 PPTX 教材：调用 Python 脚本提取幻灯片文字；纯图片 PPTX 走图片 OCR 兜底
   */
  private async processPptx(materialId: number, filePath: string) {
    try {
      const { text, totalSlides, images } = await this.extractPptxText(filePath);
      await this.setProgress(materialId, 30); // 幻灯片文本提取完成
      if (text.trim().length < 10) {
        // 纯图片 PPTX：导出幻灯片图片 → OCR 兜底
        if (images && images.length > 0) {
          const ocrParts: string[] = [];
          for (const img of images) {
            try {
              const t = await this.ocrImageFallback(img.path);
              if (t.trim()) ocrParts.push(`\n\n=== 第 ${img.slide} 页 ===\n\n${t.trim()}`);
            } catch {}
            await fs.unlink(img.path).catch(() => {});
          }
          await fs.rmdir(path.dirname(images[0].path)).catch(() => {});
          const ocrText = ocrParts.join('');
          if (this.meaningfulTextLen(ocrText) > 20) {
            const chapters = this.parseTextToChapters(ocrText);
            await this.saveChapters(materialId, chapters);
            await this.prisma.material.update({
              where: { id: materialId },
              data: { status: 'OCR_DONE', totalPages: totalSlides, errorMessage: null },
            });
            return;
          }
        }
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
   * 处理图片教材（png/jpg）：直接 OCR 提取文本
   */
  private async processImage(materialId: number, filePath: string, originalName: string) {
    try {
      await this.setProgress(materialId, 40); // OCR 开始
      const ocrText = await this.ocrImageFallback(filePath);
      if (this.meaningfulTextLen(ocrText) > 20) {
        const chapters = this.parseTextToChapters(ocrText);
        await this.saveChapters(materialId, chapters, originalName);
        await this.prisma.material.update({
          where: { id: materialId },
          data: { status: 'OCR_DONE', totalPages: 1, errorMessage: null },
        });
      } else {
        await this.prisma.material.update({
          where: { id: materialId },
          data: { totalPages: 1, errorMessage: '未能识别图片中的文字，请确认图片清晰或改用 PDF/文本方式录入' },
        });
      }
    } catch (e: any) {
      console.error('Image OCR failed:', e.message);
      await this.prisma.material.update({
        where: { id: materialId },
        data: { errorMessage: '图片 OCR 失败：' + e.message },
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
  private async extractPptxText(filePath: string): Promise<{ text: string; totalSlides: number; images: { slide: number; path: string }[] }> {
    const scriptPath = path.resolve('scripts/extract-pptx-text.py');
    try {
      const { stdout } = await execFileAsync('python3', [scriptPath, filePath], {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const result = JSON.parse(stdout);
      if (result.error) throw new Error(result.error);
      const text = result.slides.map((s: any) => s.text).filter(Boolean).join('\n\n');
      return { text, totalSlides: result.total, images: result.images || [] };
    } catch (e: any) {
      throw new Error(`PPTX 文字提取失败: ${e.message}`);
    }
  }

  /**
   * OCR 兜底 — 调用 Python ocr-pdf.py 脚本（RapidOCR 主引擎，tesseract 降级）
   */
  /**
   * 有效文本长度：剔除 pdf-parse 对无文本层 PDF 输出的分页标记（"-- 1 of 2 --"）
   * 与 OCR 页分隔符（"=== 第 N 页 ==="），仅返回真实正文长度。
   * 用于 OCR 触发判定与 OCR 成功判定，避免垃圾标记绕过阈值。
   */
  private meaningfulTextLen(text: string): number {
    return text
      .replace(/--\s*\d+\s+of\s+\d+\s*--/g, '')
      .replace(/=== 第 \d+ 页 ===/g, '')
      .trim().length;
  }

  private async ocrPdfFallback(filePath: string, numPages = 0): Promise<string> {
    const scriptPath = path.resolve('scripts/ocr-pdf.py');
    const outPath = filePath + '_ocr.txt';
    try {
      // ★ 2026-08-22 动态超时：RapidOCR 实测 ~2秒/页，预算 5秒/页 + 2分钟缓冲，下限5分钟。
      // 此前写死 300s：184 页扫描教材（约6分钟）被中途杀掉，导致 OCR 永远完不成
      const timeoutMs = Math.max(300000, (numPages || 0) * 5000 + 120000);
      await execFileAsync('python3', [scriptPath, filePath, outPath], {
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
      });
      const text = await fs.readFile(outPath, 'utf-8');
      await fs.unlink(outPath).catch(() => {});
      return text.trim();
    } catch (e: any) {
      throw new Error(`OCR 识别失败: ${e.message}`);
    }
  }

  /**
   * 图片 OCR — 调用 Python ocr-pdf.py image 模式（RapidOCR 主引擎，tesseract 降级）
   */
  private async ocrImageFallback(imagePath: string): Promise<string> {
    const scriptPath = path.resolve('scripts/ocr-pdf.py');
    const outPath = imagePath + '_ocr.txt';
    try {
      await execFileAsync('python3', [scriptPath, 'image', imagePath, outPath], {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const text = await fs.readFile(outPath, 'utf-8');
      await fs.unlink(outPath).catch(() => {});
      return text.trim();
    } catch (e: any) {
      throw new Error(`图片 OCR 失败: ${e.message}`);
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

      // 导入到正式题库（P0修复：传入上下文用于章节匹配+orgId+溯源）
      const subject = await this.prisma.subject.findUnique({
        where: { id: question.material.subjectId },
        select: { orgId: true },
      });
      const chapter = question.chapterId
        ? await this.prisma.materialChapter.findUnique({ where: { id: question.chapterId }, select: { title: true } })
        : null;
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
        { materialName: question.material.name, chapterTitle: chapter?.title, orgId: subject?.orgId },
        { minAnswerWords: question.minAnswerWords, rubric: question.rubric },
        (question.subQuestions as any) || undefined,
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

    // approve: 逐条导入题库（P2-1: 消除N+1 | P2-2: 事务保护）
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { name: true, subjectId: true, subject: { select: { orgId: true } } },
    });
    if (!material) throw new NotFoundException('教材不存在');

    // 预加载章节标题映射
    const chapterIds = [...new Set(pendingQuestions.map(q => q.chapterId).filter(Boolean))] as number[];
    const chapterMap = new Map<number, string>();
    if (chapterIds.length > 0) {
      const chs = await this.prisma.materialChapter.findMany({ where: { id: { in: chapterIds } }, select: { id: true, title: true } });
      for (const ch of chs) chapterMap.set(ch.id, ch.title);
    }

    let imported = 0;
    for (const q of pendingQuestions) {
      const chTitle = q.chapterId ? chapterMap.get(q.chapterId) || null : null;
      const result = await this.importToQuestionBank(
        material.subjectId,
        q.type as any,
        q.content,
        q.difficulty as any,
        q.options,
        q.blanks,
        q.answer,
        q.explanation,
        q.knowledgePoint,
        q.sourceChunk,
        { materialName: material.name, chapterTitle: chTitle, orgId: material.subject?.orgId },
        { minAnswerWords: q.minAnswerWords, rubric: q.rubric },
        (q.subQuestions as any) || undefined,
      );
      await this.prisma.materialQuestion.update({
        where: { id: q.id },
        data: { reviewStatus: 'APPROVED', questionId: result.id },
      });
      imported++;
    }

    return { updated: imported, action: 'approved' };
  }

  /**
   * 导入正式题库（P0修复：智能章节匹配 + orgId + sourceNote + 知识点关联）
   */
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
    context?: { materialName?: string; chapterTitle?: string | null; orgId?: number | null },
    essayExtras?: { minAnswerWords?: number | null; rubric?: any },
    subQuestions?: Array<{ content: string; answer?: string; score?: number }>,
  ) {
    // P0-1: 智能匹配 Subject 的 Chapter（按名称模糊匹配，兜底取第一个）
    const chapterId = await this.resolveSubjectChapter(subjectId, context?.chapterTitle || undefined);

    // Part 1.3: 入库去重 — 同科目下内容高度相似的题目不重复创建
    const contentPrefix = content.trim().slice(0, 50);
    if (contentPrefix.length >= 10) {
      const candidates = await this.prisma.question.findMany({
        where: { subjectId, content: { contains: contentPrefix.slice(0, 30) } },
        select: { id: true, content: true },
        take: 5,
      });
      for (const c of candidates) {
        if (jaccardSimilarity(normalizeContent(c.content), normalizeContent(content)) > 0.9) {
          console.log(`[入库去重] 跳过重复题目: "${content.slice(0, 40)}..." (已有 #${c.id})`);
          return c as any;
        }
      }
    }

    // 创建正式试题
    const question = await this.prisma.question.create({
      data: {
        subjectId,
        chapterId,
        type: type as any,
        content,
        analysis: explanation || '',
        difficulty: difficulty as any,
        source: 'AI_IMPORT',
        status: 'PUBLISHED',
        minAnswerWords: Number.isInteger(essayExtras?.minAnswerWords) ? essayExtras!.minAnswerWords : null,
        rubric: Array.isArray(essayExtras?.rubric) && essayExtras!.rubric.length > 0 ? essayExtras!.rubric : undefined,
        orgId: context?.orgId ?? null,  // P0-3: 机构归属
        sourceNote: context?.materialName
          ? `来源教材：${context.materialName}${context.chapterTitle ? ` > ${context.chapterTitle}` : ''}`
          : null,  // P1-2: 溯源
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

    // 处理案例题小问（CASE_STUDY）
    if (Array.isArray(subQuestions) && subQuestions.length > 0) {
      await this.prisma.questionSubQuestion.createMany({
        data: subQuestions.map((s: any, i: number) => ({
          questionId: question.id,
          content: String(s.content || ''),
          answer: s.answer ? String(s.answer) : null,
          score: Number.isInteger(s.score) ? s.score : null,
          sortOrder: i,
        })),
      });
    }

    // P1-3: 关联知识点（按名称查找该科目下已有的知识点）
    if (knowledgePoint?.trim()) {
      const kp = await this.prisma.knowledgePoint.findFirst({
        where: { subjectId, name: { contains: knowledgePoint.trim() } },
      });
      if (kp) {
        await this.prisma.questionKnowledgePoint.create({
          data: { questionId: question.id, knowledgePointId: kp.id, weight: 1.0 },
        }).catch(() => {}); // 重复不报错
      }
    }

    return question;
  }

  /**
   * P0-1: 智能匹配科目章节 — 按标题相似度匹配，兜底取第一个章节
   */
  private async resolveSubjectChapter(subjectId: number, materialChapterTitle?: string): Promise<number> {
    const chapters = await this.prisma.chapter.findMany({
      where: { subjectId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    });
    if (chapters.length === 0) {
      // 该科目无章节，创建一个默认章节
      const created = await this.prisma.chapter.create({
        data: { subjectId, name: '默认章节', sortOrder: 0 },
      });
      return created.id;
    }
    if (!materialChapterTitle) return chapters[0].id;

    // 1. 精确匹配
    const exact = chapters.find(c => c.name === materialChapterTitle);
    if (exact) return exact.id;

    // 2. 包含匹配（教材章节标题包含科目章节名，或反之）
    const partial = chapters.find(c =>
      materialChapterTitle.includes(c.name) || c.name.includes(materialChapterTitle)
    );
    if (partial) return partial.id;

    // 3. 关键词交集匹配：将标题拆词，计算交集/并集比 > 0.5 则命中
    const tokenize = (s: string): Set<string> => {
      // 去掉章节序号前缀（第X章、X.X 等），提取有效词
      const cleaned = s.replace(/^第[一二三四五六七八九十百千\d]+[章节篇单元模块]?\s*/, '').replace(/^[\d.．]+\s*/, '');
      // 按标点和空格拆词，过滤单字
      const words = cleaned.split(/[\s，。、；：''（）【】\/\-—·]+/).filter(w => w.length >= 2);
      return new Set(words);
    };
    const titleTokens = tokenize(materialChapterTitle);
    if (titleTokens.size > 0) {
      let bestMatch: { id: number; score: number } | null = null;
      for (const c of chapters) {
        const cTokens = tokenize(c.name);
        if (cTokens.size === 0) continue;
        let inter = 0;
        for (const t of titleTokens) { if (cTokens.has(t)) inter++; }
        const union = new Set([...titleTokens, ...cTokens]).size;
        const score = union > 0 ? inter / union : 0;
        if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: c.id, score };
        }
      }
      if (bestMatch) return bestMatch.id;
    }

    // 4. 兜底：第一个章节
    return chapters[0].id;
  }

  /** 从系统配置加载难度定义，注入 AI Prompt */
  private async getDifficultyPromptBlock(): Promise<string> {
    const defs = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['difficulty_def_easy', 'difficulty_def_medium_easy', 'difficulty_def_medium_hard', 'difficulty_def_hard'] } },
      select: { key: true, value: true },
    });
    const map: Record<string, string> = {};
    for (const d of defs) map[d.key] = d.value;
    const easy = map['difficulty_def_easy'] || '识记：教材原文直接可答，无需推理';
    const mediumEasy = map['difficulty_def_medium_easy'] || '理解：原文的归纳、改写、同义替换';
    const mediumHard = map['difficulty_def_medium_hard'] || '应用：综合2+知识点，或应用到具体情境';
    const hard = map['difficulty_def_hard'] || '分析评价：新情境下的诊断/决策，教材无直接答案';
    return `难度判定标准（必须严格遵循）：
- EASY（识记）：${easy}
- MEDIUM_EASY（理解）：${mediumEasy}
- MEDIUM_HARD（应用）：${mediumHard}
- HARD（分析评价）：${hard}`;
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

    // P0-2: 仅删除未审核/已拒绝的题目，保留已入库记录
    await this.prisma.materialQuestion.deleteMany({ where: { materialId: id, reviewStatus: { in: ["PENDING", "REJECTED"] } } });

    const allQuestions: any[] = [];
    let totalTokens = 0;
    // Part 1: 程序级去重 + Part 2: 质量统计
    const seenContents: string[] = [];
    let skippedDupes = 0;
    let skippedInvalid = 0;
    let noExplanation = 0;

    for (const chapter of material.chapters) {
      const content = chapter.content || '';
      if (content.trim().length < 20) continue;

      try {
        const result = await this.callAiForQuestions(
          config, material, chapter, content, chapterCounts.get(chapter.id)
        );
        if (result.questions?.length > 0) {
          for (const q of result.questions) {
            // Part 1: 程序级去重（跨章节累积）
            const normalized = normalizeContent(q.content || '');
            if (isDuplicateQuestion(normalized, seenContents)) {
              skippedDupes++;
              continue;
            }
            seenContents.push(normalized);

            // Part 2: 质量标记
            const qualityFlag = q._qualityFlag || null;
            if (qualityFlag === 'NO_EXPLANATION') noExplanation++;

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
                subQuestions: Array.isArray(q.subQuestions) && q.subQuestions.length > 0 ? q.subQuestions : undefined,
                answer: q.answer || null,
                explanation: q.explanation || null,
                minAnswerWords: Number.isInteger(q.minAnswerWords) ? q.minAnswerWords : null,
                rubric: Array.isArray(q.rubric) && q.rubric.length > 0 ? q.rubric : undefined,
                suggestedGroup: q.suggestedGroup || 'EXAM_GROUP',
                reviewStatus: 'PENDING',
                ...(qualityFlag ? { reviewNote: `[质量标记] ${qualityFlag}` } : {}),
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

    if (skippedDupes > 0 || skippedInvalid > 0) {
      console.log(`[AI出题质量] 教材 #${id} 去重丢弃 ${skippedDupes} 题，不合格丢弃 ${skippedInvalid} 题，缺解析 ${noExplanation} 题`);
    }

    return {
      total: allQuestions.length,
      skippedDupes,
      skippedInvalid,
      noExplanation,
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
    const difficultyBlock = await this.getDifficultyPromptBlock();

    const systemPrompt = `你是一名资深学科命题专家，擅长根据教材内容编制高质量考试试题。

核心要求：
1. 严格基于教材内容出题，不要编造教材中没有的知识点
2. 题型包括：单选题(SINGLE_CHOICE)、多选题(MULTIPLE_CHOICE)、判断题(TRUE_FALSE)、填空题(FILL_BLANK)、简答题(SHORT_ANSWER)、案例题(CASE_STUDY)、论文题(ESSAY)
3. 难度标注必须严格遵循以下标准：
${difficultyBlock}
4. 标注所属知识点(knowledgePoint)
5. 单选题提供4个选项(A/B/C/D)，有且仅有1个正确选项
6. 多选题提供4-5个选项，有2-4个正确选项
7. 判断题答案填 true 或 false
8. 填空题需给出正确答案
9. 简答题需给出参考答案要点（至少3个要点）
10. 案例题的 content 写完整案例材料（150-400字，基于教材知识点构造真实工作情境）+作答要求，subQuestions 给2-4个小问，每问包含 content（小问）、answer（参考答案要点）、score（分值）
11. 论文题给出论文题目，并在 answer 字段写写作要点（至少4条）、rubric 字段给3-5条采分点（{description, points, type:add|deduct}）、minAnswerWords 给最低字数要求（500-4000的整数）
12. 题目覆盖教材的重点和难点，避免重复考查同一知识点

答案规范（极其重要）：
- 选择题的 answer 字段必须填写正确选项的 label，如单选 "A"，多选 "A,B,C"
- 选择题的 options 中 isCorrect 必须与 answer 字段完全一致
- explanation 字段必须包含，需说明正确答案的依据，引用教材原文
- sourceChunk 必须是从教材中直接引用的20-50字原文

返回严格的 JSON 数组格式，不要包含任何其他文字。每道题必须包含以下所有字段：
type, difficulty, knowledgePoint, sourceChunk, content, options(选择题必填), blanks(填空题必填), subQuestions(案例题必填), answer, explanation, suggestedGroup(默认"EXAM_GROUP")

示例（单选题）：
{"type":"SINGLE_CHOICE","difficulty":"MEDIUM_EASY","knowledgePoint":"数字化转型","sourceChunk":"数字化转型是企业利用数字技术重塑业务流程和组织架构的过程","content":"数字化转型的核心目标是？","options":[{"label":"A","content":"降低人力成本","isCorrect":false},{"label":"B","content":"重塑业务流程和组织架构","isCorrect":true},{"label":"C","content":"增加IT设备采购","isCorrect":false},{"label":"D","content":"实现无纸化办公","isCorrect":false}],"answer":"B","explanation":"教材明确指出数字化转型是企业利用数字技术重塑业务流程和组织架构的过程，而非简单的成本削减或设备采购。","suggestedGroup":"EXAM_GROUP"}

示例（填空题）：
{"type":"FILL_BLANK","difficulty":"EASY","knowledgePoint":"云计算","sourceChunk":"云计算的三大服务模式为IaaS、PaaS和SaaS","content":"云计算的三大服务模式为____、____和____。","blanks":[{"blankIndex":0,"answer":"IaaS"},{"blankIndex":1,"answer":"PaaS"},{"blankIndex":2,"answer":"SaaS"}],"answer":"IaaS,PaaS,SaaS","explanation":"教材原文：云计算的三大服务模式为IaaS（基础设施即服务）、PaaS（平台即服务）和SaaS（软件即服务）。","suggestedGroup":"EXAM_GROUP"}

示例（案例题）：
{"type":"CASE_STUDY","difficulty":"MEDIUM_HARD","knowledgePoint":"数字化转型","sourceChunk":"数字化转型是企业利用数字技术重塑业务流程和组织架构的过程","content":"【案例材料】某传统制造企业近三年利润持续下滑，管理层决定启动数字化转型，但在推进过程中遭遇了员工抵触、数据孤岛和投入产出失衡等问题。\n请结合教材相关内容，回答下列小问。","subQuestions":[{"content":"该企业数字化转型受阻的主要原因有哪些？","answer":"要点：1)组织变革滞后于技术引入；2)数据孤岛导致协同困难；3)缺乏顶层设计与投入规划","score":8},{"content":"请结合教材提出针对性的改进建议。","answer":"要点：1)战略层面顶层设计；2)打通数据治理；3)分阶段投入与评估","score":12}],"answer":"各小问参考答案见 subQuestions","explanation":"案例情境对应教材中数字化转型的实施路径与常见风险章节，小问分别考查归因分析与对策应用能力。","suggestedGroup":"EXAM_GROUP"}

示例（论文题）：
{"type":"ESSAY","difficulty":"MEDIUM_HARD","knowledgePoint":"数字化转型","sourceChunk":"数字化转型是企业利用数字技术重塑业务流程和组织架构的过程","content":"结合教材内容，论述企业数字化转型的实施路径与关键风险。","answer":"写作要点：1)战略定位与顶层设计；2)技术选型与数据治理；3)组织变革与人才培养；4)风险识别与合规管控","minAnswerWords":800,"rubric":[{"description":"论点明确、结构完整","points":6,"type":"add"},{"description":"论据充分且引用教材观点","points":6,"type":"add"},{"description":"结合实际案例分析","points":5,"type":"add"},{"description":"逻辑混乱或偏离主题","points":5,"type":"deduct"}],"explanation":"教材从战略、技术、组织、风险四个维度阐述了数字化转型的实施框架，论文应围绕该框架展开论述。","suggestedGroup":"EXAM_GROUP"}`;

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
    "type": "SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE|FILL_BLANK|SHORT_ANSWER|CASE_STUDY|ESSAY",
    "difficulty": "EASY|MEDIUM_EASY|MEDIUM_HARD|HARD",
    "knowledgePoint": "知识点名称",
    "sourceChunk": "引用的原文片段(20-50字)",
    "content": "题目内容",
    "options": [ { "label": "A", "content": "选项内容", "isCorrect": false } ],
    "blanks": [ { "blankIndex": 0, "answer": "正确答案" } ],
    "subQuestions": [ { "content": "小问内容", "answer": "参考答案要点", "score": 10 } ],
    "answer": "参考答案（填空题逗号分隔多空，简答题写要点）",
    "explanation": "答案解析",
    "suggestedGroup": "EXAM_GROUP"
  }
]`;

    // B3: 包装重试机制（最多3次尝试）
    return withAiRetry(
      async (attempt) => {
        const temp = Math.min(config.temperature || 0.7, 0.3) - (attempt * 0.05); // 重试时更保守
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
            temperature: Math.max(0.1, temp),
            max_tokens: config.maxTokens || 8192,
          }),
          signal: AbortSignal.timeout(300000),
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

        const validated = questions
          .filter((q: any) => q.content && q.type)
          .map((q: any) => {
            const { question, warnings, valid } = validateAndFixQuestion(q);
            if (warnings.length > 0) {
              console.warn(`[AI出题质量] 章节 "${chapter.title}" 题目: ${warnings.join('; ')}`);
            }
            return { question: { ...question, type: question.type, difficulty: question.difficulty }, valid };
          });
        const validQuestions = validated.filter(v => v.valid).map(v => v.question);
        const invalidCount = validated.filter(v => !v.valid).length;
        if (invalidCount > 0) {
          console.warn(`[AI出题质量] 章节 "${chapter.title}" 丢弃 ${invalidCount} 道不合格题目`);
        }

        return { questions: validQuestions, tokens: totalTokens };
      },
      (result) => result.questions.length > 0, // 验证：至少有1题
      2,
    );
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
      '案例题': 'CASE_STUDY',
      '论文题': 'ESSAY',
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
      'CASE_STUDY': '案例题',
      'ESSAY': '论文题',
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

    const updated = await this.prisma.materialChapter.update({
      where: { id: chapterId },
      data: { title: data.title.trim() },
    });
    this.triggerChunkRebuild(materialId);
    return updated;
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

    const merged = await this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
    this.triggerChunkRebuild(materialId);
    return merged;
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

    const split = await this.prisma.materialChapter.findMany({
      where: { materialId },
      orderBy: { sortOrder: 'asc' },
    });
    this.triggerChunkRebuild(materialId);
    return split;
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
    this.triggerChunkRebuild(materialId);

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
   * 章节编辑（改标题/合并/分割/删除）后触发知识块重建（fire-and-forget）
   * ★ 2026-08-20 链路补洞：原章节编辑不触发重建，检索内容与教材正文脱节
   */
  private triggerChunkRebuild(materialId: number) {
    this.chunking.rebuildForMaterial(materialId).catch((e: any) => {
      this.logger.warn(`[分块] 章节编辑后重建知识块失败（material ${materialId}）：${e?.message}`);
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

    // P0-2: 仅删除未审核/已拒绝的试题，保留已入库记录
    await this.prisma.materialQuestion.deleteMany({ where: { materialId, reviewStatus: { in: ["PENDING", "REJECTED"] } } });

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
                      subQuestions: Array.isArray(q.subQuestions) && q.subQuestions.length > 0 ? q.subQuestions : undefined,
                      answer: q.answer || null,
                      explanation: q.explanation || null,
                      minAnswerWords: Number.isInteger(q.minAnswerWords) ? q.minAnswerWords : null,
                      rubric: Array.isArray(q.rubric) && q.rubric.length > 0 ? q.rubric : undefined,
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
    const difficultyBlock = await this.getDifficultyPromptBlock();

    const typeLabel: Record<string, string> = {
      'SINGLE_CHOICE': '单选题',
      'MULTIPLE_CHOICE': '多选题',
      'TRUE_FALSE': '判断题',
      'FILL_BLANK': '填空题',
      'SHORT_ANSWER': '简答题',
      'CASE_STUDY': '案例题',
      'ESSAY': '论文题',
    };

    const typeInstructions = cfg.type === 'SINGLE_CHOICE' ? '提供4个选项(A/B/C/D)' :
      cfg.type === 'MULTIPLE_CHOICE' ? '提供4-5个选项' :
      cfg.type === 'TRUE_FALSE' ? '答案填true或false' :
      cfg.type === 'FILL_BLANK' ? '给出正确答案及填空位置' :
      cfg.type === 'SHORT_ANSWER' ? '给出参考答案要点' :
      cfg.type === 'CASE_STUDY' ? 'content写完整案例材料(150-400字真实工作情境)+作答要求，subQuestions提供2-4个小问，每问含content、answer(参考答案要点)、score(分值)' :
      cfg.type === 'ESSAY' ? '给出论文题目、写作要点(answer)、评分标准rubric与最低字数minAnswerWords' : '';

    // 3级难度映射到4级：易->EASY, 中->MEDIUM_EASY+MEDIUM_HARD(各半), 难->HARD
    const dEasy = cfg.difficultyEasy ?? 30;
    const dMedium = cfg.difficultyMedium ?? 50;
    const dHard = cfg.difficultyHard ?? 20;
    const dMediumHalf = Math.round(dMedium / 2);
    const difficultyNote = `难度分布（4级）：EASY ${dEasy}%、MEDIUM_EASY ${dMediumHalf}%、MEDIUM_HARD ${dMedium - dMediumHalf}%、HARD ${dHard}%`;
    const focusNote = cfg.focusKeywords ? `重点关注的考点/关键词：${cfg.focusKeywords}` : '';

    const url = (config.apiBaseUrl?.replace(/\/+$/, '') || 'https://api.deepseek.com') + '/chat/completions';

    const systemPrompt = `你是一名资深学科命题专家，擅长根据教材内容编制高质量考试试题。请生成符合中国考试标准的${typeLabel[cfg.type] || cfg.type}。

核心要求：
1. 严格基于教材内容出题，不要编造教材中没有的知识点
2. 题型：${typeLabel[cfg.type] || cfg.type}
3. ${typeInstructions}
4. 难度标注必须严格遵循以下标准：
${difficultyBlock}
5. 标注所属知识点(knowledgePoint)
6. 题目之间不要重复考查同一知识点，确保覆盖面广

答案规范（极其重要）：
- 选择题的 answer 字段必须填写正确选项的 label，如单选 "A"，多选 "A,B,C"
- 选择题的 options 中 isCorrect 必须与 answer 字段完全一致
- 单选题有且仅有1个正确选项，多选题有2-4个正确选项
- explanation 字段必须包含，需说明正确答案的依据，引用教材原文
- sourceChunk 必须是从教材中直接引用的20-50字原文

返回严格的JSON数组格式，不要有任何其他文字。每道题必须包含以下所有字段：
type, difficulty, knowledgePoint, sourceChunk, content, options(选择题必填), blanks(填空题必填), subQuestions(案例题必填), answer, explanation, suggestedGroup(默认"EXAM_GROUP")`;

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
    "subQuestions": [ { "content": "小问内容", "answer": "参考答案要点", "score": 10 } ],
    "answer": "参考答案",
    "explanation": "答案解析",
    "suggestedGroup": "EXAM_GROUP"
  }
]`;

    // B3: 包装重试机制（最多3次尝试）
    return withAiRetry(
      async (attempt) => {
        const temp = Math.min(config.temperature || 0.7, 0.3) - (attempt * 0.05);
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
            temperature: Math.max(0.1, temp),
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

        const validated = questions
          .filter((q: any) => q.content)
          .map((q: any) => {
            const { question, warnings, valid } = validateAndFixQuestion(q);
            if (warnings.length > 0) {
              console.warn(`[AI出题质量] 章节 "${cfg.chapter?.title || ''}" 题型 ${cfg.type}: ${warnings.join('; ')}`);
            }
            return { question: { ...question, type: cfg.type, difficulty: question.difficulty }, valid };
          });
        const invalidCount = validated.filter(v => !v.valid).length;
        if (invalidCount > 0) {
          console.warn(`[AI出题质量] 章节 "${cfg.chapter?.title || ''}" 丢弃 ${invalidCount} 道不合格题目`);
        }
        return validated.filter(v => v.valid).map(v => v.question);
      },
      (result) => result.length > 0, // 验证：至少有1题
      2,
    );
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
    const validTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY'];
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

  /**
   * Part 3.2: AI 辅助分章 — 当正则只解析出1章且内容>5000字时调用
   * 失败时静默回退到单章节
   */
  private async aiSplitChapters(text: string, materialName: string): Promise<Array<{ title: string; content: string }>> {
    try {
      const config = await this.prisma.aiConfig.findFirst({ where: { isActive: true } });
      if (!config) return [];

      const url = (config.apiBaseUrl?.replace(/\/+$/, '') || 'https://api.deepseek.com') + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.modelVersion,
          messages: [
            { role: 'system', content: '你是一名教材编辑专家。请分析以下教材文本，识别其中的章节结构。返回严格JSON数组格式：[{"title":"章节标题","startLine":行号}]。行号从0开始计数。如果无法识别章节，返回空数组[]。' },
            { role: 'user', content: `教材名称：${materialName}\n\n以下为教材文本（每行一个元素，行号标注）：\n${text.slice(0, 12000).split('\n').map((l, i) => `${i}: ${l}`).join('\n')}` },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) return [];
      const body: any = await response.json();
      const reply = body.choices?.[0]?.message?.content || '';
      const splits = parseAIJsonResponse(reply);

      if (!Array.isArray(splits) || splits.length < 2) return [];

      // 按 startLine 切分文本
      const lines = text.split('\n');
      const chapters: Array<{ title: string; content: string }> = [];
      const sorted = splits.sort((a: any, b: any) => (a.startLine || 0) - (b.startLine || 0));

      for (let i = 0; i < sorted.length; i++) {
        const start = Math.max(0, Math.min(sorted[i].startLine || 0, lines.length - 1));
        const end = i < sorted.length - 1
          ? Math.max(start + 1, Math.min(sorted[i + 1].startLine || lines.length, lines.length))
          : lines.length;
        const chapterContent = lines.slice(start, end).join('\n').trim();
        if (chapterContent.length > 20) {
          chapters.push({ title: sorted[i].title || `第${i + 1}章`, content: chapterContent });
        }
      }

      return chapters.length > 1 ? chapters : [];
    } catch (e: any) {
      console.warn(`[AI分章] 失败，回退到单章节: ${e.message}`);
      return [];
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
/**
 * B3: AI 调用重试包装器
 * 最多重试 maxRetries 次，重试条件：JSON解析失败、返回0题、API超时
 */
async function withAiRetry<T>(
  fn: (attempt: number) => Promise<T>,
  validate: (result: T) => boolean,
  maxRetries = 2,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      if (validate(result)) return result;
      lastError = new Error('AI 返回结果为空或无效');
    } catch (e: any) {
      lastError = e;
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000)); // 重试间隔2秒
    }
  }
  // 降级：重试耗尽 → 503 友好提示（不透传底层错误细节给用户，仅保留摘要）
  throw new AiUnavailableException(lastError?.message);
}

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
 * 逐题校验和修复（B2升级：从 warn 升级为自动修复）
 */
function validateAndFixQuestion(q: any): { question: any; warnings: string[]; valid: boolean } {
  const warnings: string[] = [];
  const fixed = { ...q };
  let valid = true;

  // 0. 硬拦截：content 为空或少于5字
  if (!fixed.content || String(fixed.content).trim().length < 5) {
    return { question: fixed, warnings: ['题目内容(content)为空或少于5字，丢弃'], valid: false };
  }

  // 1. 类型验证
  const VALID_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY', 'ESSAY'];
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

  // 3. 清洗options标签（提前到选择题校验之前）
  if (fixed.options && Array.isArray(fixed.options)) {
    fixed.options = fixed.options.map((o: any, i: number) => ({
      ...o,
      label: o.label || String.fromCharCode(65 + i),
      isCorrect: !!o.isCorrect,
    }));
  }

  // 4. 选择题：自动修复 answer 与 isCorrect 的一致性
  if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(fixed.type)) {
    if (!fixed.options || !Array.isArray(fixed.options) || fixed.options.length < 2) {
      warnings.push('选择题选项不足2个，丢弃');
      valid = false;
    } else {
      if (fixed.type === 'SINGLE_CHOICE') {
        let correctOpts = fixed.options.filter((o: any) => o.isCorrect);
        if (correctOpts.length === 0) {
          // 尝试从 answer 字段推断正确选项
          const ansLabel = String(fixed.answer || '').trim().toUpperCase();
          if (ansLabel && ansLabel.length === 1) {
            const target = fixed.options.find((o: any) => o.label === ansLabel);
            if (target) { target.isCorrect = true; correctOpts = [target]; }
          }
          if (correctOpts.length === 0) {
            warnings.push('单选题无正确选项且无法推断，丢弃');
            valid = false;
          }
        } else if (correctOpts.length > 1) {
          // 多个正确选项：只保留第一个
          warnings.push(`单选题有${correctOpts.length}个正确选项，仅保留第一个`);
          let kept = false;
          for (const o of fixed.options) {
            if (o.isCorrect && !kept) { kept = true; }
            else if (o.isCorrect && kept) { o.isCorrect = false; }
          }
          correctOpts = fixed.options.filter((o: any) => o.isCorrect);
        }
        // 强制同步 answer 字段（仅在有效时）
        if (valid && correctOpts.length > 0) {
          fixed.answer = correctOpts[0]?.label || 'A';
        }
      } else {
        // 多选题：从 isCorrect 生成 answer
        const correctLabels = fixed.options.filter((o: any) => o.isCorrect).map((o: any) => o.label);
        if (correctLabels.length < 2) {
          warnings.push(`多选题正确选项不足2个(当前${correctLabels.length}个)`);
        }
        if (correctLabels.length > 0) {
          fixed.answer = correctLabels.join(',');
        }
      }
    }
  }

  // 5. 判断题答案标准化
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

  // 6. 填空题：如果 blanks 为空但 answer 有值，自动生成 blanks
  if (fixed.type === 'FILL_BLANK') {
    if (!fixed.blanks || !Array.isArray(fixed.blanks) || fixed.blanks.length === 0) {
      if (fixed.answer && String(fixed.answer).trim()) {
        // 从 answer 解析生成 blanks（逗号/顿号分隔）
        const answers = String(fixed.answer).split(/[,，、/]/).map((s: string) => s.trim()).filter(Boolean);
        fixed.blanks = answers.map((ans: string, i: number) => ({ blankIndex: i, answer: ans }));
        warnings.push(`填空题缺少blanks，已从answer自动生成${fixed.blanks.length}个空`);
      } else {
        warnings.push('填空题缺少空白(blanks)和答案(answer)，丢弃');
        valid = false;
      }
    }
  }

  // 6b. 论文题：写作要点(answer)必填，rubric/minAnswerWords 规范化（2026-08-11）
  if (fixed.type === 'ESSAY') {
    if (!fixed.answer || !String(fixed.answer).trim()) {
      warnings.push('论文题缺少写作要点(answer)，丢弃');
      valid = false;
    }
    if (!Number.isInteger(fixed.minAnswerWords) || fixed.minAnswerWords <= 0) {
      fixed.minAnswerWords = 500;
    } else if (fixed.minAnswerWords > 5000) {
      fixed.minAnswerWords = 5000;
    }
    if (Array.isArray(fixed.rubric)) {
      fixed.rubric = fixed.rubric
        .filter((r: any) => r && String(r.description || '').trim() && Number(r.points) > 0)
        .slice(0, 10)
        .map((r: any) => ({ description: String(r.description).trim(), points: Number(r.points), type: r.type === 'deduct' ? 'deduct' : 'add' }));
      if (fixed.rubric.length === 0) fixed.rubric = null;
    } else {
      fixed.rubric = null;
    }
  }

  // 7. explanation 为空时标记质量缺陷（不设占位，由调用方决定是否入库）
  if (!fixed.explanation || !String(fixed.explanation).trim()) {
    fixed.explanation = null;
    fixed._qualityFlag = 'NO_EXPLANATION';
    warnings.push('缺少答案解析(explanation)，标记为低质量');
  }

  // 8. 知识点提示
  if (!fixed.knowledgePoint || !fixed.knowledgePoint.trim()) {
    warnings.push('缺少知识点(knowledgePoint)');
  }

  // 9. 原文引用提示
  if (!fixed.sourceChunk || !fixed.sourceChunk.trim()) {
    warnings.push('缺少原文引用(sourceChunk)');
  }

  return { question: fixed, warnings, valid };
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


// ═══════════════════════════════════════════════
// Part 3.3: PDF 提取文本预处理
// ═══════════════════════════════════════════════

/** 清洗 PDF 提取文本：去页眉页脚重复行 + 合并断行段落 */
function cleanPdfText(text: string): string {
  const lines = text.split('\n');

  // 1. 统计短行（<30字）出现频率，去除出现>3次的重复行（页眉页脚）
  const lineCount = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 30) {
      lineCount.set(trimmed, (lineCount.get(trimmed) || 0) + 1);
    }
  }
  const headerFooter = new Set<string>();
  for (const [line, count] of lineCount) {
    if (count > 3) headerFooter.add(line);
  }

  const filtered = lines.filter(l => !headerFooter.has(l.trim()));

  // 2. 合并被 PDF 换行打断的段落（行尾非标点且下行非标题 → 合并）
  const sectionPattern = /^(第[一二三四五六七八九十百千\d]+[章节篇]|[一二三四五六七八九十]+[、.．]|[（(][一二三四五六七八九十\d]+[)）]|\d+[.．]\d+|#+\s*|Chapter|Part|模块|项目|任务)/i;
  const endPunct = /[。！？；：.!?;:]$/;
  const merged: string[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i].trim();
    if (!line) continue;

    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      // 如果前一行不以标点结尾，且当前行不是标题行，则合并
      if (!endPunct.test(prev) && !sectionPattern.test(line) && line.length > 0) {
        merged[merged.length - 1] = prev + line;
        continue;
      }
    }
    merged.push(line);
  }

  return merged.join('\n');
}

// ═══════════════════════════════════════════════
// 程序级去重工具（Part 1: 系统级硬约束）
// ═══════════════════════════════════════════════

/** 标准化题目文本：去空格、标点归一化、转小写 */
function normalizeContent(text: string): string {
  return text
    .replace(/[\s　]+/g, '')       // 去所有空白（含全角）
    .replace(/[，。！？、；：''（）【】]/g, m => {
      const map: Record<string,string> = {'，':',','。':'.','！':'!','？':'?','、':',','；':';','：':':','“':'"','”':'"','‘':"'",'’':"'",'（':'(','）':')','【':'[','】':']'};
      return map[m] || m;
    })
    .toLowerCase();
}

/** 字符级 bigram 集合 */
function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

/** Jaccard 相似度（字符级 bigram） */
function jaccardSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const setA = bigrams(a);
  const setB = bigrams(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 判断题目是否与已见列表重复（相似度 > 0.9） */
function isDuplicateQuestion(normalized: string, seenList: string[]): boolean {
  for (const seen of seenList) {
    if (jaccardSimilarity(normalized, seen) > 0.9) return true;
  }
  return false;
}

