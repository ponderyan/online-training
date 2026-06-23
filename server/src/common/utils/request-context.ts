import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId?: number;
  userName?: string;
  ip?: string;
  orgId?: number;
  isSuperAdmin?: boolean;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
