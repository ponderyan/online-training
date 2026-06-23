import { Controller, Get, Put, Post, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';

@Controller('api/user')
export class UserProfileController {
  constructor(private prisma: PrismaService) {}

  private getUserId(req: any): number {
    const user = req.user;
    if (!user) throw new UnauthorizedException('请先登录');
    return user.sub || user.id;
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const userId = this.getUserId(req);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, displayName: true, avatar: true,
        studentNumber: true, phone: true, email: true, organization: true,
        title: true, gender: true, idCard: true, remark: true,
        batchId: true, isActive: true, lastLoginAt: true, loginCount: true,
        createdAt: true, updatedAt: true,
        org: { select: { name: true } },
        batch: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');

    const submittedSessions = await this.prisma.examSession.count({ where: { studentId: userId, status: 'SUBMITTED' } });
    const passedCount = await this.prisma.examSession.count({ where: { studentId: userId, isPassed: true } });
    const certCount = await this.prisma.certificate.count({ where: { studentId: userId, isRevoked: false } });

    return {
      ...user,
      orgName: user.org?.name,
      stats: { examCount: submittedSessions, passedCount, certCount },
    };
  }

  @Put('profile')
  async updateProfile(
    @Body() data: {
      displayName?: string; phone?: string; email?: string;
      organization?: string; title?: string; gender?: string;
      remark?: string;
    },
    @Req() req: any,
  ) {
    const userId = this.getUserId(req);
    const upd: Record<string, any> = {};
    const fields = ['displayName', 'phone', 'email', 'organization', 'title',
      'gender', 'remark', 'avatar',
      'education', 'educationSchool', 'major', 'graduationDate',
      'professionalTitle', 'professionalLevel',
      'idCard'] as const;
    for (const f of fields) { if ((data as any)[f] !== undefined) upd[f] = (data as any)[f]; }

    return this.prisma.user.update({
      where: { id: userId },
      data: upd,
      select: { id: true, displayName: true, phone: true, email: true, organization: true, title: true, gender: true, remark: true },
    });
  }

  @Post('password')
  async changePassword(
    @Body() data: { oldPassword: string; newPassword: string },
    @Req() req: any,
  ) {
    const userId = this.getUserId(req);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    // 验证旧密码
    let isValid = false;
    if (user.passwordHash.startsWith('$2')) {
      isValid = await bcryptjs.compare(data.oldPassword, user.passwordHash);
    } else if (/^[a-f0-9]{32}$/i.test(user.passwordHash)) {
      isValid = crypto.createHash('md5').update(data.oldPassword).digest('hex') === user.passwordHash;
    } else {
      isValid = user.passwordHash === data.oldPassword;
    }
    if (!isValid) throw new BadRequestException('旧密码错误');

    if (data.newPassword.length < 8) throw new BadRequestException('新密码至少8位');
    if (!/[A-Z]/.test(data.newPassword)) throw new BadRequestException('新密码需包含大写字母');
    if (!/[a-z]/.test(data.newPassword)) throw new BadRequestException('新密码需包含小写字母');
    if (!/[0-9]/.test(data.newPassword)) throw new BadRequestException('新密码需包含数字');

    const passwordHash = await bcryptjs.hash(data.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { success: true, message: '密码已修改' };
  }
}
