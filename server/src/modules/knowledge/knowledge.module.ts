import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeDocumentsService } from './knowledge-documents.service.js';
import { ChunkAiService } from './chunk-ai.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeDocumentsService, ChunkAiService],
  exports: [KnowledgeDocumentsService, ChunkAiService],
})
export class KnowledgeModule {}
