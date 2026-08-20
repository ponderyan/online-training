import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChatToolCall } from './types.js';
import { deriveDisplayFromEvents, deriveMessagesFromEvents } from './derive.js';

/** 追加式事件载荷 */
export interface SessionEventInput {
  type: string;
  role?: string;
  content?: string | null;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: unknown;
  toolResult?: unknown;
  sourceEventSeqs?: number[];
  surfaceOp?: string;
  meta?: Record<string, unknown>;
}

const DEFAULT_TITLE = '新对话';

@Injectable()
export class AiSessionService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, title: string = DEFAULT_TITLE) {
    return this.prisma.aiSession.create({ data: { userId, title } });
  }

  /** 会话列表（最近优先，含标题/预览/消息数） */
  async list(userId: number) {
    const sessions = await this.prisma.aiSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { events: { orderBy: { seq: 'asc' }, select: { type: true, role: true, content: true } } },
    });
    return sessions.map((s) => {
      const texts = [...s.events]
        .filter((e) => e.content && (e.type === 'user' || e.type === 'assistant'))
        .map((e) => e.content as string);
      const preview = texts.length ? texts[texts.length - 1].slice(0, 80) : '';
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        preview,
        messageCount: s.events.filter((e) => e.type === 'user' || e.type === 'assistant').length,
      };
    });
  }

  /** 会话详情 + 派生消息 */
  async get(userId: number, sessionId: number) {
    const session = await this.prisma.aiSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('会话不存在');
    return { ...session, messages: await this.deriveDisplay(sessionId) };
  }

  /** 归属校验（不存在/非本人 → 抛错） */
  async assertOwned(userId: number, sessionId: number) {
    const session = await this.prisma.aiSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('会话不存在');
    return session;
  }

  /** 删除（级联事件） */
  async remove(userId: number, sessionId: number) {
    const res = await this.prisma.aiSession.deleteMany({ where: { id: sessionId, userId } });
    if (res.count === 0) throw new NotFoundException('会话不存在');
  }

  /**
   * 追加事件（seq 会话内原子递增）——事件溯源唯一事实源
   * 事务内：max(seq)+1 → 更新会话 updatedAt → 写入事件
   */
  async appendEvent(sessionId: number, data: SessionEventInput) {
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.aiSessionEvent.aggregate({ where: { sessionId }, _max: { seq: true } });
      const seq = (agg._max.seq ?? 0) + 1;
      await tx.aiSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
      return tx.aiSessionEvent.create({
        data: {
          sessionId,
          seq,
          type: data.type,
          role: data.role,
          content: data.content ?? null,
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          toolArguments: data.toolArguments === undefined ? undefined : (data.toolArguments as object),
          toolResult: data.toolResult === undefined ? undefined : (data.toolResult as object),
          sourceEventSeqs: data.sourceEventSeqs as number[] | undefined,
          surfaceOp: data.surfaceOp,
          meta: data.meta as object | undefined,
        },
      });
    });
  }

  /** 首问设标题 */
  async maybeSetTitle(sessionId: number, firstQuestion: string) {
    const session = await this.prisma.aiSession.findUnique({ where: { id: sessionId }, select: { title: true } });
    if (session && session.title === DEFAULT_TITLE) {
      const title = firstQuestion.trim().replace(/\s+/g, ' ').slice(0, 40);
      await this.prisma.aiSession.update({ where: { id: sessionId }, data: { title } });
    }
  }

  /**
   * 派生 LLM 消息数组（OpenAI 格式，含 tool_calls / tool 角色）
   * 事件日志 → 派生，是 DSH「日志即真相、消息即投影」的轻量实现
   */
  async deriveMessages(sessionId: number) {
    const events = await this.prisma.aiSessionEvent.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
    });
    return deriveMessagesFromEvents(events);
  }

  /** 派生前端展示消息（user/assistant 纯文本 + 工具调用标注） */
  async deriveDisplay(sessionId: number) {
    const events = await this.prisma.aiSessionEvent.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
    });
    return deriveDisplayFromEvents(events);
  }
}
