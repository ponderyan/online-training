import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller.js';
import { AiConfigService } from './ai-config.service.js';

@Module({
  controllers: [AiConfigController],
  providers: [AiConfigService],
})
export class AiConfigModule {}
