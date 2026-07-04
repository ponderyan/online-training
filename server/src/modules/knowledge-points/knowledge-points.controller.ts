import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { KnowledgePointsService } from './knowledge-points.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api')
export class KnowledgePointsController {
  constructor(private service: KnowledgePointsService) {}

  @Get('knowledge-points')
  @RequirePermission(P.KNOWLEDGE_VIEW)
  getTree() { return this.service.getTree(); }

  @Get('knowledge-points/:id')
  @RequirePermission(P.KNOWLEDGE_VIEW)
  getOne(@Param('id', ParseIntPipe) id: number) { return this.service.getOne(id); }

  @Post('knowledge-points')
  @RequirePermission(P.KNOWLEDGE_MANAGE)
  create(@Body() data: any) { return this.service.create(data); }

  @Patch('knowledge-points/:id')
  @RequirePermission(P.KNOWLEDGE_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete('knowledge-points/:id')
  @RequirePermission(P.KNOWLEDGE_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Get('questions/:id/knowledge-points')
  @RequirePermission(P.KNOWLEDGE_VIEW)
  getQuestionKPs(@Param('id', ParseIntPipe) id: number) { return this.service.getQuestionKnowledgePoints(id); }

  @Patch('questions/:id/knowledge-points')
  @RequirePermission(P.KNOWLEDGE_MANAGE)
  setQuestionKPs(@Param('id', ParseIntPipe) id: number, @Body() data: { knowledgePointIds: number[] }) {
    return this.service.setQuestionKnowledgePoints(id, data.knowledgePointIds);
  }
}
