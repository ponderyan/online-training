import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET) throw new Error('JWT_SECRET 环境变量未设置 — 请在 .env 中配置');
const JWT_SECRET: string = RAW_SECRET;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 密码校验：bcrypt → MD5 → 明文 三种兼容
    let isPasswordValid = false;
    let isLegacyHash = false;

    if (user.passwordHash.startsWith('$2')) {
      // bcrypt hash
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } else if (/^[a-f0-9]{32}$/i.test(user.passwordHash)) {
      // MD5 hash（学员管理模块遗留）
      isPasswordValid = crypto.createHash('md5').update(password).digest('hex') === user.passwordHash;
      isLegacyHash = true;
    } else {
      // 明文密码（种子数据遗留）
      isPasswordValid = user.passwordHash === password;
      isLegacyHash = true;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 如果是旧格式密码，原地升级为 bcrypt hash
    if (isLegacyHash) {
      const hash = await bcrypt.hash(password, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      });
    }

    // 获取用户的多角色
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const roleCodes = roleAssignments.map(r => r.role.code);

    // 获取用户权限列表（用于前端侧边栏权限过滤）
    const dbPerms = await this.prisma.rolePermission.findMany({
      where: { role: { code: { in: roleCodes } } },
    });
    const userPermissions = [...new Set(dbPerms.filter(p => p.isGranted).map(p => p.permission))];

    const payload = { sub: user.id, username: user.username, orgId: user.orgId, primaryAgencyId: user.primaryAgencyId, roles: roleCodes };

    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_SECRET,
      expiresIn: '24h',
    });

    // 更新登录统计
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        orgId: user.orgId,
        primaryAgencyId: user.primaryAgencyId,
        roles: roleCodes,
        role: roleCodes[0] || 'STUDENT',
        permissions: userPermissions,
      },
    };
  }

  async register(data: { username: string; displayName: string; password: string; phone?: string; email?: string }) {
    // 检查是否允许公开注册
    const setting = await this.prisma.siteSetting.findFirst();
    if (setting && !setting.publicRegistration) {
      throw new UnauthorizedException('系统当前未开放公开注册');
    }
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new UnauthorizedException('用户名已存在');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        passwordHash,
        // role 已迁移到 UserRoleAssignment，新建用户默认给 STUDENT
        orgId: null, // 注册用户暂时没有机构，后续通过页面分配
        phone: data.phone || null,
        email: data.email || null,
        isActive: true,
      },
    });

    // 分配 STUDENT 角色
    const studentRole = await this.prisma.role.findUnique({ where: { code: 'STUDENT' } });
    if (studentRole) {
      await this.prisma.userRoleAssignment.create({
        data: { userId: user.id, roleId: studentRole.id },
      });
    }

    // 直接登录
    return this.login(data.username, data.password);
  }
}
