import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/templates')
export class TemplatesController {
  constructor(private service: TemplatesService) {}

  @Get()
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  findAll(@Query('subjectId') subjectId?: string) {
    return this.service.findAll(subjectId ? parseInt(subjectId) : undefined);
  }

  @Get(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  create(@Body() data: any) { return this.service.create(data); }

  @Put(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
