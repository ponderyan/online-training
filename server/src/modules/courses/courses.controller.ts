import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/courses')
export class CoursesController {
  constructor(private service: CoursesService) {}

  @Get()
  @RequirePermission(P.COURSE_VIEW)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      keyword, status, type,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post() @RequirePermission(P.COURSE_CREATE)
  create(@Body() data: any) { return this.service.create(data); }

  @Put(':id') @RequirePermission(P.COURSE_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id') @RequirePermission(P.COURSE_DELETE)
  delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
}
