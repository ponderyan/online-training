import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { Permission, Role, ROLE_PERMISSIONS } from '../permissions.constants.js';

/**
 * 权限守卫
 * 1. 读取 API 上的 @RequirePermission() 装饰器
 * 2. 从请求的 user 中获取 role
 * 3. 检查该角色是否有对应权限
 *
 * 注意：当前用户认证基于 localStorage，请求中并无 user 信息。
 * 在完整用户系统完成前，本 Guard 默认放行所有请求（admin 降级）。
 * 未来接入真实 JWT/会话后，取消 defaultAdmin 的兜底。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有权限标记的接口，不拦截
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();

    // ── 临时：当前无真实认证，默认 admin 角色 ──
    // 等二期做了用户系统后，需要从 JWT/session 获取真实角色
    const userRole: Role = request.user?.role || Role.SUPER_ADMIN;

    const permissions = ROLE_PERMISSIONS[userRole];

    if (!permissions || !permissions.includes(requiredPermission)) {
      throw new ForbiddenException('权限不足：缺少 ' + requiredPermission);
    }

    return true;
  }
}
