import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { AiAssistantModule } from '../ai-assistant/ai-assistant.module.js';

@Module({
  imports: [AiAssistantModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
