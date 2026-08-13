import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SiteSettingsService } from '../site-settings/site-settings.service.js';

const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET) throw new Error('JWT_SECRET 环境变量未设置 — 请在 .env 中配置');
const JWT_SECRET: string = RAW_SECRET;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private siteSettings: SiteSettingsService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // ── 登录安全（★ 2026-08-13）：账号级锁定检查（连续输错 N 次锁定 M 分钟）──
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw new UnauthorizedException(`你的账号因连续输错密码已被临时锁定，请在 ${minutes} 分钟后再试`);
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
      // ── 登录安全：连续失败计数 → 达到阈值锁定（LOGIN_LOCK_ATTEMPTS / LOGIN_LOCK_MINUTES）──
      const lockAttempts = Number(process.env.LOGIN_LOCK_ATTEMPTS ?? 5);
      const lockMinutes = Number(process.env.LOGIN_LOCK_MINUTES ?? 10);
      const newCount = (user.failedLoginCount || 0) + 1;
      const lockedUntil = newCount >= lockAttempts
        ? new Date(Date.now() + lockMinutes * 60000)
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount, lockedUntil },
      });
      if (lockedUntil) {
        throw new UnauthorizedException(`连续输错 ${lockAttempts} 次，账号已锁定 ${lockMinutes} 分钟，请稍后再试`);
      }
      // 友好提示剩余尝试次数
      const remaining = lockAttempts - newCount;
      throw new UnauthorizedException(`用户名或密码错误，你还有 ${remaining} 次尝试机会`);
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
      expiresIn: (process.env.ACCESS_TOKEN_TTL || '2h') as any,
    });
    // refresh token：7 天，type 标记区分（防止被当作 access token 使用）
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
      { secret: JWT_SECRET, expiresIn: (process.env.REFRESH_TOKEN_TTL || '7d') as any },
    );

    // 更新登录统计 + 登录成功清零失败计数/解锁
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    return {
      accessToken,
      refreshToken,
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

  /**
   * 静默续期：用 refreshToken 换取新的 accessToken（并轮换 refreshToken）。
   * 解决"考试中 JWT 过期被踢出"问题——前端 401 时自动调用。
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('缺少 refreshToken');
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, { secret: JWT_SECRET });
    } catch {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('token 类型错误');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.isActive) throw new UnauthorizedException('用户不存在或已禁用');

    // ── 登录安全（★ 2026-08-13）：锁定中的账号禁止通过 refresh 续期绕过锁定 ──
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw new UnauthorizedException(`你的账号因连续输错密码已被临时锁定，请在 ${minutes} 分钟后再试`);
    }

    // 角色以数据库为准（refresh 期间角色可能变更）
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const roleCodes = roleAssignments.map(r => r.role.code);

    const newPayload = { sub: user.id, username: user.username, orgId: user.orgId, primaryAgencyId: user.primaryAgencyId, roles: roleCodes };
    const accessToken = this.jwtService.sign(newPayload, {
      secret: JWT_SECRET,
      expiresIn: (process.env.ACCESS_TOKEN_TTL || '2h') as any,
    });
    const newRefreshToken = this.jwtService.sign(
      { ...newPayload, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
      { secret: JWT_SECRET, expiresIn: (process.env.REFRESH_TOKEN_TTL || '7d') as any },
    );
    return { accessToken, refreshToken: newRefreshToken };
  }

  async register(data: { username: string; displayName: string; password: string; phone?: string; email?: string }) {
    // 参数校验
    if (!data.username || !data.password || !data.displayName) {
      throw new BadRequestException('缺少必要参数：username, password, displayName');
    }
    // 检查是否允许公开注册（★ 2026-08-13 统一策略：无 site_setting 行时默认关闭，
    // 有效设置以 siteSettings.get() 为准 —— 该 get() 在无行时返回 DEFAULTS(publicRegistration=false)）
    const siteSettings = await this.siteSettings.get();
    if (!siteSettings.publicRegistration) {
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
