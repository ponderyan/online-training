import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { TagsService } from './tags.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/tags')
export class TagsController {
  constructor(private service: TagsService) {}

  @Get() @RequirePermission(Permissions.QUESTION_CREATE) findAll() { return this.service.findAll(); }
  @Post() @RequirePermission(Permissions.QUESTION_CREATE) create(@Body() data: { name: string; type: string }) { return this.service.create(data); }
  @Put(':id') @RequirePermission(Permissions.QUESTION_EDIT) update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string }) { return this.service.update(id, data); }
  @Delete(':id') @RequirePermission(Permissions.QUESTION_DELETE) remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
