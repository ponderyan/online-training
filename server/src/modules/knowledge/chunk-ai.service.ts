import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * AI 知识块标注服务
 * - P1-1: 自动为知识块标注知识点
 * - P1-2: 从知识块出题
 * - P2-4: 生成 Q&A 对
 */
@Injectable()
export class ChunkAiService {
  private readonly logger = new Logger(ChunkAiService.name);

  constructor(private prisma: PrismaService) {}

  // ─── P1-1: AI 自动标注知识点 ───

  async autoLabelChunks(documentId: number): Promise<{ labeled: number }> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { subject: true },
    });
    if (!doc) return { labeled: 0 };

    const config = await this.getActiveConfig();
    if (!config) {
      this.logger.warn('[AI标注] 无可用 AI 配置，跳过自动标注');
      return { labeled: 0 };
    }

    // 获取该科目下所有知识点
    const knowledgePoints = await this.prisma.knowledgePoint.findMany({
      where: { subjectId: doc.subjectId, isActive: true },
      select: { id: true, name: true },
    });
    if (knowledgePoints.length === 0) {
      this.logger.log('[AI标注] 该科目无知识点，跳过');
      return { labeled: 0 };
    }

    const kpList = knowledgePoints.map(kp => `${kp.id}. ${kp.name}`).join('\n');
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });

    let labeled = 0;
    // 每次处理 5 个块（避免 token 超限）
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const chunkTexts = batch.map((c, idx) => `【块${idx + 1}】(ID:${c.id})\n${c.content.slice(0, 400)}`).join('\n\n');

      const prompt = `以下是教材内容片段和该科目的知识点列表。请识别每个内容片段涉及了哪些知识点。

【知识点列表】
${kpList}

【内容片段】
${chunkTexts}

请以 JSON 格式返回，格式为：
[{"chunkId": 块ID, "knowledgePointIds": [匹配的知识点ID列表], "confidence": 0.0到1.0的置信度}]

只返回 JSON，不要其他文字。如果某个块没有明确对应知识点，可以不返回该块。`;

      try {
        const result = await this.callLLM(config, prompt);
        const parsed = this.parseJsonResponse(result);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item.chunkId || !Array.isArray(item.knowledgePointIds)) continue;
            const chunkExists = batch.find(c => c.id === item.chunkId);
            if (!chunkExists) continue;

            for (const kpId of item.knowledgePointIds) {
              const kpExists = knowledgePoints.find(kp => kp.id === kpId);
              if (!kpExists) continue;
              await this.prisma.chunkKnowledgePoint.upsert({
                where: { chunkId_knowledgePointId: { chunkId: item.chunkId, knowledgePointId: kpId } },
                create: {
                  chunkId: item.chunkId,
                  knowledgePointId: kpId,
                  confidence: Math.min(1, Math.max(0, item.confidence || 0.7)),
                  source: 'AI',
                },
                update: {
                  confidence: Math.min(1, Math.max(0, item.confidence || 0.7)),
                  source: 'AI',
                },
              });
            }
            labeled++;
          }
        }
      } catch (e: any) {
        this.logger.warn(`[AI标注] 批次 ${i / batchSize + 1} 失败: ${e.message}`);
      }
    }

    this.logger.log(`[AI标注] 文档「${doc.name}」标注完成，${labeled} 个块被标注`);
    return { labeled };
  }

  // ─── P1-2: 从知识块出题 ───

  async generateQuestionsFromChunk(chunkId: number, options: {
    questionType?: string;
    count?: number;
    knowledgePointIds?: number[];
  }): Promise<{ questions: any[] }> {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) return { questions: [] };

    const config = await this.getActiveConfig();
    if (!config) return { questions: [] };

    const count = options.count || 3;
    const type = options.questionType || '单选题';

    const prompt = `基于以下教材内容，出 ${count} 道${type}。

【教材内容】
${chunk.content}

要求：
1. 题目紧扣教材内容，考查核心知识点
2. 难度适中，适合培训考核
3. 请以 JSON 数组格式返回，每道题包含：
   - content: 题目内容
   - options: 选项数组（单选/多选题需要，格式 [{"label":"A","content":"...","isCorrect":true/false}]）
   - answer: 答案（填空题用）
   - analysis: 解析
4. 只返回 JSON 数组，不要其他文字`;

    try {
      const result = await this.callLLM(config, prompt);
      const parsed = this.parseJsonResponse(result);
      if (Array.isArray(parsed)) {
        return { questions: parsed.slice(0, count) };
      }
    } catch (e: any) {
      this.logger.warn(`[AI出题] 块 #${chunkId} 出题失败: ${e.message}`);
    }
    return { questions: [] };
  }

  // ─── P2-4: 生成 Q&A 对 ───

  async generateQaPairs(chunkId: number): Promise<{ pairs: number }> {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) return { pairs: 0 };

    const config = await this.getActiveConfig();
    if (!config) return { pairs: 0 };

    const prompt = `基于以下教材内容，生成 3 个学员可能会问的问题及对应答案。
这些问题将用于提升检索命中率（学员的问法通常与教材原文不同）。

【教材内容】
${chunk.content.slice(0, 600)}

请以 JSON 数组格式返回：[{"q": "问题", "a": "简短答案"}]
只返回 JSON，不要其他文字。`;

    try {
      const result = await this.callLLM(config, prompt);
      const parsed = this.parseJsonResponse(result);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await this.prisma.knowledgeChunk.update({
          where: { id: chunkId },
          data: { qaPairs: parsed },
        });
        return { pairs: parsed.length };
      }
    } catch (e: any) {
      this.logger.warn(`[Q&A生成] 块 #${chunkId} 失败: ${e.message}`);
    }
    return { pairs: 0 };
  }

  async generateQaPairsForDocument(documentId: number): Promise<{ total: number }> {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId, qaPairs: { equals: null } as any },
      select: { id: true },
    });

    let total = 0;
    for (const chunk of chunks) {
      const result = await this.generateQaPairs(chunk.id);
      total += result.pairs;
      // 避免频率限制
      await new Promise(r => setTimeout(r, 500));
    }
    return { total };
  }

  // ─── 工具方法 ───

  private async getActiveConfig() {
    return this.prisma.aiConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async callLLM(config: any, prompt: string): Promise<string> {
    const baseUrl = config.apiBaseUrl || 'https://api.deepseek.com';
    const apiKey = config.apiKey;
    const model = config.modelVersion || 'deepseek-chat';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 3000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM ${res.status}: ${errText.slice(0, 100)}`);
      }

      const data: any = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  }

  private parseJsonResponse(text: string): any {
    // 尝试提取 JSON（LLM 可能包裹在 ```json ... ``` 中）
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      // 尝试找到第一个 [ 或 {
      const start = jsonStr.search(/[[{]/);
      if (start >= 0) {
        try { return JSON.parse(jsonStr.slice(start)); } catch {}
      }
      return null;
    }
  }
}
