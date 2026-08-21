import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalService } from './agent/retrieval.service.js';

/**
 * 知识块自动分块服务
 * 将 MaterialChapter 的长文本切分为适合 RAG 检索的小块（~500字，重叠50字）
 */
@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly CHUNK_SIZE = 500;   // 每块目标字符数
  private readonly OVERLAP = 50;       // 块间重叠字符数

  constructor(private prisma: PrismaService, private retrieval: RetrievalService) {}

  /**
   * 为指定教材重建知识块
   * 删除旧块 → 读取所有章节 → 分块 → 批量写入
   */
  async rebuildForMaterial(materialId: number): Promise<{ chunks: number }> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: { chapters: { where: { status: 'GENERATED' }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!material) return { chunks: 0 };

    // 清除旧块：优先按 materialId 精确删除；历史行（无关联）回退按 source 匹配文件名
    // ★ 2026-08-20 链路补洞：原仅按 source contains fileName 删除，同名文件跨教材会误删他教材块
    await this.prisma.knowledgeChunk.deleteMany({
      where: {
        OR: [
          { materialId },
          { materialId: null, source: { contains: material.fileName } },
        ],
      },
    }).catch(() => {});

    let totalChunks = 0;

    for (const chapter of material.chapters) {
      if (!chapter.content || chapter.content.length < 20) continue;

      const chunks = this.splitText(chapter.content);
      if (chunks.length === 0) continue;

      // 批量创建（★ 2026-08-20：补填 materialId/materialChapterId，检索来源可反查）
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((text, idx) => ({
          subjectId: material.subjectId,
          chapterId: null, // MaterialChapter ≠ Chapter，留空
          materialId: material.id,
          materialChapterId: chapter.id,
          title: `${material.name} - ${chapter.title}`.slice(0, 490), // ★ 2026-08-22：title 列 varchar(500)，超长触发 P2000 导致整个知识块批量创建失败
          content: text,
          chunkIndex: idx,
          source: material.fileName,
          tokenCount: Math.ceil(text.length / 1.5), // 粗估 token 数
        })),
      });
      totalChunks += chunks.length;
    }

    this.logger.log(`[分块] 教材「${material.name}」生成 ${totalChunks} 个知识块`);
    // ★ 2026-08-20 链路补洞：通知检索服务清空旧索引，新块下次查询自动补算向量
    this.retrieval.notifyChunksChanged();
    return { chunks: totalChunks };
  }

  /**
   * 重建所有未归档教材的知识块
   */
  async rebuildAll(): Promise<{ materials: number; chunks: number }> {
    const materials = await this.prisma.material.findMany({
      where: { archivedAt: null },
      select: { id: true },
    });

    let totalChunks = 0;
    for (const m of materials) {
      const result = await this.rebuildForMaterial(m.id);
      totalChunks += result.chunks;
    }

    this.logger.log(`[分块] 全量重建完成：${materials.length} 本教材，${totalChunks} 个知识块`);
    return { materials: materials.length, chunks: totalChunks };
  }

  /**
   * 文本分块算法：按段落优先切分，超长段落按句号/换行二次切分
   * 保持语义完整性，块间有重叠防止断裂
   */
  private splitText(text: string): string[] {
    // 清理多余空白（CR 统一剔除，连续 3+ 个 LF 折叠为双 LF）
    const NL = String.fromCharCode(10);
    const cleaned = text.split(String.fromCharCode(13)).join('').replace(new RegExp(NL + '{3,}', 'g'), NL + NL).trim();
    if (cleaned.length <= this.CHUNK_SIZE) return [cleaned];

    const chunks: string[] = [];
    // 先按段落（双换行）分割
    const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);

    let current = '';
    for (const para of paragraphs) {
      const paraText = para.trim();

      // 如果单个段落就超长，需要二次切分
      if (paraText.length > this.CHUNK_SIZE) {
        // 先把当前缓冲区存下来
        if (current.length > 0) {
          chunks.push(current.trim());
          current = '';
        }
        // 按句子切分长段落
        const sentences = this.splitBySentences(paraText);
        for (const sent of sentences) {
          if (current.length + sent.length > this.CHUNK_SIZE && current.length > 0) {
            chunks.push(current.trim());
            // 重叠：保留尾部
            current = current.slice(-this.OVERLAP) + sent;
          } else {
            current += sent;
          }
        }
      } else {
        // 段落不超长，尝试合并
        if (current.length + paraText.length + 2 > this.CHUNK_SIZE && current.length > 0) {
          chunks.push(current.trim());
          // 重叠
          current = current.slice(-this.OVERLAP) + '\n\n' + paraText;
        } else {
          current += (current ? '\n\n' : '') + paraText;
        }
      }
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks.filter(c => c.length >= 20); // 过滤太短的块
  }

  /** 按中文句号、问号、感叹号、分号切分句子 */
  private splitBySentences(text: string): string[] {
    const parts = text.split(/(?<=[。！？；\n])/);
    return parts.filter(p => p.length > 0);
  }
}
