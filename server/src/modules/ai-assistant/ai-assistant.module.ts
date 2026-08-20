import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiAssistantController } from './ai-assistant.controller.js';
import { AiAssistantService } from './ai-assistant.service.js';
import { ChunkingService } from './chunking.service.js';
import { AiSessionService } from './agent/ai-session.service.js';
import { AgentKernelService } from './agent/agent-kernel.service.js';
import { ToolRegistryService } from './agent/tool-registry.js';
import { RetrievalService } from './agent/retrieval.service.js';
import { EmbeddingService } from './agent/embedding.service.js';
import { buildDomainTools } from './agent/domain-tools.js';
import { DOMAIN_TOOLS } from './agent/tool-tokens.js';

@Module({
  imports: [PrismaModule],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    ChunkingService,
    AiSessionService,
    AgentKernelService,
    ToolRegistryService,
    RetrievalService,
    EmbeddingService,
    {
      provide: DOMAIN_TOOLS,
      useFactory: (retrieval: RetrievalService, prisma: PrismaService) => buildDomainTools(retrieval, prisma),
      inject: [RetrievalService, PrismaService],
    },
  ],
  exports: [ChunkingService],
})
export class AiAssistantModule {}
