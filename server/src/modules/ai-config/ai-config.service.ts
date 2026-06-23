import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AiConfigService {
  constructor(private prisma: PrismaService) {}

  // 遮罩 API Key：只显示前后各2位，中间用星号
  private maskKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  // 返回给前端时脱敏
  private sanitize(config: any) {
    return { ...config, apiKey: this.maskKey(config.apiKey) };
  }

  async findAll() {
    const configs = await this.prisma.aiConfig.findMany({ orderBy: { createdAt: 'desc' } });
    return configs.map(c => this.sanitize(c));
  }

  async create(data: {
    name: string; provider: string; apiBaseUrl: string; apiKey: string;
    modelVersion: string; createdBy: number;
    temperature?: number; topP?: number; maxTokens?: number;
  }) {
    const created = await this.prisma.aiConfig.create({ data });
    return this.sanitize(created);
  }

  async update(id: number, data: any) {
    // 如果前端传了遮罩值（含星号），视为未修改，不更新 Key
    if (data.apiKey && data.apiKey.includes('****')) {
      delete data.apiKey;
    }
    const updated = await this.prisma.aiConfig.update({ where: { id }, data });
    return this.sanitize(updated);
  }

  async remove(id: number) {
    return this.prisma.aiConfig.delete({ where: { id } });
  }

  async findById(id: number) {
    return this.prisma.aiConfig.findUnique({ where: { id } });
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
