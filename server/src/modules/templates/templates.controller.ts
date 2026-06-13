import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service.js';

@Controller('api/templates')
export class TemplatesController {
  constructor(private service: TemplatesService) {}

  @Get()
  findAll(@Query('subjectId') subjectId?: string) {
    return this.service.findAll(subjectId ? parseInt(subjectId) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  create(@Body() data: any) { return this.service.create(data); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
