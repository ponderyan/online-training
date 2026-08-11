import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { WebSocket, WebSocketServer as WsServer } from 'ws';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProctoringService } from '../exams/proctoring.service.js';
import { ExamAccessService } from '../../common/services/exam-access.service.js';
import { Permissions, ROLE_PERMISSIONS } from '../../common/permissions.constants.js';
import { appEvents } from '../../common/events/app-events.js';
import { appLogger } from '../../common/logging/app-logger.js';

const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET) throw new Error('JWT_SECRET 环境变量未设置 — 请在 .env 中配置');
const JWT_SECRET: string = RAW_SECRET;

const BOARD_PUSH_DEBOUNCE_MS = 600;   // exam:changed 事件防抖窗口
const BOARD_SWEEP_INTERVAL_MS = 5000; // 兜底定时推送（感知在线/离线切换）

interface SocketAuth {
  userId: number;
  orgId: number | null;
  roles: string[];
  displayName?: string;
}

/**
 * 监考大屏 WebSocket 网关（原生 ws 协议，客户端用浏览器原生 WebSocket）
 *
 * 协议（JSON 文本帧）：
 * 注意：@nestjs/platform-ws 的消息协议为 { event, data } 双层结构，
 * @MessageBody() 注入的是 data 字段内容。
 *   C→S { event:'auth', data:{ token } }              → S→C { event:'auth:ok' } | { event:'error', message }
 *   C→S { event:'subscribe', data:{ examId } }        → 鉴权通过后加入房间，立即下发 { event:'board:update' }
 *   C→S { event:'unsubscribe', data:{ examId } }
 *   C→S { event:'ping' }                              → S→C { event:'pong' }
 *   S→C { event:'board:update', examId, data }
 *
 * 推送触发：业务侧 emitExamChanged(examId)（心跳/交卷/监考操作）防抖推送 + 5s 定时兜底。
 */
@WebSocketGateway({ path: '/ws/proctoring' })
export class ProctoringWsGateway implements OnModuleInit, OnModuleDestroy, OnGatewayDisconnect {
  @WebSocketServer() server!: WsServer;

  /** socket → 认证信息 */
  private authMap = new WeakMap<WebSocket, SocketAuth>();
  /** examId → 订阅该考试大屏的 socket 集合 */
  private rooms = new Map<number, Set<WebSocket>>();
  /** examId → 防抖定时器 */
  private debounceTimers = new Map<number, NodeJS.Timeout>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private proctoringService: ProctoringService,
    private examAccess: ExamAccessService,
  ) {}

  onModuleInit() {
    appEvents.on('exam:changed', this.onExamChanged);
    this.sweepTimer = setInterval(() => this.sweep(), BOARD_SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    appEvents.off('exam:changed', this.onExamChanged);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const t of this.debounceTimers.values()) clearTimeout(t);
  }

  // ── 消息处理 ──────────────────────────────────────────

  @SubscribeMessage('auth')
  async handleAuth(@MessageBody() data: { token?: string }, @ConnectedSocket() client: WebSocket) {
    try {
      const token = data?.token;
      if (!token) throw new Error('缺少 token');
      const payload: any = this.jwtService.verify(token, { secret: JWT_SECRET });
      if (payload.type === 'refresh') throw new Error('refresh token 不可用于 WebSocket');
      const userId = Number(payload.sub);

      // 从 DB 实时查询角色（与 PermissionGuard 保持一致）
      let roles: string[] = payload.roles || [];
      const assignments = await this.prisma.userRoleAssignment.findMany({
        where: { userId },
        include: { role: { select: { code: true } } },
      });
      if (assignments.length > 0) roles = assignments.map(a => a.role.code);

      this.authMap.set(client, { userId, orgId: payload.orgId ?? null, roles, displayName: payload.displayName });
      this.send(client, { event: 'auth:ok' });
    } catch (e: any) {
      this.send(client, { event: 'error', message: '认证失败：' + (e?.message || '无效凭证') });
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(@MessageBody() data: { examId?: number }, @ConnectedSocket() client: WebSocket) {
    const examId = Number(data?.examId);
    const auth = this.authMap.get(client);
    if (!auth) return this.send(client, { event: 'error', message: '请先认证' });
    if (!Number.isFinite(examId) || examId <= 0) return this.send(client, { event: 'error', message: 'examId 无效' });

    try {
      const ok = await this.hasPermission(auth.roles, Permissions.PROCTOR_VIEW);
      if (!ok) throw new Error('权限不足：缺少 proctor:view');
      await this.examAccess.assertAccess(examId, auth.orgId, auth.roles as any);

      if (!this.rooms.has(examId)) this.rooms.set(examId, new Set());
      this.rooms.get(examId)!.add(client);
      // 立即下发一次全量
      const board = await this.proctoringService.getBoard(examId);
      this.send(client, { event: 'board:update', examId, data: board });
      appLogger.info({ type: 'ws', event: 'board_subscribed', examId, userId: auth.userId });
    } catch (e: any) {
      this.send(client, { event: 'error', message: e?.message || '订阅失败' });
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@MessageBody() data: { examId?: number }, @ConnectedSocket() client: WebSocket) {
    this.leaveRoom(client, Number(data?.examId));
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: WebSocket) {
    this.send(client, { event: 'pong' });
  }

  /** 连接关闭清理（WsAdapter 不触发装饰器，需手动挂接） */
  handleDisconnect(client: WebSocket) {
    for (const [examId, set] of this.rooms) {
      set.delete(client);
      if (set.size === 0) this.rooms.delete(examId);
    }
  }

  // ── 推送 ──────────────────────────────────────────────

  private onExamChanged = (examId: number) => {
    if (!this.rooms.has(examId)) return; // 无人订阅，不产生查询
    const prev = this.debounceTimers.get(examId);
    if (prev) clearTimeout(prev);
    this.debounceTimers.set(examId, setTimeout(() => {
      this.debounceTimers.delete(examId);
      void this.pushBoard(examId);
    }, BOARD_PUSH_DEBOUNCE_MS));
  };

  /** 兜底扫描：所有有订阅者的考试定时推一次（感知在线/离线切换、剩余时间） */
  private sweep() {
    for (const examId of this.rooms.keys()) void this.pushBoard(examId);
  }

  private async pushBoard(examId: number) {
    const set = this.rooms.get(examId);
    if (!set || set.size === 0) return;
    try {
      const board = await this.proctoringService.getBoard(examId);
      const frame = JSON.stringify({ event: 'board:update', examId, data: board });
      for (const client of set) {
        if (client.readyState === client.OPEN) client.send(frame);
      }
    } catch {
      // 考试可能已被删除：清掉房间
      this.rooms.delete(examId);
    }
  }

  // ── 工具 ──────────────────────────────────────────────

  private hasPermission(roles: string[], required: string): Promise<boolean> | boolean {
    return (async () => {
      try {
        const dbPerms = await this.prisma.rolePermission.findMany({
          where: { role: { code: { in: roles } }, permission: required },
        });
        if (dbPerms.some(p => p.isGranted)) return true;
      } catch { /* 降级静态常量 */ }
      return roles.some(code => (ROLE_PERMISSIONS as any)[code]?.includes(required));
    })();
  }

  private leaveRoom(client: WebSocket, examId: number) {
    const set = this.rooms.get(examId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) this.rooms.delete(examId);
  }

  private send(client: WebSocket, payload: any) {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(payload));
  }
}
