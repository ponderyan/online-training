/**
 * AI 降级策略测试
 * HTTP 端到端验证（手动执行过）：临时把 ai_configs.api_base_url 指向不可达端口 →
 * POST /api/knowledge/chunks/1/generate-questions 返回 503 + code:'AI_UNAVAILABLE' + 友好文案，
 * 测后恢复配置。此处固化异常契约，防止回归。
 */
import { describe, it, expect } from 'vitest';
import { AiUnavailableException } from '../src/common/exceptions/ai-unavailable.exception.js';

describe('AI 降级异常契约', () => {
  it('AiUnavailableException：503 + code + 友好文案', () => {
    const e = new AiUnavailableException('fetch failed');
    expect(e.getStatus()).toBe(503);
    const resp = e.getResponse() as any;
    expect(resp.code).toBe('AI_UNAVAILABLE');
    expect(resp.message).toContain('AI 服务暂时不可用');
    expect(resp.message).toContain('fetch failed'); // 保留摘要便于排障
  });

  it('无细节时使用管理员指引文案', () => {
    const e = new AiUnavailableException();
    const resp = e.getResponse() as any;
    expect(resp.message).toContain('联系管理员检查 AI 配置');
  });

  it('细节超长时截断（防响应体膨胀）', () => {
    const e = new AiUnavailableException('x'.repeat(5000));
    const resp = e.getResponse() as any;
    expect(resp.message.length).toBeLessThan(300);
  });
});
