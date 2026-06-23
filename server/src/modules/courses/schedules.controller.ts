import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { SchedulesService } from './schedules.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/schedules')
export class SchedulesController {
  constructor(private service: SchedulesService) {}

  @Get() @RequirePermission(P.SCHEDULE_VIEW)
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('programId') programId?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      programId: programId ? parseInt(programId) : undefined,
    });
  }

  @Get(':id') @RequirePermission(P.SCHEDULE_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post() @RequirePermission(P.SCHEDULE_CREATE)
  create(@Body() data: any) { return this.service.create(data); }

  @Put(':id') @RequirePermission(P.SCHEDULE_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id') @RequirePermission(P.SCHEDULE_DELETE)
  delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
}
