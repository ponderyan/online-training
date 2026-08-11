import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from './app.module.js';
import { requestLogger } from './common/logging/request-logger.middleware.js';
import { GlobalExceptionFilter } from './common/logging/global-exception.filter.js';
import { appLogger } from './common/logging/app-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app)); // 监考大屏原生 WebSocket（/ws/proctoring）
  app.enableCors();
  // 结构化日志：请求日志中间件 + 全局异常记录（写 logs/foxlearn-YYYY-MM-DD.log）
  app.use(requestLogger);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useBodyParser('json', { limit: '10mb' });

  // Serve uploaded files（头像/附件/试卷等）
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/paper-files/',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://0.0.0.0:${port}`);
  appLogger.info({ type: 'startup', event: 'server_started', port });
}
bootstrap();
