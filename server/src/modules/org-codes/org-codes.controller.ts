import { Controller, Get, Post, Patch, Delete, Put, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { OrgCodesService } from './org-codes.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/org-codes')
export class OrgCodesController {
  constructor(private service: OrgCodesService) {}

  // ── 缩写词典 ──

  @Get('abbreviations')
  @RequirePermission(P.SYSTEM_CONFIG_VIEW)
  getAbbreviations() {
    return this.service.getAbbreviations();
  }

  @Post('abbreviations')
  @RequirePermission(P.SYSTEM_CONFIG_MANAGE)
  createAbbreviation(@Body() data: { keyword: string; abbr: string; category?: string; sortOrder?: number }) {
    return this.service.createAbbreviation(data);
  }

  @Patch('abbreviations/:id')
  @RequirePermission(P.SYSTEM_CONFIG_MANAGE)
  updateAbbreviation(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.service.updateAbbreviation(id, data);
  }

  @Delete('abbreviations/:id')
  @RequirePermission(P.SYSTEM_CONFIG_MANAGE)
  deleteAbbreviation(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAbbreviation(id);
  }

  // ── 编码规则 ──

  @Get('rules')
  @RequirePermission(P.SYSTEM_CONFIG_VIEW)
  getRules() {
    return this.service.getCodeRules();
  }

  @Put('rules')
  @RequirePermission(P.SYSTEM_CONFIG_MANAGE)
  updateRules(@Body() data: { separator?: string; autoGenerate?: boolean; includeLevel?: boolean }) {
    return this.service.updateCodeRules(data);
  }

  // ── 编码预览 ──

  @Get('preview')
  @RequirePermission(P.SYSTEM_CONFIG_VIEW)
  async preview(@Query('parentId') parentId?: string, @Query('name') name?: string) {
    const code = await this.service.previewCode(
      parentId ? parseInt(parentId) : null,
      name || '',
    );
    return { code };
  }
}
