import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { InstructorsService } from './instructors.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/instructors')
export class InstructorsController {
  constructor(private service: InstructorsService) {}

  @Get() @RequirePermission(P.INSTRUCTOR_VIEW)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('level') level?: string,
    @Query('type') type?: string,
    @Query('workUnit') workUnit?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      keyword, status, level, type, workUnit,
    });
  }

  @Get('available-graders') @RequirePermission(P.INSTRUCTOR_VIEW)
  getAvailableGraders() { return this.service.getAvailableGraders(); }

  @Get(':id/stats') @RequirePermission(P.INSTRUCTOR_VIEW)
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStats(id);
  }

  @Get(':id') @RequirePermission(P.INSTRUCTOR_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post() @RequirePermission(P.INSTRUCTOR_CREATE)
  create(@Body() data: any) { return this.service.create(data); }

  @Put(':id') @RequirePermission(P.INSTRUCTOR_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id') @RequirePermission(P.INSTRUCTOR_DELETE)
  delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
}
