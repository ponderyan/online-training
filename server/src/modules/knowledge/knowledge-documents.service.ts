import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChunkAiService } from './chunk-ai.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class KnowledgeDocumentsService {
  private readonly logger = new Logger(KnowledgeDocumentsService.name);
  private uploadDir = path.resolve('uploads/knowledge');

  constructor(private prisma: PrismaService, private chunkAi: ChunkAiService) {
    fs.mkdir(this.uploadDir, { recursive: true }).catch(() => {});
  }

  // ─── 文档上传 ───

  async upload(file: Express.Multer.File, body: { subjectId: string; name?: string; createdBy: string }) {
    if (!file) throw new BadRequestException('请上传文件');
    const subjectId = parseInt(body.subjectId);
    if (!subjectId) throw new BadRequestException('请选择关联科目');

    // 修复文件名编码
    const fixEncoding = (s: string) => {
      try {
        const buf = Buffer.from(s, 'latin1');
        const utf = buf.toString('utf8');
        if (/[一-鿿]/.test(utf)) return utf;
      } catch {}
      return s;
    };

    const originalName = fixEncoding(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const allowedExts = ['.pdf', '.txt', '.md', '.docx'];
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException('仅支持 PDF / TXT / MD / DOCX 格式');
    }

    const fileType = ext.replace('.', '');
    const savedName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, savedName);
    await fs.writeFile(filePath, file.buffer);

    const docName = body.name || originalName.replace(/\.(pdf|txt|md|docx)$/i, '');

    // 检查是否有同名文档（版本管理）
    const existing = await this.prisma.knowledgeDocument.findFirst({
      where: { subjectId, name: docName },
      orderBy: { version: 'desc' },
    });

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        name: docName,
        fileName: originalName,
        filePath: savedName,
        fileType,
        fileSize: file.size,
        subjectId,
        status: 'PROCESSING',
        version: existing ? existing.version + 1 : 1,
        previousVersionId: existing?.id || null,
        createdBy: parseInt(body.createdBy),
      },
    });

    // 异步处理：解析文本 → 分块
    this.processDocument(doc.id, filePath, fileType).catch((e: any) => {
      this.logger.error(`[知识库] 文档 #${doc.id} 处理失败: ${e.message}`);
    });

    return { id: doc.id, name: doc.name, status: 'PROCESSING', version: doc.version };
  }

  // ─── 文档处理管道 ───

  private async processDocument(docId: number, filePath: string, fileType: string) {
    try {
      let text = '';
      if (fileType === 'txt' || fileType === 'md') {
        text = await fs.readFile(filePath, 'utf-8');
      } else if (fileType === 'pdf') {
        text = await this.extractPdfText(filePath);
      } else if (fileType === 'docx') {
        text = await this.extractDocxText(filePath);
      }

      if (!text || text.trim().length < 20) {
        await this.prisma.knowledgeDocument.update({
          where: { id: docId },
          data: { status: 'FAILED' },
        });
        return;
      }

      const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
      if (!doc) return;

      // 删除旧版本的分块（如果是新版本）
      if (doc.previousVersionId) {
        await this.prisma.knowledgeChunk.deleteMany({
          where: { documentId: doc.previousVersionId },
        });
      }

      // 分块
      const chunks = this.splitText(text);
      if (chunks.length > 0) {
        await this.prisma.knowledgeChunk.createMany({
          data: chunks.map((content, idx) => ({
            subjectId: doc.subjectId,
            documentId: doc.id,
            title: doc.name,
            content,
            chunkIndex: idx,
            source: doc.fileName,
            tokenCount: Math.ceil(content.length / 1.5),
          })),
        });
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: docId },
        data: { status: 'READY', chunkCount: chunks.length },
      });

      this.logger.log(`[知识库] 文档「${doc.name}」处理完成，生成 ${chunks.length} 个知识块`);

      // P1-1: 异步触发 AI 自动标注知识点
      if (chunks.length > 0) {
        this.chunkAi.autoLabelChunks(doc.id).catch((e: any) => {
          this.logger.warn(`[知识库] 文档 #${doc.id} AI标注失败: ${e.message}`);
        });
      }
    } catch (e: any) {
      await this.prisma.knowledgeDocument.update({
        where: { id: docId },
        data: { status: 'FAILED' },
      }).catch(() => {});
      throw e;
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    try {
      const { PDFParse } = await import('pdf-parse');
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text || '';
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch {
      return '';
    }
  }

  private async extractDocxText(filePath: string): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch {
      return '';
    }
  }

  // ─── 分块算法 ───

  private splitText(text: string, chunkSize = 500, overlap = 50): string[] {
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (cleaned.length <= chunkSize) return [cleaned];

    const chunks: string[] = [];
    const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);

    let current = '';
    for (const para of paragraphs) {
      const paraText = para.trim();
      if (paraText.length > chunkSize) {
        if (current.length > 0) { chunks.push(current.trim()); current = ''; }
        const sentences = paraText.split(/(?<=[。！？；\n])/).filter(p => p.length > 0);
        for (const sent of sentences) {
          if (current.length + sent.length > chunkSize && current.length > 0) {
            chunks.push(current.trim());
            current = current.slice(-overlap) + sent;
          } else {
            current += sent;
          }
        }
      } else {
        if (current.length + paraText.length + 2 > chunkSize && current.length > 0) {
          chunks.push(current.trim());
          current = current.slice(-overlap) + '\n\n' + paraText;
        } else {
          current += (current ? '\n\n' : '') + paraText;
        }
      }
    }
    if (current.trim().length > 0) chunks.push(current.trim());
    return chunks.filter(c => c.length >= 20);
  }

  // ─── 文档列表 ───

  async listDocuments(params: { page?: number; pageSize?: number; search?: string; subjectId?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.search) where.name = { contains: params.search };
    if (params.subjectId) where.subjectId = params.subjectId;

    const [items, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getDocument(id: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { subject: { select: { id: true, name: true } } },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    return doc;
  }

  async deleteDocument(id: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');

    // 删除关联分块（cascade）+ 文件
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    await fs.unlink(path.join(this.uploadDir, doc.filePath)).catch(() => {});
    return { deleted: true };
  }

  // ─── 分块管理 ───

  async getChunks(documentId: number, params: { page?: number; pageSize?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const [items, total] = await Promise.all([
      this.prisma.knowledgeChunk.findMany({
        where: { documentId },
        include: {
          knowledgePoints: {
            include: { knowledgePoint: { select: { id: true, name: true } } },
          },
        },
        orderBy: { chunkIndex: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeChunk.count({ where: { documentId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateChunk(chunkId: number, data: { content?: string; title?: string }) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) throw new NotFoundException('知识块不存在');

    const updateData: any = {};
    if (data.content !== undefined) {
      updateData.content = data.content;
      updateData.tokenCount = Math.ceil(data.content.length / 1.5);
    }
    if (data.title !== undefined) updateData.title = data.title;

    return this.prisma.knowledgeChunk.update({ where: { id: chunkId }, data: updateData });
  }

  async mergeChunks(chunkId: number) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) throw new NotFoundException('知识块不存在');

    // 找下一个块
    const next = await this.prisma.knowledgeChunk.findFirst({
      where: { documentId: chunk.documentId, chunkIndex: chunk.chunkIndex + 1 },
    });
    if (!next) throw new BadRequestException('没有可合并的下一个块');

    const mergedContent = chunk.content + '\n\n' + next.content;
    await this.prisma.knowledgeChunk.update({
      where: { id: chunk.id },
      data: { content: mergedContent, tokenCount: Math.ceil(mergedContent.length / 1.5) },
    });
    await this.prisma.knowledgeChunk.delete({ where: { id: next.id } });

    // 重建索引
    await this.reindexChunks(chunk.documentId!);
    return { merged: true, newLength: mergedContent.length };
  }

  async splitChunk(chunkId: number, data: { position: number }) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) throw new NotFoundException('知识块不存在');
    if (data.position <= 0 || data.position >= chunk.content.length) {
      throw new BadRequestException('拆分位置无效');
    }

    const part1 = chunk.content.slice(0, data.position).trim();
    const part2 = chunk.content.slice(data.position).trim();

    await this.prisma.knowledgeChunk.update({
      where: { id: chunk.id },
      data: { content: part1, tokenCount: Math.ceil(part1.length / 1.5) },
    });

    await this.prisma.knowledgeChunk.create({
      data: {
        subjectId: chunk.subjectId,
        documentId: chunk.documentId,
        title: chunk.title,
        content: part2,
        chunkIndex: chunk.chunkIndex + 1,
        source: chunk.source,
        tokenCount: Math.ceil(part2.length / 1.5),
      },
    });

    await this.reindexChunks(chunk.documentId!);
    return { split: true };
  }

  async deleteChunk(chunkId: number) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) throw new NotFoundException('知识块不存在');

    await this.prisma.knowledgeChunk.delete({ where: { id: chunkId } });
    if (chunk.documentId) {
      await this.reindexChunks(chunk.documentId);
      await this.prisma.knowledgeDocument.update({
        where: { id: chunk.documentId },
        data: { chunkCount: { decrement: 1 } },
      }).catch(() => {});
    }
    return { deleted: true };
  }

  async rebuildChunks(documentId: number, params?: { chunkSize?: number; overlap?: number }) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('文档不存在');

    const filePath = path.join(this.uploadDir, doc.filePath);
    let text = '';
    try {
      if (doc.fileType === 'txt' || doc.fileType === 'md') {
        text = await fs.readFile(filePath, 'utf-8');
      } else if (doc.fileType === 'pdf') {
        text = await this.extractPdfText(filePath);
      } else if (doc.fileType === 'docx') {
        text = await this.extractDocxText(filePath);
      }
    } catch {
      throw new BadRequestException('无法读取文档文件');
    }

    if (!text || text.trim().length < 20) throw new BadRequestException('文档内容为空');

    // 删除旧块
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });

    const chunkSize = params?.chunkSize || 500;
    const overlap = params?.overlap || 50;
    const chunks = this.splitText(text, chunkSize, overlap);

    if (chunks.length > 0) {
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((content, idx) => ({
          subjectId: doc.subjectId,
          documentId: doc.id,
          title: doc.name,
          content,
          chunkIndex: idx,
          source: doc.fileName,
          tokenCount: Math.ceil(content.length / 1.5),
        })),
      });
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { chunkCount: chunks.length, status: 'READY' },
    });

    return { chunks: chunks.length };
  }

  private async reindexChunks(documentId: number) {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    for (let i = 0; i < chunks.length; i++) {
      await this.prisma.knowledgeChunk.update({
        where: { id: chunks[i].id },
        data: { chunkIndex: i },
      });
    }
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { chunkCount: chunks.length },
    }).catch(() => {});
  }

  // ─── 知识块 ↔ 知识点关联 ───

  async setChunkKnowledgePoints(chunkId: number, knowledgePointIds: number[]) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) throw new NotFoundException('知识块不存在');

    // 删除旧的手动关联
    await this.prisma.chunkKnowledgePoint.deleteMany({
      where: { chunkId, source: 'MANUAL' },
    });

    // 创建新关联
    if (knowledgePointIds.length > 0) {
      await this.prisma.chunkKnowledgePoint.createMany({
        data: knowledgePointIds.map(kpId => ({
          chunkId,
          knowledgePointId: kpId,
          confidence: 1.0,
          source: 'MANUAL',
        })),
        skipDuplicates: true,
      });
    }

    return this.prisma.chunkKnowledgePoint.findMany({
      where: { chunkId },
      include: { knowledgePoint: { select: { id: true, name: true } } },
    });
  }

  // ─── 检索测试 ───

  async testQuery(query: string, subjectId?: number, limit = 10) {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return { results: [], keywords: [] };

    const conditions = keywords.map(k => `kc.content LIKE '%${k.replace(/'/g, "''")}%'`);
    const subjectFilter = subjectId ? `AND kc.subject_id = ${subjectId}` : '';

    const sql = `
      SELECT kc.id, kc.content, kc.source, kc.title, kc.chunk_index, kc.document_id,
             kd.name as document_name,
             (LENGTH(kc.content) - LENGTH(REPLACE(kc.content, '${keywords[0]?.replace(/'/g, "''") || ''}', ''))) as relevance
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kc.document_id = kd.id
      WHERE (${conditions.join(' OR ')}) ${subjectFilter}
      ORDER BY relevance DESC, LENGTH(kc.content) ASC
      LIMIT ${limit};
    `;

    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      const results = rows.map(r => ({
        id: r.id,
        content: r.content,
        title: r.title,
        source: r.source,
        chunkIndex: r.chunk_index,
        documentId: r.document_id,
        documentName: r.document_name || r.title,
        matchedKeywords: keywords.filter(k => (r.content || '').includes(k)),
      }));
      return { results, keywords };
    } catch {
      return { results: [], keywords };
    }
  }

  private extractKeywords(question: string): string[] {
    const STOPWORDS = ['什么','怎么','如何','为什么','哪些','哪个','怎样','几时','多少','为何','是否','可否',
      '是','的','了','在','有','和','与','或','就','不','都','一','上','也','很','到','要','去',
      '会','着','没有','看','好','自己','这','那','她','它','们','吗','呢','吧','啊','哦','嗯',
      '请问','请教','帮忙','帮','我','你','他','能','可以','应该','需要','一下','这个','那个'];
    let cleaned = question;
    for (const sw of STOPWORDS) {
      cleaned = cleaned.replace(new RegExp(sw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    }
    let keywords: string[] = cleaned
      .replace(/[，。！？、；：""''（）【】《》\s,;:!?.'"()【】《》\t\n\r]+/g, ' ')
      .split(/\s+/)
      .filter(k => k.length >= 2);

    const bigrams = new Set<string>();
    for (const word of keywords) {
      if (/^[\u4e00-\u9fff]+$/.test(word) && word.length >= 4) {
        for (let i = 0; i <= word.length - 2; i++) {
          bigrams.add(word.substring(i, i + 2));
        }
      }
    }
    keywords = [...new Set([...keywords, ...bigrams])];
    return keywords.slice(0, 15);
  }
}
