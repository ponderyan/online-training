import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { AiAssistantModule } from '../ai-assistant/ai-assistant.module.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';

@Module({
  imports: [AiAssistantModule, SystemConfigModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
