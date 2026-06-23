import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(private service: KnowledgeService) {}

  @Get('documents')
  @RequirePermission(P.SYSTEM_CONFIG)
  async findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('search') search?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
    });
  }

  @Post('documents')
  @RequirePermission(P.SYSTEM_CONFIG)
  async uploadPlaceholder() {
    return { success: true, message: '功能开发中' };
  }

  @Delete('documents/:source')
  @RequirePermission(P.SYSTEM_CONFIG)
  async delete(@Param('source') source: string) {
    return this.service.deleteBySource(decodeURIComponent(source));
  }

  @Post('query')
  async queryPlaceholder() {
    return { success: true, message: 'AI 知识库问答功能开发中，敬请期待' };
  }
}
