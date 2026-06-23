import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.ORG_CREATE)
  create(@Body() data: { name: string; code: string; contactName?: string; contactPhone?: string; contactEmail?: string }) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermission(Permissions.ORG_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; contactName?: string; contactPhone?: string; contactEmail?: string; isActive?: boolean }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermission(Permissions.ORG_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
