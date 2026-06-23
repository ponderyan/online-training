import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { SubjectsService } from './subjects.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/subjects')
export class SubjectsController {
  constructor(private service: SubjectsService) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findAll() { return this.service.findAll(); }

  @Public()
  @Get('public')
  findPublic() { return this.service.findPublic(); }

  @Get(':id')
  @RequirePermission(Permissions.QUESTION_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.QUESTION_CREATE)
  create(@Body() data: { name: string; code: string; dictionaryId: number; description?: string }) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermission(Permissions.QUESTION_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; description?: string; sortOrder?: number }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermission(Permissions.QUESTION_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
