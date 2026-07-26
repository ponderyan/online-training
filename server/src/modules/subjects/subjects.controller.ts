import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Req } from '@nestjs/common';
import { SubjectsService } from './subjects.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/subjects')
export class SubjectsController {
  constructor(private service: SubjectsService) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findAll(@Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.findAllWithOwnership(isSuperAdmin ? null : orgId);
  }

  /** 活跃科目列表（供前端选择器使用，根据JWT orgId自动过滤可见范围） */
  @Get('active')
  @RequirePermission(Permissions.QUESTION_CREATE)
  findActive(@Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.findActive(isSuperAdmin ? null : orgId);
  }

  @Public()
  @Get('public')
  findPublic() { return this.service.findPublic(); }

  @Get(':id')
  @RequirePermission(Permissions.QUESTION_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.QUESTION_CREATE)
  create(@Body() data: { name: string; code: string; description?: string; sortOrder?: number; orgId?: number }, @Req() req: any) {
    // 自动归属：如果前端未传orgId，则取当前用户的orgId
    if (!data.orgId && req.user?.orgId) {
      data.orgId = req.user.orgId;
    }
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermission(Permissions.QUESTION_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; code?: string; description?: string; sortOrder?: number; isActive?: boolean }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermission(Permissions.QUESTION_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
