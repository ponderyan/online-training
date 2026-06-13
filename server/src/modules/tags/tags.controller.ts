import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TagsService } from './tags.service.js';

@Controller('api/tags')
export class TagsController {
  constructor(private service: TagsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Post() create(@Body() data: { name: string; type: string }) { return this.service.create(data); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
