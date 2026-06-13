import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.passwordHash !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // 一期简单登录，后期加 JWT + bcrypt
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }
}
