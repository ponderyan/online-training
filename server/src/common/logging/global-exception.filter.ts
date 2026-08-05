import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { appLogger } from './app-logger.js';

/**
 * 全局异常记录：5xx 记 error（含 stack），429/403 记 warn。
 * 响应格式与 NestJS 默认异常处理完全一致（{ statusCode, message, error }），
 * 不 rethrow（新版 Nest rethrow 会落到 Express 默认 HTML 错误页）。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse<any>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const base = {
      type: 'exception',
      method: req?.method,
      path: req?.originalUrl,
      status,
      userId: req?.user?.id ?? null,
    };
    if (status >= 500) {
      const e = exception as Error;
      appLogger.error({ ...base, message: e?.message, stack: e?.stack });
    } else if (status === 429 || status === 403) {
      const msg = exception instanceof HttpException ? exception.message : undefined;
      appLogger.warn({ ...base, message: msg });
    }

    // 响应格式对齐 NestJS 默认异常处理器
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        res.status(status).json({ statusCode: status, message: body });
      } else {
        res.status(status).json(body);
      }
    } else {
      res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
