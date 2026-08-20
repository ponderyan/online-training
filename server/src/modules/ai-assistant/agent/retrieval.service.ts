import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmbeddingService } from './embedding.service.js';
import { SourceInfo } from './types.js';
import { cosineSimilarity, rrfMerge } from './math.js';

/**
 * 教材检索服务（混合检索：语义 + 关键词，RRF 融合）
 * 检索地基：本地嵌入（bge-small-zh）+ MySQL JSON 列存向量 + 内存余弦暴力检索
 * 优雅降级：嵌入不可用 / 空库 → 纯关键词，行为与旧版一致
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  /** 内存向量索引：chunkId → 归一化向量 */
  private index: Map<number, Float32Array> | null = null;
  private backfilling: Promise<void> | null = null;

  constructor(
    private prisma: PrismaService,
    private embedding: EmbeddingService,
  ) {}

  /** 混合检索入口（agent 的 search_knowledge 工具） */
  async hybridSearch(query: string, limit = 6): Promise<SourceInfo[]> {
    const [semantic, keyword] = await Promise.all([
      this.semanticSearch(query, limit * 2).catch((e) => {
        this.logger.warn(`语义检索失败：${(e as Error)?.message}`);
        return [] as SourceInfo[];
      }),
      this.keywordSearch(query, limit * 2),
    ]);
    return rrfMerge(semantic, keyword, limit);
  }

  /** 语义检索（本地向量余弦） */
  async semanticSearch(query: string, limit = 6): Promise<SourceInfo[]> {
    const index = await this.ensureIndexed();
    if (index.size === 0) return [];

    const q = await this.embedding.embed(query);
    const scored: { score: number; id: number }[] = [];
    for (const [id, vec] of index) {
      scored.push({ id, score: cosineSimilarity(q, vec) });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit).map((s) => s.id);

    if (top.length === 0) return [];
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { id: { in: top } },
      select: {
        id: true, content: true, title: true, source: true,
        document: { select: { name: true } },
        // ★ 2026-08-20 链路补洞：来源优先取关联字段，title split 仅作旧数据兑底
        material: { select: { name: true } },
        materialChapter: { select: { title: true } },
      },
    });
    const byId = new Map(chunks.map((c) => [c.id, c]));
    return scored
      .slice(0, limit)
      .map((s) => byId.get(s.id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        materialName: c.material?.name || c.document?.name || c.title?.split(' - ')[0] || '',
        chapterTitle: c.materialChapter?.title || c.title?.split(' - ')[1] || c.title || '',
        content: (c.content || '').slice(0, 300),
        source: c.source || c.document?.name || '教材',
        type: 'chunk' as const,
      }));
  }

  /** 关键词检索（FULLTEXT ngram 优先，LIKE 降级；与旧版一致） */
  async keywordSearch(query: string, limit = 6): Promise<SourceInfo[]> {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    const [chunkResults, chapterResults] = await Promise.all([
      this.searchChunks(keywords, limit),
      this.searchChapters(keywords, Math.max(2, Math.ceil(limit / 2))),
    ]);
    return [...chunkResults, ...chapterResults];
  }

  /** 供 legacy ask() 使用的完整上下文（保留旧契约） */
  async buildContext(question: string): Promise<{ context: string; sources: SourceInfo[] }> {
    const sources = await this.hybridSearch(question, 9);
    const context = sources
      .map((s, i) => `【来源 ${i + 1}】${s.materialName ? `《${s.materialName}》` : ''}${s.chapterTitle ? ` - ${s.chapterTitle}` : ''}\n${s.content}`)
      .join('\n\n');
    return { context, sources };
  }

  /** 重建嵌入索引（管理员手动触发）：后台全量补算 */
  async rebuildEmbeddings() {
    await this.ensureIndexed();
    await this.backfillEmbeddings(true);
    this.index = null; // 强制下次查询重建
    await this.ensureIndexed();
    return { status: 'ok' };
  }

  /**
   * chunk 数据变更后刷新内存索引（★ 2026-08-20 链路补洞）
   * 背景：ensureIndexed 有缓存短路，chunk 重建后旧索引不清空则新块永不补算向量。
   * 由 ChunkingService 重建完成后调用：清空索引 → 下次查询重新加载并后台补算缺失向量。
   */
  notifyChunksChanged(): void {
    this.index = null;
    this.ensureIndexed().catch((e) => this.logger.warn(`chunk 变更后索引重建失败：${(e as Error)?.message}`));
  }

  /** 索引状态（health 用） */
  async status() {
    const total = await this.prisma.knowledgeChunk.count();
    const indexed = await this.prisma.knowledgeChunk.count({ where: { embedding: { not: Prisma.DbNull } } });
    return { total, indexed, embeddingAvailable: this.embedding.available, indexedRatio: total ? (indexed / total) : 1 };
  }

  // ── 私有 ──

  /** 确保内存索引就绪；缺向量的 chunk 后台补算（不阻塞查询） */
  private async ensureIndexed(): Promise<Map<number, Float32Array>> {
    if (this.index) return this.index;
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { embedding: { not: Prisma.DbNull } },
      select: { id: true, embedding: true },
    });
    this.index = new Map();
    for (const c of chunks) {
      const vec = this.toVector(c.embedding);
      if (vec) this.index.set(c.id, vec);
    }
    this.logger.log(`向量索引加载完成：${this.index.size} 条`);
    // 缺向量的 chunk 后台补算
    this.backfillEmbeddings(false).catch((e) => this.logger.warn(`后台补算嵌入失败：${(e as Error)?.message}`));
    return this.index;
  }

  /** 全量/增量补算缺失的嵌入向量（并发安全） */
  private backfillEmbeddings(force: boolean): Promise<void> {
    if (this.backfilling) return this.backfilling;
    this.backfilling = this.doBackfill(force).finally(() => {
      this.backfilling = null;
    });
    return this.backfilling;
  }

  private async doBackfill(force: boolean): Promise<void> {
    const where = force ? {} : { embedding: { equals: Prisma.DbNull } };
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where,
      select: { id: true, content: true },
    });
    if (chunks.length === 0) return;
    this.logger.log(`开始补算嵌入：${chunks.length} 条（force=${force}）`);

    const BATCH = 8;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const vectors = await this.embedding.embedBatch(batch.map((c) => c.content));
      for (let j = 0; j < batch.length; j++) {
        const vec = vectors[j];
        if (!vec) continue;
        await this.prisma.knowledgeChunk.update({
          where: { id: batch[j].id },
          data: { embedding: Array.from(vec) },
        });
        if (this.index) this.index.set(batch[j].id, vec);
      }
      if ((i / BATCH) % 10 === 0) this.logger.log(`补算进度：${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
    }
    this.logger.log(`嵌入补算完成：${chunks.length} 条`);
  }

  private toVector(v: unknown): Float32Array | null {
    if (!v || !Array.isArray(v)) return null;
    return Float32Array.from(v as number[]);
  }

  /** 关键词提取（中文优化：去停用词 + bigram）—— 与旧版逻辑一致 */
  private extractKeywords(question: string): string[] {
    const STOPWORDS = ['什么', '怎么', '如何', '为什么', '哪些', '哪个', '怎样', '几时', '多少', '为何', '是否', '可否',
      '是', '的', '了', '在', '有', '和', '与', '或', '就', '不', '都', '一', '上', '也', '很', '到', '要', '去',
      '会', '着', '没有', '看', '好', '自己', '这', '那', '她', '它', '们', '吗', '呢', '吧', '啊', '哦', '嗯',
      '请问', '请教', '帮忙', '帮', '我', '你', '他', '能', '可以', '应该', '需要', '一下', '这个', '那个'];
    let cleaned = question;
    for (const sw of STOPWORDS) {
      cleaned = cleaned.replace(new RegExp(sw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    }
    let keywords = cleaned
      .replace(/[，。！？、；：""''（）【】《》\s,;:!?.'"()【】《》\t\n\r]+/g, ' ')
      .split(/\s+/)
      .filter((k) => k.length >= 2);

    const bigrams = new Set<string>();
    for (const word of keywords) {
      if (/^[一-鿿]+$/.test(word) && word.length >= 4) {
        for (let i = 0; i <= word.length - 2; i++) {
          bigrams.add(word.substring(i, i + 2));
        }
      }
    }
    keywords = [...new Set([...keywords, ...bigrams])];
    return keywords.slice(0, 15);
  }

  private async searchChunks(keywords: string[], limit: number): Promise<SourceInfo[]> {
    const ftQuery = keywords.join(' ');
    const conditions = keywords.map((k) => `kc.content LIKE '%${k.replace(/'/g, "''")}%'`);
    const sql = `
      SELECT kc.id, kc.content, kc.source, kc.title,
             kd.name as document_name,
             mt.name as material_name_rel,
             mch.title as chapter_title_rel,
             MATCH(kc.content) AGAINST('${ftQuery.replace(/'/g, "''")}' IN BOOLEAN MODE) as relevance
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kc.document_id = kd.id
      LEFT JOIN materials mt ON kc.material_id = mt.id
      LEFT JOIN material_chapters mch ON kc.material_chapter_id = mch.id
      WHERE MATCH(kc.content) AGAINST('${ftQuery.replace(/'/g, "''")}' IN BOOLEAN MODE)
      ORDER BY relevance DESC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      if (rows.length > 0) {
        return rows.map((r) => ({
          materialName: r.material_name_rel || r.document_name || r.title?.split(' - ')[0] || '',
          chapterTitle: r.chapter_title_rel || r.title?.split(' - ')[1] || r.title || '',
          content: (r.content || '').slice(0, 300),
          source: r.source || r.document_name || '教材',
          type: 'chunk' as const,
        }));
      }
    } catch {}
    const fallbackSql = `
      SELECT kc.id, kc.content, kc.source, kc.title,
             kd.name as document_name,
             mt.name as material_name_rel,
             mch.title as chapter_title_rel
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kc.document_id = kd.id
      LEFT JOIN materials mt ON kc.material_id = mt.id
      LEFT JOIN material_chapters mch ON kc.material_chapter_id = mch.id
      WHERE ${conditions.map((c) => c.replace('kc.', 'kc.')).join(' OR ')}
      ORDER BY LENGTH(kc.content) ASC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(fallbackSql);
      return rows.map((r) => ({
        materialName: r.material_name_rel || r.document_name || r.title?.split(' - ')[0] || '',
        chapterTitle: r.chapter_title_rel || r.title?.split(' - ')[1] || r.title || '',
        content: (r.content || '').slice(0, 300),
        source: r.source || r.document_name || '教材',
        type: 'chunk' as const,
      }));
    } catch {
      return [];
    }
  }

  private async searchChapters(keywords: string[], limit: number): Promise<SourceInfo[]> {
    const conditions = keywords.map((k) => `mc.content LIKE '%${k.replace(/'/g, "''")}%'`);
    const sql = `
      SELECT mc.id, mc.content, mc.title as chapter_title, m.name as material_name
      FROM material_chapters mc
      JOIN materials m ON mc.material_id = m.id
      WHERE mc.status = 'GENERATED' AND m.archived_at IS NULL AND (${conditions.join(' OR ')})
      ORDER BY LENGTH(mc.content) ASC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      return rows.map((r) => ({
        materialName: r.material_name || '',
        chapterTitle: r.chapter_title || '',
        content: (r.content || '').slice(0, 300),
        source: r.material_name || '教材',
        type: 'chapter' as const,
      }));
    } catch {
      return [];
    }
  }
}
