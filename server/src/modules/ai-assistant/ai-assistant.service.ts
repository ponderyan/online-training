import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SourceInfo {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 非流式问答（兼容旧接口）
   */
  async ask(question: string, userId: number, history: ChatMessage[] = []) {
    const config = await this.getActiveConfig();
    if (!config) {
      return { answer: '⚠️ AI 配置未设置。请先联系管理员在「系统管理 > AI 配置」中配置 API 密钥。', sources: [] };
    }

    const { context, sources } = await this.retrieveContext(question);
    if (sources.length === 0) {
      return { answer: '教材中未找到与您问题相关的信息。请尝试换个问法或咨询您的培训老师。', sources: [] };
    }

    const studentProfile = await this.getStudentProfile(userId);
    const messages = this.buildMessages(config, question, context, history, studentProfile);
    const answer = await this.callLLM(config, messages);
    return { answer, sources };
  }

  /**
   * 流式问答（SSE）— 返回 ReadableStream 给 controller 转发
   */
  async askStream(question: string, userId: number, history: ChatMessage[] = []): Promise<{
    stream: ReadableStream<Uint8Array> | null;
    sources: SourceInfo[];
    error?: string;
  }> {
    const config = await this.getActiveConfig();
    if (!config) {
      return { stream: null, sources: [], error: 'AI 配置未设置，请联系管理员。' };
    }

    const { context, sources } = await this.retrieveContext(question);
    if (sources.length === 0) {
      return { stream: null, sources: [], error: '教材中未找到与您问题相关的信息。请尝试换个问法或咨询您的培训老师。' };
    }

    const studentProfile = await this.getStudentProfile(userId);
    const messages = this.buildMessages(config, question, context, history, studentProfile);

    const baseUrl = config.apiBaseUrl || 'https://api.deepseek.com';
    const apiKey = config.apiKey;
    const model = config.modelVersion || 'deepseek-chat';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: 2000,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '未知错误');
        return { stream: null, sources, error: `AI 请求失败 (${res.status})：${errText.slice(0, 100)}` };
      }

      // 将 OpenAI SSE 流转换为简单 text 流给前端
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const stream = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              ctrl.enqueue(new TextEncoder().encode('[DONE]'));
              ctrl.close();
              return;
            }
            const text = decoder.decode(value, { stream: true });
            // 解析 SSE data 行，提取 content delta
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  ctrl.enqueue(new TextEncoder().encode('[DONE]'));
                  ctrl.close();
                  return;
                }
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) {
                    ctrl.enqueue(new TextEncoder().encode(delta));
                  }
                } catch {}
              }
            }
          } catch (e: any) {
            ctrl.error(e);
          }
        },
      });

      return { stream, sources };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { stream: null, sources, error: 'AI 请求超时，请稍后重试。' };
      }
      return { stream: null, sources, error: `AI 请求出错：${e.message || '未知错误'}` };
    }
  }

  // ── 私有方法 ──

  private async getActiveConfig() {
    return this.prisma.aiConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 检索相关上下文：知识块 + 章节内容
   */
  private async retrieveContext(question: string): Promise<{ context: string; sources: SourceInfo[] }> {
    const keywords = this.extractKeywords(question);
    if (keywords.length === 0) return { context: '', sources: [] };

    const [chunkResults, chapterResults] = await Promise.all([
      this.searchChunks(keywords, 6),
      this.searchChapters(keywords, 3),
    ]);

    const allSources = [...chunkResults, ...chapterResults];
    const context = allSources
      .map((s, i) => `【来源 ${i + 1}】${s.materialName ? `《${s.materialName}》` : ''}${s.chapterTitle ? ` - ${s.chapterTitle}` : ''}\n${s.content}`)
      .join('\n\n');

    return { context, sources: allSources };
  }

  /**
   * 构建 LLM messages（含多轮历史 + P2-2 学员画像）
   */
  private buildMessages(config: any, question: string, context: string, history: ChatMessage[], studentProfile?: string): ChatMessage[] {
    let systemPrompt = `你是"🦊 狐学 AI 助教"，一个智能教材助教。
请基于以下教材内容回答用户的问题。

【教材内容】
${context}
`;

    if (studentProfile) {
      systemPrompt += `
【学员画像】
${studentProfile}
请根据学员的薄弱环节，在回答时优先引用其未掌握的知识点相关内容。
`;
    }

    systemPrompt += `
要求：
1. 只基于提供的教材内容回答，不要编造
2. 如果教材内容不足以回答问题，明确说"教材中未找到相关信息"
3. 用通俗易懂的语言解释，适当举例
4. 引用具体的教材章节来源
5. 回答使用 Markdown 格式
6. 如果用户的问题与教材完全无关，礼貌引导回学习话题`;

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    // 加入历史对话（最多保留最近 10 轮）
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 当前问题
    messages.push({ role: 'user', content: question });
    return messages;
  }

  /**
   * P2-2: 获取学员画像（薄弱知识点 + 最近错题）
   */
  private async getStudentProfile(userId: number): Promise<string | undefined> {
    try {
      // 最近错题的知识点
      const recentWrong = await this.prisma.practiceRecord.findMany({
        where: { studentId: userId, isCorrect: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          question: {
            include: { knowledgePoints: { include: { knowledgePoint: { select: { name: true } } } } },
          },
        },
      });

      if (recentWrong.length === 0) return undefined;

      const weakKps = new Map<string, number>();
      for (const record of recentWrong) {
        for (const qkp of (record as any).question?.knowledgePoints || []) {
          const name = qkp.knowledgePoint?.name;
          if (name) weakKps.set(name, (weakKps.get(name) || 0) + 1);
        }
      }

      if (weakKps.size === 0) return undefined;

      const sorted = [...weakKps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const profile = `薄弱知识点（近期错题统计）：${sorted.map(([name, count]) => `${name}(错${count}次)`).join('、')}`;
      return profile;
    } catch {
      return undefined;
    }
  }

  /**
   * 关键词提取（中文优化：去停用词 + bigram）
   */
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

    // 中文 bigram
    const bigrams = new Set<string>();
    for (const word of keywords) {
      if (/^[\u4e00-\u9fff]+$/.test(word) && word.length >= 4) {
        for (let i = 0; i <= word.length - 2; i++) {
          bigrams.add(word.substring(i, i + 2));
        }
      }
    }
    keywords = [...new Set([...keywords, ...bigrams])];
    return keywords.slice(0, 15); // 限制关键词数量
  }

  private async searchChunks(keywords: string[], limit: number): Promise<SourceInfo[]> {
    // P1-3: 优先使用 FULLTEXT 索引（ngram），降级 LIKE
    const ftQuery = keywords.join(' ');
    const conditions = keywords.map(k => `kc.content LIKE '%${k.replace(/'/g, "''")}%'`);
    const sql = `
      SELECT kc.id, kc.content, kc.source, kc.title,
             kd.name as document_name,
             MATCH(kc.content) AGAINST('${ftQuery.replace(/'/g, "''")}' IN BOOLEAN MODE) as relevance
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kc.document_id = kd.id
      WHERE MATCH(kc.content) AGAINST('${ftQuery.replace(/'/g, "''")}' IN BOOLEAN MODE)
      ORDER BY relevance DESC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      if (rows.length > 0) {
        return rows.map(r => ({
          materialName: r.document_name || r.title?.split(' - ')[0] || '',
          chapterTitle: r.title?.split(' - ')[1] || r.title || '',
          content: (r.content || '').slice(0, 300),
          source: r.source || r.document_name || '教材',
          type: 'chunk' as const,
        }));
      }
    } catch {}
    // 降级：LIKE 搜索
    const fallbackSql = `
      SELECT kc.id, kc.content, kc.source, kc.title,
             kd.name as document_name
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kc.document_id = kd.id
      WHERE ${conditions.map(c => c.replace('kc.', 'kc.')).join(' OR ')}
      ORDER BY LENGTH(kc.content) ASC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(fallbackSql);
      return rows.map(r => ({
        materialName: r.document_name || r.title?.split(' - ')[0] || '',
        chapterTitle: r.title?.split(' - ')[1] || r.title || '',
        content: (r.content || '').slice(0, 300),
        source: r.source || r.document_name || '教材',
        type: 'chunk' as const,
      }));
    } catch {
      return [];
    }
  }

  private async searchChapters(keywords: string[], limit: number): Promise<SourceInfo[]> {
    const conditions = keywords.map(k => `mc.content LIKE '%${k.replace(/'/g, "''")}%'`);
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
      return rows.map(r => ({
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

  private async callLLM(config: any, messages: ChatMessage[]): Promise<string> {
    const baseUrl = config.apiBaseUrl || 'https://api.deepseek.com';
    const apiKey = config.apiKey;
    const model = config.modelVersion || 'deepseek-chat';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '未知错误');
        return `AI 请求失败 (${res.status})：${errText.slice(0, 100)}`;
      }

      const data: any = await res.json();
      return data.choices?.[0]?.message?.content || 'AI 未返回有效回答，请重试。';
    } catch (e: any) {
      if (e.name === 'AbortError') return 'AI 请求超时，请稍后重试。';
      return `AI 请求出错：${e.message || '未知错误'}`;
    }
  }
}
