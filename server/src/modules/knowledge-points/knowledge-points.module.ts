import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { KnowledgePointsController } from './knowledge-points.controller.js';
import { KnowledgePointsService } from './knowledge-points.service.js';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgePointsController, RecommendationsController],
  providers: [KnowledgePointsService, RecommendationsService],
  exports: [KnowledgePointsService],
})
export class KnowledgePointsModule {}
