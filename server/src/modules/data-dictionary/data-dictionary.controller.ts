import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { DataDictionaryService } from './data-dictionary.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/data-dictionaries')
export class DataDictionaryController {
  constructor(private service: DataDictionaryService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Post() @RequirePermission(Permissions.SYSTEM_DICTIONARY) create(@Body() data: { code: string; name: string; sortOrder?: number }) {
    return this.service.create(data);
  }

  @Put(':id') @RequirePermission(Permissions.SYSTEM_DICTIONARY) update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; sortOrder?: number }) {
    return this.service.update(id, data);
  }

  @Delete(':id') @RequirePermission(Permissions.SYSTEM_DICTIONARY) remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
