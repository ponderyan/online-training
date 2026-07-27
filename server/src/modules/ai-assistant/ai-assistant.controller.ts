import { Controller, Post, Body, Req, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AiAssistantService, ChatMessage } from './ai-assistant.service.js';
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
    private chunking: ChunkingService,
  ) {}

  /** 非流式问答（兼容） */
  @Post('ask')
  @UseGuards(JwtAuthGuard)
  async ask(@Body() body: { question: string; history?: ChatMessage[] }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || 0;
    if (!checkRateLimit(userId)) {
      throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.service.ask(body.question, userId, body.history || []);
  }

  /** 流式问答（SSE） */
  @Post('ask/stream')
  @UseGuards(JwtAuthGuard)
  async askStream(
    @Body() body: { question: string; history?: ChatMessage[] },
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || req.user?.sub || 0;
    if (!checkRateLimit(userId)) {
      res.status(429).json({ error: '请求过于频繁，请稍后再试' });
      return;
    }

    const { stream, sources, error } = await this.service.askStream(body.question, userId, body.history || []);

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: error })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 先发送 sources
    res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

    // 转发流
    if (!stream) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text === '[DONE]') break;
        res.write(`data: ${JSON.stringify({ type: 'delta', content: text })}\n\n`);
      }
    } catch {}

    res.write('data: [DONE]\n\n');
    res.end();
  }

  /** 重建知识块（管理员） */
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
