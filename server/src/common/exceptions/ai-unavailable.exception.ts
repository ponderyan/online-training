import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * AI 外部服务不可用（网络故障/超时/上游 5xx/密钥失效等）。
 * 统一 503 + 友好文案 + code:'AI_UNAVAILABLE'，前端据此展示降级提示而非裸错误。
 */
export class AiUnavailableException extends HttpException {
  constructor(detail?: string) {
    super(
      {
        message: `AI 服务暂时不可用，请稍后重试。${detail ? `（${detail.slice(0, 120)}）` : '如持续出现请联系管理员检查 AI 配置。'}`,
        code: 'AI_UNAVAILABLE',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
