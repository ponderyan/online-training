import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  // ── 字面量路由必须声明在 :id 之前，避免被 :id 捕获 ──

  @Get()
  @RequirePermission(P.ORG_VIEW)
  findAll() { return this.service.findAll(); }

  @Get('tree')
  @RequirePermission(P.ORG_VIEW)
  getTree() { return this.service.getTree(); }

  @Get(':id')
  @RequirePermission(P.ORG_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Get(':id/data-scope')
  @RequirePermission(P.ORG_VIEW)
  getDataScope(@Param('id', ParseIntPipe) id: number) { return this.service.getDataScope(id); }

  @Get(':id/users')
  @RequirePermission(P.ORG_VIEW)
  getOrgUsers(@Param('id', ParseIntPipe) id: number) { return this.service.getOrgUsers(id); }

  @Post()
  @RequirePermission(P.ORG_CREATE)
  create(@Body() data: {
    name: string; code: string; parentId?: number | null;
    contactName?: string; contactPhone?: string; contactEmail?: string;
  }) {
    return this.service.create(data);
  }

  @Post('import')
  @RequirePermission(P.ORG_CREATE)
  importOrganizations(@Body() data: { rows: { name: string; parentName?: string; sortOrder?: number }[] }) {
    return this.service.importOrganizations(data.rows || []);
  }

  @Put(':id')
  @RequirePermission(P.ORG_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: {
    name?: string; contactName?: string; contactPhone?: string; contactEmail?: string;
    isActive?: boolean; sortOrder?: number;
  }) {
    return this.service.update(id, data);
  }

  @Put(':id/move')
  @RequirePermission(P.ORG_EDIT)
  move(@Param('id', ParseIntPipe) id: number, @Body() data: { newParentId: number | null }) {
    return this.service.move(id, data.newParentId);
  }

  @Delete(':id')
  @RequirePermission(P.ORG_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Post(':id/migrate-students')
  @RequirePermission(P.ORG_EDIT)
  migrateStudents(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { targetOrgId: number; moveHours?: boolean; moveExams?: boolean },
  ) {
    return this.service.migrateStudents(id, data.targetOrgId, { moveHours: data.moveHours, moveExams: data.moveExams });
  }
}
