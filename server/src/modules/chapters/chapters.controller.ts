import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ChaptersService } from './chapters.service.js';

@Controller('api/chapters')
export class ChaptersController {
  constructor(private service: ChaptersService) {}

  @Get()
  findBySubject(@Query('subjectId', ParseIntPipe) subjectId: number) {
    return this.service.findBySubject(subjectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  create(@Body() data: { subjectId: number; name: string; sortOrder?: number }) {
    return this.service.create(data);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; sortOrder?: number }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
