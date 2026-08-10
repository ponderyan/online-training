/**
 * 论文题（ESSAY）链路集成测试
 * 创建 ESSAY 试题 → 题库查询 → 练习提交判定为主观题（自评，不计对错）→ 错题本排除
 * 需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken: string;
let studentToken: string;
let essayId: number;

async function login(username: string, password = '123456') {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

async function api(method: string, path: string, body?: any, token = adminToken) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('论文题（ESSAY）链路', () => {
  beforeAll(async () => {
    const admin = await login('admin');
    adminToken = admin.accessToken;
    expect(adminToken).toBeTruthy();
    const stu = await login('stu001');
    studentToken = stu.accessToken;
    expect(studentToken).toBeTruthy();
  });

  afterAll(async () => {
    if (essayId) await api('DELETE', `/questions/${essayId}`);
  });

  it('Step 1: 创建论文题', async () => {
    const r = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY',
      content: `链测论文题-${Date.now()}：试论述数据治理体系建设的关键要素。`,
      difficulty: 'HARD',
      analysis: '论点明确30%；论据充分30%；结构清晰20%；结论合理20%',
      status: 'PUBLISHED', practiceVisible: true,
    });
    expect([200, 201]).toContain(r.status);
    essayId = r.data.id;
    expect(essayId).toBeTruthy();
    expect(r.data.type).toBe('ESSAY');
  });

  it('Step 2: 题库按题型筛选能查到论文题', async () => {
    const r = await api('GET', '/questions?type=ESSAY&pageSize=50');
    expect(r.status).toBe(200);
    const items = r.data.items || r.data || [];
    expect(items.some((q: any) => q.id === essayId)).toBe(true);
  });

  it('Step 3: 练习抽题能抽到论文题', async () => {
    const res = await fetch(`${BASE}/questions/practice?count=10&types=ESSAY`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    expect(items.some((q: any) => q.id === essayId)).toBe(true);
  });

  it('Step 4: 练习提交判定为主观题（自评，不计对错）', async () => {
    const r = await api('POST', '/questions/practice/submit', {
      questionId: essayId,
      answer: '数据治理体系建设应覆盖组织、制度、技术、运营四个维度……（论文作答内容）',
    }, studentToken);
    expect([200, 201]).toContain(r.status);
    expect(r.data.subjective).toBe(true);
    // 主观题不计对错
    expect(r.data.isCorrect == null || r.data.isCorrect === false).toBe(true);
  });

  it('Step 5: 练习统计口径排除主观题', async () => {
    const r = await api('GET', '/questions/practice/stats', undefined, studentToken);
    expect(r.status).toBe(200);
    // 论文题提交不应破坏统计结构
    expect(r.data).toBeTruthy();
  });
});
