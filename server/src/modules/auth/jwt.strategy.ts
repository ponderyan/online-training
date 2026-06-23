import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET) throw new Error('JWT_SECRET 环境变量未设置 — 请在 .env 中配置');
const JWT_SECRET: string = RAW_SECRET;

export interface JwtPayload {
  sub: number;       // userId
  username: string;
  orgId: number | null;
  roles: string[];   // 从 UserRoleAssignment 读取的角色 code 列表
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    // 从数据库验证用户仍然存在且激活
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.isActive) {
      throw new UnauthorizedException('用户不存在或已禁用');
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      orgId: user.orgId,
      roles: payload.roles,
      role: payload.roles?.[0] || 'STUDENT', // ♻ 兼容旧代码
    };
  }
}
