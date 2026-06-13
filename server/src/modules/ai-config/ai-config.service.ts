import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AiConfigService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.aiConfig.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(data: {
    name: string; provider: string; apiBaseUrl: string; apiKey: string;
    modelVersion: string; createdBy: number;
    temperature?: number; topP?: number; maxTokens?: number;
  }) {
    return this.prisma.aiConfig.create({ data });
  }

  update(id: number, data: any) {
    return this.prisma.aiConfig.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.aiConfig.delete({ where: { id } });
  }

  async testConnection(config: { apiBaseUrl: string; apiKey: string; modelVersion: string }) {
    const url = config.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelVersion,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return { success: true, message: '连接成功' };
      }

      let detail = '';
      try { const body: any = await response.json(); detail = body.error?.message || JSON.stringify(body); }
      catch { detail = await response.text().catch(() => ''); }
      return { success: false, message: `API 错误 (${response.status}): ${detail}` };
    } catch (e: any) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        return { success: false, message: '连接超时，请检查 API 地址是否正确' };
      }
      return { success: false, message: `连接失败: ${e.message}` };
    }
  }
}
