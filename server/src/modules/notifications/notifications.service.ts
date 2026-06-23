import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';

export { NotificationType };

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    referenceId?: number,
    referenceType?: string,
  ) {
    try {
      return await this.prisma.notification.create({
        data: { userId, type, title, message, referenceId, referenceType },
      });
    } catch (e) {
      console.error('[Notifications] 创建通知失败:', e);
    }
  }

  async createMany(
    userIds: number[],
    type: NotificationType,
    title: string,
    message: string,
    referenceId?: number,
    referenceType?: string,
  ) {
    if (userIds.length === 0) return;
    try {
      const data = userIds.map(userId => ({
        userId, type, title, message, referenceId, referenceType,
      }));
      await this.prisma.notification.createMany({ data });
    } catch (e) {
      console.error('[Notifications] 批量创建通知失败:', e);
    }
  }

  async createManyWithTemplate(
    userIds: number[],
    type: NotificationType,
    template: (userId: number) => { title: string; message: string; referenceId?: number; referenceType?: string },
  ) {
    if (userIds.length === 0) return;
    try {
      const data = userIds.map(userId => {
        const t = template(userId);
        return { userId, type, title: t.title, message: t.message, referenceId: t.referenceId, referenceType: t.referenceType };
      });
      await this.prisma.notification.createMany({ data });
    } catch (e) {
      console.error('[Notifications] 批量创建通知失败:', e);
    }
  }

  async findByUser(userId: number, params: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = { userId };
    if (params.unreadOnly) where.isRead = false;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getUnreadCount(userId: number) {
    try {
      return await this.prisma.notification.count({ where: { userId, isRead: false } });
    } catch { return 0; }
  }

  async markAsRead(id: number, userId: number) {
    try {
      return await this.prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true, readAt: new Date() },
      });
    } catch { return null; }
  }

  async markAllAsRead(userId: number) {
    try {
      return await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } catch { return null; }
  }
}
