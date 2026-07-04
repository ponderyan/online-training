import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { KnowledgePointsController } from './knowledge-points.controller.js';
import { KnowledgePointsService } from './knowledge-points.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgePointsController],
  providers: [KnowledgePointsService],
  exports: [KnowledgePointsService],
})
export class KnowledgePointsModule {}
