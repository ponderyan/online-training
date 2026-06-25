import { Controller, Get, Post, Put, Param, Body, Query, ParseIntPipe, Req } from '@nestjs/common';
import { FilingService } from './filing.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/filing')
export class FilingController {
  constructor(private service: FilingService) {}

  @Get()
  @RequirePermission(P.PROGRAM_VIEW)
  async findAll(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string, @Query('search') search?: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.service.findAll({ page: page ? parseInt(page) : 1, pageSize: pageSize ? parseInt(pageSize) : 20, status, search }, userId);
  }

  @Get(':id')
  @RequirePermission(P.PROGRAM_VIEW)
  async findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post(':programId/submit')
  @RequirePermission(P.PROGRAM_CREATE)
  async submit(@Param('programId', ParseIntPipe) programId: number, @Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.submit(programId, data, userId);
  }

  @Put(':id/review')
  @RequirePermission(P.PROGRAM_EDIT)
  async review(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.review(id, data, userId);
  }
}
