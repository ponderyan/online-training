import { Controller, Get, Post, Patch, Param, Body, Query, ParseIntPipe, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission(Permissions.NOTIFICATION_VIEW)
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const user = (req as any).user;
    if (!user?.id) return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    return this.service.findByUser(user.id, {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const user = (req as any).user;
    if (!user?.id) return { count: 0 };
    const count = await this.service.getUnreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const user = (req as any).user;
    if (!user?.id) return { success: false };
    await this.service.markAsRead(id, user.id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    const user = (req as any).user;
    if (!user?.id) return { success: false };
    await this.service.markAllAsRead(user.id);
    return { success: true };
  }

  /** 管理员发送消息 */
  @Post('send')
  @RequirePermission(Permissions.NOTICE_MANAGE)
  async sendMessage(@Body() dto: { userIds: number[]; title: string; message: string; type: string }, @Req() req: any) {
    const admin = (req as any).user;
    if (!admin?.id) return { success: false, error: '未登录' };
    if (!dto.userIds?.length || !dto.title || !dto.message) return { success: false, error: '参数不完整' };

    await this.service.createMany(dto.userIds, dto.type as any, dto.title, dto.message);

    return { success: true, sentCount: dto.userIds.length };
  }

  /** 获取消息发送候选用户 */
  @Get('candidates')
  @RequirePermission(Permissions.NOTICE_MANAGE)
  async getCandidates(
    @Query('role') role?: string,
    @Query('batchId') batchId?: string,
    @Query('search') search?: string,
  ) {
    const where: any = { isActive: true };
    if (role) where.roleAssignments = { some: { role: { code: role } } };
    if (batchId) where.batchId = parseInt(batchId);
    if (search) {
      where.OR = [
        { displayName: { contains: search } },
        { username: { contains: search } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, displayName: true, phone: true },
      take: 200,
      orderBy: { displayName: 'asc' },
    });

    return users;
  }
}
