/**
 * AI 助教会话 CRUD + 越权隔离集成测试（HTTP，打 localhost:3001）
 * 前置：server 已运行（launchd com.foxlearn.server），测试期需验证码关闭（plist 注入 LOGIN_REQUIRE_CAPTCHA=false）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let token = '';
let createdId = 0;
const createdIds: number[] = [];

async function login(username: string, password = '123456') {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data: any = await res.json();
  expect(res.ok, `login ${username}: ${res.status} ${JSON.stringify(data)}`).toBe(true);
  return data.accessToken;
}

async function api(path: string, opts: { method?: string; body?: unknown; auth?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.auth ? { Authorization: `Bearer ${opts.auth}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

beforeAll(async () => {
  token = await login('stu001');
});

afterAll(async () => {
  // 清理测试会话（数据零残留纪律）
  for (const id of createdIds) {
    await api(`/ai/sessions/${id}`, { method: 'DELETE', auth: token }).catch(() => {});
  }
});

describe('AI 助教会话管理', () => {
  it('AI 状态：返回嵌入可用性与索引覆盖', async () => {
    const { status, json } = await api('/ai/status', { auth: token });
    expect(status).toBe(200);
    expect(typeof json.embeddingAvailable).toBe('boolean');
    expect(typeof json.total).toBe('number');
    expect(typeof json.indexedRatio).toBe('number');
  });

  it('创建会话 → 列表可见 → 详情派生消息正确 → 删除', async () => {
    const created = await api('/ai/sessions', { method: 'POST', auth: token, body: {} });
    expect(created.status).toBe(201);
    expect(created.json.id).toBeGreaterThan(0);
    createdId = created.json.id;
    createdIds.push(createdId);

    const list = await api('/ai/sessions', { auth: token });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json)).toBe(true);
    const mine = list.json.find((s: any) => s.id === createdId);
    expect(mine).toBeDefined();
    expect(mine.title).toBe('新对话');
    expect(mine.messageCount).toBe(0);

    const detail = await api(`/ai/sessions/${createdId}`, { auth: token });
    expect(detail.status).toBe(200);
    expect(detail.json.id).toBe(createdId);
    expect(Array.isArray(detail.json.messages)).toBe(true);

    const del = await api(`/ai/sessions/${createdId}`, { method: 'DELETE', auth: token });
    expect(del.status).toBe(200);
    const after = await api(`/ai/sessions`, { auth: token });
    expect(after.json.some((s: any) => s.id === createdId)).toBe(false);
  });

  it('未登录访问会话 → 401', async () => {
    const { status } = await api('/ai/sessions');
    expect(status).toBe(401);
  });

  it('越权隔离：stu002 无法访问/删除 stu001 的会话', async () => {
    const t2 = await login('stu002');
    const created = await api('/ai/sessions', { method: 'POST', auth: token, body: { title: '隔离测试' } });
    createdIds.push(created.json.id);

    const get = await api(`/ai/sessions/${created.json.id}`, { auth: t2 });
    expect(get.status).toBe(404);

    const del = await api(`/ai/sessions/${created.json.id}`, { method: 'DELETE', auth: t2 });
    expect(del.status).toBe(404);

    // 本人仍可访问
    const mine = await api(`/ai/sessions/${created.json.id}`, { auth: token });
    expect(mine.status).toBe(200);
  });

  it('不存在的会话 → 404', async () => {
    const { status } = await api('/ai/sessions/999999', { auth: token });
    expect(status).toBe(404);
  });

  it('重建嵌入索引（学生无权限 → 403）', async () => {
    const { status } = await api('/ai/embedding/rebuild', { method: 'POST', auth: token });
    expect(status).toBe(403);
  });
});
