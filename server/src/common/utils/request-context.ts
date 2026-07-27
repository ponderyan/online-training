import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId?: number;
  userName?: string;
  ip?: string;
  orgId?: number;
  isSuperAdmin?: boolean;
  changeReason?: string; // 操作原因（强制/可选原因操作时由前端传入，写入 audit_logs.changeReason）
  eventSource?: string; // 操作来源标记（MANUAL / API / SYSTEM / CRON），未设时中间件按 userId 推断
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
