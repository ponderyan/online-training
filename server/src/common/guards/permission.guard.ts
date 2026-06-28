import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { Permission, Role, ROLE_PERMISSIONS } from '../permissions.constants.js';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { requestContext } from '../utils/request-context.js';
import { Request } from 'express';

const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET) throw new Error('JWT_SECRET 环境变量未设置 — 请在 .env 中配置');
const JWT_SECRET: string = RAW_SECRET;

/**
 * 统一认证 + 权限守卫
 *
 * 行为逻辑：
 * - @Public() → 公开放行（无需 JWT，无需权限）
 * - @RequirePermission('xxx') → 需要 JWT + 有该权限
 * - 两者都没有 → 需要 JWT，但不检查具体权限（学员端等场景）
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // ── JWT 验证（先解码，让 @Public() 端点也能拿到 user）──
    const token = this.extractToken(request);
    if (token) {
      try {
        const payload = this.jwtService.verify(token, { secret: JWT_SECRET });
        (request as any).user = { id: payload.sub, ...payload };
      } catch {
        if (requiredPermission) {
          throw new UnauthorizedException('登录已过期，请重新登录');
        }
      }
    }

    // ── 检查 @Public() 装饰器（此时 req.user 已设，供 handler 使用）──
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ── 设置请求上下文（供审计日志使用）──
    const user = (request as any).user;
    if (user) {
      const ip = request.ip || request.headers['x-forwarded-for'] as string || '';
      const userRoles: string[] = user.roles || [];
      requestContext.enterWith({
        userId: user.id || user.sub,
        userName: user.displayName || user.username || '',
        ip,
        orgId: user.orgId || undefined,
        isSuperAdmin: userRoles.includes('SUPER_ADMIN'),
      });
    }

    // 没有权限标记 → JWT 验证通过即可放行（学员端接口）
    if (!requiredPermission) {
      if (!user) throw new UnauthorizedException('请先登录');
      return true;
    }

    // ── 权限检查 ──
    if (!user) {
      throw new UnauthorizedException('请先登录');
    }

    // 从 DB 实时查询角色（支持管理员修改角色后即时生效，无需重登）
    let userRoles: string[] = user.roles || [];
    const userId = user.sub || user.id;
    if (userId) {
      try {
        const dbAssignments = await this.prisma.userRoleAssignment.findMany({
          where: { userId },
          include: { role: { select: { code: true } } },
        });
        if (dbAssignments.length > 0) {
          userRoles = dbAssignments.map(a => a.role.code);
        }
      } catch {
        // 降级使用 JWT payload 中的角色
      }
    }

    // 策略1：查数据库 role_permissions 表（单次批量查询，避免 N+1）
    const dbPerms = await this.prisma.rolePermission.findMany({
      where: { role: { code: { in: userRoles } }, permission: requiredPermission },
    });
    if (dbPerms.some(p => p.isGranted)) return true;

    // 策略2：降级使用静态常量
    if (userRoles.some(roleCode => {
      const permissions = ROLE_PERMISSIONS[roleCode as keyof typeof ROLE_PERMISSIONS];
      return permissions?.includes(requiredPermission);
    })) return true;

    throw new ForbiddenException('权限不足：缺少 ' + requiredPermission);
  }

  private extractToken(request: Request): string | null {
    // 1) 优先取 Authorization header
    const auth = request.headers?.authorization;
    if (auth) {
      const [type, token] = auth.split(' ');
      if (type === 'Bearer') return token;
    }
    // 2) 降级到查询参数 ?token=（供 <video> 标签等无法设置 header 的场景使用）
    const queryToken = (request.query as any)?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) return queryToken;
    return null;
  }
}
