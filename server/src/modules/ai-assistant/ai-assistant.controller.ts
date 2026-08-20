import { Controller, Post, Body, Req, Res, UseGuards, HttpException, HttpStatus, Get, Delete, Param, ParseIntPipe } from '@nestjs/common';
import type { Response } from 'express';
import { AiAssistantService, ChatMessageInput } from './ai-assistant.service.js';
import { AiSessionService } from './agent/ai-session.service.js';
import { ChunkingService } from './chunking.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

/** 简易内存频率限制：每用户每分钟最多 10 次 */
const rateMap = new Map<number, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

@Controller('api/ai')
export class AiAssistantController {
  constructor(
    private service: AiAssistantService,
    private sessions: AiSessionService,
    private chunking: ChunkingService,
  ) {}

  /** 非流式问答（兼容旧接口） */
  @Post('ask')
  @UseGuards(JwtAuthGuard)
  async ask(@Body() body: { question: string; history?: ChatMessageInput[] }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    if (!checkRateLimit(userId)) {
      throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.service.ask(body.question, userId, body.history || []);
  }

  /**
   * Agent 化流式问答（SSE）
   * 事件：session / thinking / step / delta / sources / error / done
   * 兼容旧前端（sources/delta/error/[DONE] 契约不变）
   */
  @Post('ask/stream')
  @UseGuards(JwtAuthGuard)
  async askStream(
    @Body() body: { question: string; history?: ChatMessageInput[]; sessionId?: number },
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || req.user?.sub || 0;
    if (!checkRateLimit(userId)) {
      res.status(429).json({ error: '请求过于频繁，请稍后再试' });
      return;
    }
    if (!body.question?.trim()) {
      res.status(400).json({ error: '问题不能为空' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = await this.service.askAgentStream({
      question: body.question,
      userId,
      sessionId: body.sessionId,
      history: body.history,
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // ★ 客户端断连 → cancel 上游 stream → 触发 aborter.abort()，终止后台 LLM 调用（不再烧 token）
    // 双触发：req close 事件 + res finish/close 事件（兼容不同中间件层包装），另在读取循环内轮询 res 状态兜底
    const onDisconnect = () => {
      reader.cancel().catch(() => {});
    };
    req.on('close', onDisconnect);
    res.on('finish', onDisconnect);
    res.on('close', onDisconnect);

    try {
      while (true) {
        // 兜底：客户端已断开但事件未触发时，主动终止上游
        if ((res as any).writableEnded || (res as any).destroyed) {
          onDisconnect();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
    } catch {}
    res.end();
  }

  // ── 会话管理 ──

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    return this.sessions.list(userId);
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  async createSession(@Body() body: { title?: string }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    return this.sessions.create(userId, body.title || '新对话');
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async getSession(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    return this.sessions.get(userId, id);
  }

  /** ★ 停止会话当前回答（双保险：前端停止按钮断连 SSE 之外，显式终止后台 LLM 调用） */
  @Post('sessions/:id/stop')
  @UseGuards(JwtAuthGuard)
  async stopSession(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    return this.service.stopSession(id, userId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSession(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    await this.sessions.remove(userId, id);
    return { success: true };
  }

  // ── 嵌入/检索管理 ──

  /** 检索状态（嵌入可用性/索引覆盖） */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async aiStatus() {
    return this.service.retrievalStatus();
  }

  /** 重建嵌入索引（管理员） */
  @Post('embedding/rebuild')
  @UseGuards(JwtAuthGuard)
  async rebuildEmbeddings(@Req() req: any) {
    const roles: string[] = req.user?.roles || [];
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) {
      throw new HttpException('仅管理员可操作', HttpStatus.FORBIDDEN);
    }
    return this.service.rebuildEmbeddings();
  }

  /** 重建知识块（管理员，保留旧接口） */
  @Post('rebuild-chunks')
  @UseGuards(JwtAuthGuard)
  async rebuildChunks(@Body() body: { materialId?: number }, @Req() req: any) {
    const roles: string[] = req.user?.roles || [];
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) {
      throw new HttpException('仅管理员可操作', HttpStatus.FORBIDDEN);
    }
    if (body.materialId) {
      return this.chunking.rebuildForMaterial(body.materialId);
    }
    return this.chunking.rebuildAll();
  }
}
