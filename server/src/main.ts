import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from './app.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

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
}
bootstrap();
