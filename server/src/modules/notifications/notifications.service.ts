import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';

export { NotificationType };

/** createMany 的返回结果：真实成功/失败计数 + 批次标识 */
export interface CreateManyResult {
  sent: number;
  failed: number;
  batchId?: string;
}

/** 单个通道的状态计数 */
interface ChannelStats {
  sent: number;
  failed: number;
  pending: number;
  disabled: number;
}

/** 发送记录按批次聚合后的分组 */
export interface SentHistoryBatch {
  batchId: string | null;
  title: string;
  type: NotificationType;
  message: string;
  createdAt: Date;
  recipientCount: number;
  channels: { in_app: ChannelStats; email: ChannelStats; sms: ChannelStats };
  /** 前 N 个收件人姓名（列表展示用） */
  recipients: { id: number; displayName: string }[];
  /** 展开后的逐收件人明细 */
  notifications: {
    id: number;
    userId: number;
    displayName: string;
    channels: { channel: string; status: string; errorMessage: string | null; sentAt: Date | null }[];
  }[];
}

const EMAIL_CONFIG_KEYS = ['email_smtp_host', 'email_smtp_port', 'email_user', 'email_pass', 'email_from'];
const EMAIL_CONFIG_TTL_MS = 60_000;
const RECIPIENT_PREVIEW = 3;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // transporter 单例 + 邮件配置缓存（避免每次发信都新建 transporter、重查 5 行配置）
  private transporterCache: any = null;
  private transporterConfigKey = '';
  private emailConfig: Map<string, string> | null = null;
  private emailConfigAt = 0;

  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    referenceId?: number,
    referenceType?: string,
    channels?: { inApp?: boolean; email?: boolean; sms?: boolean },
    senderId?: number,
  ): Promise<CreateManyResult> {
    return this.createMany([userId], type, title, message, referenceId, referenceType, channels, senderId);
  }

  /**
   * 批量创建通知。站内信同步落库并返回真实 sent/failed 计数；
   * email/sms 通道先以 PENDING 写入，随后后台异步发送（fire-and-forget）。
   */
  async createMany(
    userIds: number[],
    type: NotificationType,
    title: string,
    message: string,
    referenceId?: number,
    referenceType?: string,
    channels?: { inApp?: boolean; email?: boolean; sms?: boolean },
    senderId?: number,
  ): Promise<CreateManyResult> {
    if (userIds.length === 0) return { sent: 0, failed: 0 };

    // type 白名单校验：非法值会导致 Prisma 抛错被吞掉，这里提前拦截并计为全部失败
    if (!this.isValidType(type)) {
      console.error(`[Notifications] 非法通知类型: ${type}，已跳过 ${userIds.length} 条`);
      return { sent: 0, failed: userIds.length };
    }

    // 群发场景生成批次标识，便于发送记录按批次聚合展示
    const batchId = userIds.length > 1
      ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : undefined;

    const wantInApp = channels?.inApp !== false; // 默认发站内信，仅在显式 false 时跳过
    const wantEmail = !!channels?.email;
    const wantSms = !!channels?.sms;

    let sent = 0;
    let failed = 0;
    let hasPendingExternal = false; // 是否有待后台发送的 email/sms

    for (const uid of userIds) {
      try {
        // 1. 创建站内信通知
        const notif = await this.prisma.notification.create({
          data: { userId: uid, type, title, message, referenceId, referenceType, senderId, batchId },
        });

        // 2. in_app 通道（默认写入，标记 SENT）
        if (wantInApp) {
          await this.prisma.notificationChannel.create({
            data: { notificationId: notif.id, channel: 'in_app', status: 'SENT', sentAt: new Date() },
          });
        }

        // 3. 邮件通道：先 PENDING 落库，后台异步发送
        if (wantEmail) {
          await this.prisma.notificationChannel.create({
            data: { notificationId: notif.id, channel: 'email', status: 'PENDING' },
          });
          hasPendingExternal = true;
        }

        // 4. 短信通道：先 PENDING 落库，后台异步发送
        if (wantSms) {
          await this.prisma.notificationChannel.create({
            data: { notificationId: notif.id, channel: 'sms', status: 'PENDING' },
          });
          hasPendingExternal = true;
        }

        sent++;
      } catch (e) {
        failed++;
        console.error(`[Notifications] 发送失败 userId=${uid}:`, e);
      }
    }

    // 后台异步派发 email/sms（不阻塞调用方）
    if (hasPendingExternal) {
      void this.dispatchPendingChannels();
    }

    return { sent, failed, batchId };
  }

  private isValidType(t: string): t is NotificationType {
    return (Object.values(NotificationType) as string[]).includes(t);
  }

  // ═══════════════ 后台异步派发 ═══════════════

  /** 取出所有 PENDING 的 email/sms 通道，串行发送并更新状态。 */
  private async dispatchPendingChannels() {
    try {
      const pending = await this.prisma.notificationChannel.findMany({
        where: { status: 'PENDING', channel: { in: ['email', 'sms'] } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });

      for (const ch of pending) {
        try {
          if (ch.channel === 'email') {
            await this.dispatchEmailChannel(ch.id, ch.notificationId);
          } else {
            await this.dispatchSmsChannel(ch.id, ch.notificationId);
          }
        } catch (e) {
          // 单条失败不中断后续；状态已在子方法内更新为 FAILED
          console.error(`[Notifications] 派发异常 channelId=${ch.id}:`, e);
        }
      }
    } catch (e) {
      console.error('[Notifications] dispatchPendingChannels 失败:', e);
    }
  }

  private async dispatchEmailChannel(channelId: number, notificationId: number) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true, title: true, message: true },
    });
    if (!notif) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: '通知不存在' } });
      return;
    }
    const user = await this.prisma.user.findUnique({ where: { id: notif.userId }, select: { email: true } });
    if (!user?.email) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: '用户无邮箱' } });
      return;
    }
    try {
      await this.sendEmail(user.email, notif.title, notif.message);
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'SENT', sentAt: new Date() } });
    } catch (e: any) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: e.message } });
    }
  }

  private async dispatchSmsChannel(channelId: number, notificationId: number) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true, message: true },
    });
    if (!notif) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: '通知不存在' } });
      return;
    }
    const enabled = await this.isSmsEnabled();
    if (!enabled) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'DISABLED' } });
      return;
    }
    const user = await this.prisma.user.findUnique({ where: { id: notif.userId }, select: { phone: true } });
    if (!user?.phone) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: '用户无手机号' } });
      return;
    }
    try {
      await this.sendSms(user.phone, notif.message);
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'SENT', sentAt: new Date() } });
    } catch (e: any) {
      await this.prisma.notificationChannel.update({ where: { id: channelId }, data: { status: 'FAILED', errorMessage: e.message } });
    }
  }

  // ═══════════════ 邮件通道 ═══════════════

  private async getEmailConfig(): Promise<Map<string, string>> {
    const now = Date.now();
    if (this.emailConfig && now - this.emailConfigAt < EMAIL_CONFIG_TTL_MS) {
      return this.emailConfig;
    }
    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: EMAIL_CONFIG_KEYS } },
    });
    this.emailConfig = new Map(configs.map(c => [c.key, c.value]));
    this.emailConfigAt = now;
    return this.emailConfig;
  }

  private async sendEmail(to: string, subject: string, body: string) {
    const cfg = await this.getEmailConfig();
    const host = cfg.get('email_smtp_host');
    if (!host) throw new Error('SMTP 未配置');

    const configKey = `${host}:${cfg.get('email_smtp_port')}:${cfg.get('email_user')}`;
    // 配置未变则复用 transporter，避免每封信新建连接
    if (!this.transporterCache || this.transporterConfigKey !== configKey) {
      this.transporterCache = nodemailer.createTransport({
        host,
        port: parseInt(cfg.get('email_smtp_port') || '587'),
        secure: cfg.get('email_smtp_port') === '465',
        auth: {
          user: cfg.get('email_user') || '',
          pass: cfg.get('email_pass') || '',
        },
      });
      this.transporterConfigKey = configKey;
    }

    await this.transporterCache.sendMail({
      from: cfg.get('email_from') || 'noreply@foxlearn.cn',
      to,
      subject,
      html: body.replace(/\n/g, '<br/>'),
    });
  }

  // ═══════════════ 短信通道 ═══════════════

  private async sendSms(phone: string, message: string) {
    console.log(`[Notifications] SMS 通道已就绪（未激活）：to=${phone} msg=${message.substring(0, 20)}...`);
    // 短信 SDK 集成处（阿里云/腾讯云）：
    // const accessKey = await this.getConfig('sms_access_key');
    // const secretKey = await this.getConfig('sms_secret_key');
    // const sign = await this.getConfig('sms_sign');
    // const template = await this.getConfig('sms_template_code');
    // await aliyunSms.send({ phone, sign, template, params: { message } });
  }

  private async isSmsEnabled(): Promise<boolean> {
    try {
      const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'sms_enabled' } });
      return cfg?.value === 'true';
    } catch { return false; }
  }

  // ═══════════════ 查询 API ═══════════════

  /**
   * 发送记录按批次聚合。同一 batchId 的多条通知归为一组，
   * 便于管理员查看「一次群发的整体送达情况」。
   */
  async getSentHistory(senderId: number, params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;

    const all = await this.prisma.notification.findMany({
      where: { senderId },
      include: {
        user: { select: { displayName: true } },
        channels: { select: { channel: true, status: true, errorMessage: true, sentAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 按 batchId 分组：有 batchId 的归到同一组，无 batchId 的各自独立成组（单条/系统通知）
    const groupMap = new Map<string, typeof all>();
    for (const n of all) {
      const key = n.batchId ?? `single-${n.id}`;
      const arr = groupMap.get(key);
      if (arr) arr.push(n);
      else groupMap.set(key, [n]);
    }

    // 每组用组内最新（首条，因已按 createdAt desc）的代表信息
    const groups: SentHistoryBatch[] = [];
    for (const [, arr] of groupMap) {
      const first = arr[0];
      groups.push(this.toBatchGroup(first.batchId, arr));
    }

    const total = groups.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const items = groups.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  private toBatchGroup(batchId: string | null, arr: any[]): SentHistoryBatch {
    const first = arr[0];
    const channels: SentHistoryBatch['channels'] = {
      in_app: { sent: 0, failed: 0, pending: 0, disabled: 0 },
      email: { sent: 0, failed: 0, pending: 0, disabled: 0 },
      sms: { sent: 0, failed: 0, pending: 0, disabled: 0 },
    };
    const notifications = arr.map(n => {
      for (const ch of n.channels as any[]) {
        const bucket = channels[ch.channel as keyof typeof channels];
        if (!bucket) continue;
        const key = (ch.status as string).toLowerCase() as keyof ChannelStats;
        if (key in bucket) bucket[key]++;
      }
      return {
        id: n.id,
        userId: n.userId,
        displayName: n.user?.displayName || `#${n.userId}`,
        channels: (n.channels as any[]).map((ch: any) => ({
          channel: ch.channel,
          status: ch.status,
          errorMessage: ch.errorMessage,
          sentAt: ch.sentAt,
        })),
      };
    });

    const recipients = notifications
      .slice(0, RECIPIENT_PREVIEW)
      .map(n => ({ id: n.userId, displayName: n.displayName }));

    return {
      batchId,
      title: first.title,
      type: first.type,
      message: first.message,
      createdAt: first.createdAt,
      recipientCount: arr.length,
      channels,
      recipients,
      notifications,
    };
  }

  async getChannelsByNotificationId(id: number) {
    return this.prisma.notificationChannel.findMany({ where: { notificationId: id } });
  }

  // ═══════════════ 原有方法（保持不变） ═══════════════

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
