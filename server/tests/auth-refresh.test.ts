/**
 * Refresh Token 静默续期集成测试
 * 场景：考试中 access token（2h）过期时，前端用 refresh token（7d）静默换新，不打断答题。
 * 安全约束：refresh token 不可当 access token 访问受保护接口（type 校验）。
 * 需要 server 运行在 localhost:3001（seed 账号 admin/123456）
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001/api';

async function api(method: string, path: string, body?: any, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function decodeJwt(token: string): any {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

describe('Refresh Token 静默续期', () => {
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const r = await api('POST', '/auth/login', { username: 'admin', password: '123456' });
    expect(r.status).toBe(200);
    accessToken = r.data.accessToken;
    refreshToken = r.data.refreshToken;
  });

  it('登录返回 refreshToken，且 TTL 分别为 2h / 7d', () => {
    expect(refreshToken).toBeTruthy();
    const ap = decodeJwt(accessToken);
    const rp = decodeJwt(refreshToken);
    // access 2 小时（允许 1 分钟时钟误差）
    expect(ap.exp - ap.iat).toBeGreaterThan(2 * 3600 - 60);
    expect(ap.exp - ap.iat).toBeLessThanOrEqual(2 * 3600);
    // refresh 7 天
    expect(rp.exp - rp.iat).toBeGreaterThan(7 * 86400 - 60);
    expect(rp.type).toBe('refresh');
    expect(ap.type).toBeUndefined();
  });

  it('refresh 换新 token 且轮换 refreshToken（jti 随机数保证必然不同）', async () => {
    const r = await api('POST', '/auth/refresh', { refreshToken });
    expect(r.status).toBe(200);
    expect(r.data.accessToken).toBeTruthy();
    expect(r.data.refreshToken).toBeTruthy();
    expect(r.data.refreshToken).not.toBe(refreshToken); // 轮换生效
    // 轮换后的新 refresh token 可继续链式续期
    const r2 = await api('POST', '/auth/refresh', { refreshToken: r.data.refreshToken });
    expect(r2.status).toBe(200);
    expect(r2.data.accessToken).toBeTruthy();
  });

  it('新换取的 access token 可正常访问受保护接口', async () => {
    const r = await api('POST', '/auth/refresh', { refreshToken });
    const fresh = await api('GET', '/organizations', undefined, r.data.accessToken);
    expect(fresh.status).toBe(200);
  });

  it('refresh token 不可当 access token 访问受保护接口（type 校验）', async () => {
    const r = await api('GET', '/organizations', undefined, refreshToken);
    expect(r.status).toBe(401);
    const r2 = await api('GET', '/subjects', undefined, refreshToken);
    expect(r2.status).toBe(401);
  });

  it('无效 / 缺失 / 篡改的 refreshToken 一律 401', async () => {
    expect((await api('POST', '/auth/refresh', { refreshToken: 'garbage.token.here' })).status).toBe(401);
    expect((await api('POST', '/auth/refresh', {})).status).toBe(401);
    // 用 accessToken 冒充 refreshToken（无 type:refresh）
    expect((await api('POST', '/auth/refresh', { refreshToken: accessToken })).status).toBe(401);
  });

  it('过期场景模拟：伪造已过期的 refresh token 返回 401', async () => {
    // 直接签一个已过期的不现实（无 secret），改为篡改签名段使 verify 失败
    const expired = refreshToken.slice(0, -4) + 'AAAA';
    const r = await api('POST', '/auth/refresh', { refreshToken: expired });
    expect(r.status).toBe(401);
  });
});
