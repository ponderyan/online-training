import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { DataDictionaryService } from './data-dictionary.service.js';

@Controller('api/data-dictionaries')
export class DataDictionaryController {
  constructor(private service: DataDictionaryService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Post() create(@Body() data: { code: string; name: string; sortOrder?: number }) {
    return this.service.create(data);
  }

  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; sortOrder?: number }) {
    return this.service.update(id, data);
  }

  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
