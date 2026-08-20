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
  ];
}
