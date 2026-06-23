import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ChaptersService } from './chapters.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/chapters')
export class ChaptersController {
  constructor(private service: ChaptersService) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findBySubject(@Query('subjectId', ParseIntPipe) subjectId: number) {
    return this.service.findBySubject(subjectId);
  }

  @Get(':id')
  @RequirePermission(Permissions.QUESTION_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.QUESTION_CREATE)
  create(@Body() data: { subjectId: number; name: string; sortOrder?: number }) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermission(Permissions.QUESTION_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; sortOrder?: number }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermission(Permissions.QUESTION_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
