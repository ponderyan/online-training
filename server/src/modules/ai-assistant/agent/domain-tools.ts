import { PrismaService } from '../../prisma/prisma.service.js';
import { RetrievalService } from './retrieval.service.js';
import { AgentTool, SourceInfo } from './types.js';

/** 领域工具工厂：注入依赖，返回工具定义数组 */
export function buildDomainTools(
  retrieval: RetrievalService,
  prisma: PrismaService,
): AgentTool[] {
  return [
    {
      name: 'search_knowledge',
      description:
        '在培训教材/知识库中检索与给定问题相关的教学片段。当学员提问涉及教材概念、定义、流程、要求等知识内容时使用。返回教材原文片段与来源，回答时应基于检索到的内容。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '要检索的关键问题或概念，越具体越好（如"ITSS符合性评估的流程"）' },
          limit: { type: 'number', description: '返回片段数量，默认 5', minimum: 1, maximum: 10 },
        },
        required: ['query'],
      },
      handler: async (args, _ctx) => {
        const query = String(args.query ?? '');
        const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
        const sources: SourceInfo[] = await retrieval.hybridSearch(query, limit);
        if (sources.length === 0) {
          return {
            output: { message: '知识库中未找到相关内容', sources: [] },
            sources: [],
          };
        }
        const text = sources
          .map((s, i) => `【来源${i + 1}】${s.materialName ? `《${s.materialName}》` : ''}${s.chapterTitle ? `- ${s.chapterTitle}` : ''}\n${s.content}`)
          .join('\n\n');
        return { output: { message: '检索到以下教材内容', text, sources: sources.map((s) => s.source) }, sources };
      },
    },

    {
      name: 'get_recent_wrong',
      description:
        '获取当前学员近期做错的练习题目及薄弱知识点统计。当学员说"我上次错在哪""我的薄弱环节""复习建议"等涉及个人学习情况的问题时使用。',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: '取最近多少条错题，默认 10', minimum: 1, maximum: 50 },
        },
      },
      handler: async (args, ctx) => {
        const count = Math.min(Math.max(Number(args.count) || 10, 1), 50);
        const records = await prisma.practiceRecord.findMany({
          where: { studentId: ctx.userId, isCorrect: false, subjective: false },
          orderBy: { createdAt: 'desc' },
          take: count,
          include: {
            question: {
              select: {
                id: true,
                type: true,
                content: true,
                knowledgePoints: { include: { knowledgePoint: { select: { name: true } } } },
              },
            },
          },
        });
        if (records.length === 0) {
          return { output: { message: '该学员近期没有练习错题记录', count: 0, wrongQuestions: [] } };
        }
        const weak = new Map<string, number>();
        for (const r of records) {
          for (const qkp of r.question.knowledgePoints) {
            const name = qkp.knowledgePoint.name;
            weak.set(name, (weak.get(name) || 0) + 1);
          }
        }
        const weakPoints = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([name, n]) => ({ knowledgePoint: name, wrongCount: n }));
        const wrongQuestions = records.map((r) => ({
          questionId: r.question.id,
          type: r.question.type,
          content: r.question.content.slice(0, 100),
        }));
        return {
          output: {
            message: `找到 ${records.length} 道错题`,
            weakPoints,
            wrongQuestions,
          },
        };
      },
    },

    {
      name: 'get_question_detail',
      description:
        '按题目 ID 查询题库中某道题的完整信息（题干、选项、解析、知识点）。当学员提到"上次那道题""第N题"或你想针对某道具体题目讲解时，先用本工具拿到题目详情。',
      parameters: {
        type: 'object',
        properties: {
          questionId: { type: 'number', description: '题目 ID' },
        },
        required: ['questionId'],
      },
      handler: async (args) => {
        const id = Number(args.questionId);
        if (!Number.isInteger(id)) return { output: { error: 'questionId 必须是整数' } };
        const q = await prisma.question.findUnique({
          where: { id },
          select: {
            id: true,
            type: true,
            content: true,
            analysis: true,
            difficulty: true,
            options: { select: { label: true, content: true, isCorrect: true } },
            knowledgePoints: { include: { knowledgePoint: { select: { name: true } } } },
          },
        });
        if (!q) return { output: { error: `题目 ${id} 不存在` } };
        return {
          output: {
            id: q.id,
            type: q.type,
            content: q.content,
            difficulty: q.difficulty,
            options: q.options,
            analysis: q.analysis,
            knowledgePoints: q.knowledgePoints.map((kp) => kp.knowledgePoint.name),
          },
        };
      },
    },

    {
      name: 'get_knowledge_graph',
      description:
        '查询知识图谱：输入知识点名称或 ID，返回该知识点在课程树中的位置（父级路径）、下属子知识点及关联题目数量。当学员问"XX体系包含什么""XX属于哪一部分""XX和YY在结构上什么关系"等涉及知识点体系结构的问题时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '知识点名称（支持模糊匹配）或数字 ID，如"数据治理"或"12"' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const q = String(args.query ?? '').trim();
        if (!q) return { output: { error: 'query 不能为空' } };
        const idNum = Number(q);
        const where =
          Number.isInteger(idNum) && String(idNum) === q
            ? { id: idNum }
            : { name: { contains: q }, isActive: true };
        const points = await prisma.knowledgePoint.findMany({
          where,
          orderBy: { sortOrder: 'asc' },
          take: 20,
        });
        if (points.length === 0) {
          return { output: { message: `知识图谱中未找到知识点「${q}」`, count: 0 } };
        }
        const results: unknown[] = [];
        for (const p of points) {
          // 向上回溯父级路径
          const ancestors: { id: number; name: string }[] = [];
          let parentId = p.parentId;
          let guard = 0;
          while (parentId && guard++ < 10) {
            const parent = await prisma.knowledgePoint.findUnique({
              where: { id: parentId },
              select: { id: true, name: true, parentId: true },
            });
            if (!parent) break;
            ancestors.unshift({ id: parent.id, name: parent.name });
            parentId = parent.parentId;
          }
          const children = await prisma.knowledgePoint.findMany({
            where: { parentId: p.id, isActive: true },
            select: { id: true, name: true },
            orderBy: { sortOrder: 'asc' },
          });
          const questionCount = await prisma.questionKnowledgePoint.count({
            where: { knowledgePointId: p.id },
          });
          results.push({
            id: p.id,
            name: p.name,
            description: p.description,
            path: [...ancestors.map((a) => a.name), p.name].join(' > '),
            children: children.map((c) => c.name),
            questionCount,
          });
        }
        return {
          output: {
            message: `知识图谱中找到 ${results.length} 个相关知识点`,
            points: results,
          },
        };
      },
    },

    {
      name: 'generate_variation',
      description:
        '基于某道题目生成 1-3 道变式练习题（保持知识点与题型一致，更换数字/情景/选项表述并打乱正确选项位置）。当学员说"这题换个数字考我""来几道同类型题练练""变式练习"等需要同类题目巩固练习时使用。',
      parameters: {
        type: 'object',
        properties: {
          questionId: { type: 'number', description: '源题目 ID（可先调 get_question_detail 或让学员指定题号）' },
          count: { type: 'number', description: '生成数量，默认 2，最大 3', minimum: 1, maximum: 3 },
        },
        required: ['questionId'],
      },
      handler: async (args) => {
        const id = Number(args.questionId);
        const count = Math.min(Math.max(Number(args.count) || 2, 1), 3);
        if (!Number.isInteger(id)) return { output: { error: 'questionId 必须是整数' } };
        const q = await prisma.question.findUnique({
          where: { id },
          select: {
            id: true,
            type: true,
            content: true,
            analysis: true,
            options: { select: { label: true, content: true, isCorrect: true } },
            knowledgePoints: { include: { knowledgePoint: { select: { name: true } } } },
          },
        });
        if (!q) return { output: { error: `题目 ${id} 不存在` } };
        const config = await prisma.aiConfig.findFirst({
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (!config) {
          return { output: { error: 'AI 配置未设置，请联系管理员在「系统管理 > AI 配置」中配置 API 密钥' } };
        }
        const baseUrl = (config.apiBaseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
        const source = {
          content: q.content,
          options: q.options.map((o) => ({ ...o, isCorrect: o.isCorrect })),
          analysis: q.analysis,
          type: q.type,
          knowledgePoints: q.knowledgePoints.map((kp) => kp.knowledgePoint.name),
        };
        let res: Response;
        try {
          res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
            body: JSON.stringify({
              model: config.modelVersion || 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content:
                    '你是资深培训出题专家。根据给定源题生成变式题：保持知识点、题型、难度一致，仅更换数字/情景/案例/选项表述，正确选项位置打乱。只输出 JSON 数组，不要输出任何解释或 Markdown 代码块围栏。',
                },
                {
                  role: 'user',
                  content: `源题：${JSON.stringify(source)}\n\n生成 ${count} 道变式题，输出格式（JSON 数组）：\n[{"content":"题干","options":[{"label":"A","content":"选项内容","isCorrect":true}],"analysis":"解析"}]`,
                },
              ],
              temperature: 0.8,
              max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(45000),
          });
        } catch (e) {
          return { output: { error: `AI 服务请求失败：${(e as Error)?.message?.slice(0, 100)}` } };
        }
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          return { output: { error: `AI 服务调用失败（${res.status}）`, detail: t.slice(0, 100) } };
        }
        const json: any = await res.json();
        const content = json.choices?.[0]?.message?.content || '';
        // 提取 JSON（兼容模型输出带 ```json 围栏或前后杂文本）
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const bare = content.match(/\[[\s\S]*\]/);
        const raw = (fenced ? fenced[1] : bare ? bare[0] : content).trim();
        try {
          const variations = JSON.parse(raw);
          if (!Array.isArray(variations)) return { output: { error: 'AI 返回内容不是题目数组' } };
          return {
            output: {
              message: `已基于源题生成 ${variations.length} 道变式题`,
              sourceQuestionId: id,
              variations: variations.slice(0, 3),
            },
          };
        } catch {
          return { output: { error: 'AI 返回内容无法解析为题目 JSON，请重试', raw: content.slice(0, 300) } };
        }
      },
    },
  ];
}
