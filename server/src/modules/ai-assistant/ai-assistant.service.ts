import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SourceInfo {
  materialName: string;
  chapterTitle: string;
  content: string;
  source: string;
  type: 'chunk' | 'chapter';
}

export interface AiAnswerResponse {
  answer: string;
  sources: SourceInfo[];
}

@Injectable()
export class AiAssistantService {
  constructor(private prisma: PrismaService) {}

  async ask(question: string, _userId: number): Promise<AiAnswerResponse> {
    // 1. 获取激活的 AI 配置
    const config = await this.prisma.aiConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return {
        answer: '⚠️ AI 配置未设置。请先联系管理员在「系统管理 > AI 配置」中配置 API 密钥。',
        sources: [],
      };
    }

    // 2. 关键词提取（中文优化版：去停用词 → 分词 → 中文 bigram）
    const STOPWORDS = ['什么','怎么','如何','为什么','哪些','哪个','怎样','几时','多少','为何','是否','可否',
      '是','的','了','在','有','和','与','或','就','不','都','一','上','也','很','到','要','去',
      '会','着','没有','看','好','自己','这','那','她','它','们','吗','呢','吧','啊','哦','嗯',
      '请问','请教','帮忙','帮','我','你','他','能','可以','应该','需要'];
    let cleaned = question;
    for (const sw of STOPWORDS) {
      cleaned = cleaned.replace(new RegExp(sw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    }
    let keywords: string[] = cleaned
      .replace(/[，。！？、；：""''（）【】《》\s,;:!?.'"()【】《》\t\n\r]+/g, ' ')
      .split(/\s+/)
      .filter(k => k.length >= 2);

    // Generate overlapping 2-char bigrams for Chinese-only sequences ≥4 chars
    const bigrams = new Set<string>();
    for (const word of keywords) {
      if (/^[\u4e00-\u9fff]+$/.test(word) && word.length >= 4) {
        for (let i = 0; i <= word.length - 2; i++) {
          bigrams.add(word.substring(i, i + 2));
        }
      }
    }
    keywords = [...new Set([...keywords, ...bigrams])];

    if (keywords.length === 0) {
      return { answer: '请提供更具体的问题，包含至少 2 个字符的关键词。', sources: [] };
    }

    // 3. 搜索 KnowledgeChunk
    const chunkResults = await this.searchChunks(keywords, 5);
    // 4. 搜索 MaterialChapter 作为补充
    const chapterResults = await this.searchChapters(keywords, 3);

    const allSources = [...chunkResults, ...chapterResults];

    if (allSources.length === 0) {
      return { answer: '教材中未找到与您问题相关的信息。请尝试换个问法或咨询您的培训老师。', sources: [] };
    }

    // 5. 拼接 context
    const context = allSources
      .map((s, i) => `【来源 ${i + 1}】${s.materialName ? `《${s.materialName}》` : ''}${s.chapterTitle ? ` - ${s.chapterTitle}` : ''}\n${s.content}`)
      .join('\n\n');

    // 6. 调用 LLM
    const answer = await this.callLLM(config, question, context);

    return { answer, sources: allSources };
  }

  private async searchChunks(keywords: string[], limit: number): Promise<SourceInfo[]> {
    const conditions = keywords.map(k => `content LIKE '%${k.replace(/'/g, "''")}%'`);
    const sql = `
      SELECT kc.id, kc.content, kc.source, mc.title as chapter_title, m.name as material_name
      FROM knowledge_chunks kc
      LEFT JOIN material_chapters mc ON kc.chapter_id = mc.id
      LEFT JOIN materials m ON mc.material_id = m.id
      WHERE ${conditions.join(' OR ')}
      ORDER BY LENGTH(kc.content) ASC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      return rows.map(r => ({
        materialName: r.material_name || '',
        chapterTitle: r.chapter_title || '',
        content: (r.content || '').slice(0, 200),
        source: r.source || '教材',
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
      WHERE mc.status = 'GENERATED' AND (${conditions.join(' OR ')})
      ORDER BY LENGTH(mc.content) ASC
      LIMIT ${limit};
    `;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
      return rows.map(r => ({
        materialName: r.material_name || '',
        chapterTitle: r.chapter_title || '',
        content: (r.content || '').slice(0, 200),
        source: r.material_name || '教材',
        type: 'chapter' as const,
      }));
    } catch {
      return [];
    }
  }

  private async callLLM(config: any, question: string, context: string): Promise<string> {
    const systemPrompt = `你是一个智能教材助教，名叫"🦊 狐学 AI 助教"。
请基于以下教材内容回答用户的问题。

【教材内容】
${context}

【用户问题】
${question}

要求：
1. 只基于提供的教材内容回答
2. 如果教材内容不足以回答问题，明确说"教材中未找到相关信息"
3. 用通俗易懂的语言解释
4. 引用具体的教材章节来源
5. 回答使用 Markdown 格式，适当使用标题、列表等`;

    const baseUrl = config.apiBaseUrl || 'https://api.deepseek.com';
    const apiKey = config.apiKey;
    const model = config.modelVersion || 'deepseek-chat';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
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
      if (e.name === 'AbortError') {
        return 'AI 请求超时，请稍后重试。';
      }
      return `AI 请求出错：${e.message || '未知错误'}`;
    }
  }
}
