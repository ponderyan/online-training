import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JWT 认证守卫
 * 从 Authorization: Bearer <token> 提取并验证 JWT
 * 验证通过后将用户信息附加到 request.user
 *
 * 使用 @Public() 装饰器的路由跳过认证（待实现）
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 检查是否有 @Public() 装饰器（跳过认证的路由）
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }
}
