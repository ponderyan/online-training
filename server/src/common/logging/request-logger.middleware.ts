import { appLogger } from './app-logger.js';

/**
 * 请求日志中间件：记录 method/path/status/耗时/userId。
 * 跳过健康检查与静态资源，避免日志噪音。
 */
export function requestLogger(req: any, res: any, next: () => void) {
  // 仅记录 API 请求
  if (!req.originalUrl?.startsWith('/api/')) return next();
  if (req.originalUrl.startsWith('/api/health')) return next();

  const start = Date.now();
  res.on('finish', () => {
    appLogger.info({
      type: 'http',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      userId: req.user?.id ?? null,
      ip: req.ip,
    });
  });
  next();
}
