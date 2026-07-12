import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P, PERM_CATEGORIES } from '../../common/permissions.constants.js';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  // ═══ 角色管理 ═══

  @Get('roles')
  @RequirePermission(P.ROLE_VIEW)
  getRoles() {
    return this.service.getRoles();
  }

  @Post('roles')
  @RequirePermission(P.ROLE_CREATE)
  createRole(@Body() data: { name: string; code: string; description?: string; color?: string; copyFromRoleId?: number }) {
    return this.service.createRole(data);
  }

  @Put('roles/:id')
  @RequirePermission(P.ROLE_EDIT)
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; description?: string; isActive?: boolean; color?: string },
  ) {
    return this.service.updateRole(id, data);
  }

  @Delete('roles/:id')
  @RequirePermission(P.ROLE_DELETE)
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteRole(id);
  }

  /** 获取角色下的用户列表 */
  @Get('roles/:id/users')
  @RequirePermission(P.ROLE_VIEW)
  getRoleUsers(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getRoleUsers(id, page ? parseInt(page) : 1, pageSize ? parseInt(pageSize) : 20, search);
  }

  /** 为角色添加用户 */
  @Post('roles/:id/users')
  @RequirePermission(P.ROLE_EDIT)
  addRoleUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { userId: number },
  ) {
    return this.service.addUserRole(data.userId, id);
  }

  /** 从角色移除用户 */
  @Delete('roles/:roleId/users/:assignmentId')
  @RequirePermission(P.ROLE_EDIT)
  removeRoleUser(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return this.service.removeUserRole(assignmentId);
  }

  /** 搜索用户（用于「添加成员到角色」） */
  @Get('users/search')
  @RequirePermission(P.ROLE_VIEW)
  searchUsers(@Query('q') q?: string, @Query('excludeRoleId') excludeRoleId?: string) {
    return this.service.searchUsers(
      (q || '').trim(),
      excludeRoleId ? parseInt(excludeRoleId) : undefined,
    );
  }

  // ═══ 权限映射 ═══

  @Get('categories')
  @RequirePermission(P.ROLE_VIEW)
  getCategories() {
    return PERM_CATEGORIES;
  }

  @Get()
  @RequirePermission(P.ROLE_VIEW)
  getAll() {
    return this.service.getAll();
  }

  @Post('seed')
  @RequirePermission(P.SYSTEM_CONFIG)
  seed() {
    return this.service.seed();
  }

  @Put(':roleId')
  @RequirePermission(P.ROLE_EDIT)
  updateRolePerms(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() data: { permissions: { permission: string; granted: boolean }[] },
  ) {
    return this.service.updateRolePerms(roleId, data.permissions);
  }
}
