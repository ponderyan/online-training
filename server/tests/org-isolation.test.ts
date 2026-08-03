/**
 * 组织隔离集成测试（作业单 v2 任务2 项3）
 * 两个不同 org 的管理员互相看不到对方的数据（学员/题库/试卷/统计）
 * 使用 seed 账号：branch_admin(org5 ORG_ADMIN) / dept_admin(org6 ORG_ADMIN) / admin(SUPER_ADMIN)
 * 注：系统无用户删除端点，测试学员用时间戳命名；CI 每次全新库，本地残留无害
 * 需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken: string;   // SUPER_ADMIN
let org5Token: string;    // branch_admin (org5)
let org6Token: string;    // dept_admin (org6)

let stuOrg5Id: number;    // 动态创建的 org5 学员
let stuOrg6Id: number;    // 动态创建的 org6 学员
const suffix = Date.now();
const usernameOrg5 = `isotest_a_${suffix}`;
const usernameOrg6 = `isotest_b_${suffix}`;

async function login(username: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
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

describe('组织隔离', () => {
  beforeAll(async () => {
    adminToken = (await login('admin')).accessToken;
    org5Token = (await login('branch_admin')).accessToken;
    org6Token = (await login('dept_admin')).accessToken;
    expect(adminToken).toBeTruthy();
    expect(org5Token).toBeTruthy();
    expect(org6Token).toBeTruthy();

    // 超管分别在 org5 / org6 创建一名学员
    const r1 = await api('POST', '/users', {
      username: usernameOrg5, password: '123456', displayName: '隔离测试A',
      roles: ['STUDENT'], orgId: 5,
    });
    expect([200, 201]).toContain(r1.status);
    stuOrg5Id = r1.data.id;

    const r2 = await api('POST', '/users', {
      username: usernameOrg6, password: '123456', displayName: '隔离测试B',
      roles: ['STUDENT'], orgId: 6,
    });
    expect([200, 201]).toContain(r2.status);
    stuOrg6Id = r2.data.id;
  });

  it('学员列表隔离：org5 只见本组织学员，看不到 org6 的', async () => {
    const { status, data } = await api('GET', '/students?pageSize=100', undefined, org5Token);
    expect(status).toBe(200);
    const ids = (data.items || []).map((s: any) => s.id);
    // ★ 功能结果断言：本组织学员可见，对方组织学员不可见
    expect(ids).toContain(stuOrg5Id);
    expect(ids).not.toContain(stuOrg6Id);
  });

  it('学员列表隔离：org6 只见本组织学员，看不到 org5 的', async () => {
    const { status, data } = await api('GET', '/students?pageSize=100', undefined, org6Token);
    expect(status).toBe(200);
    const ids = (data.items || []).map((s: any) => s.id);
    expect(ids).toContain(stuOrg6Id);
    expect(ids).not.toContain(stuOrg5Id);
  });

  it('跨组织按 ID 直读学员详情被拒（防 IDOR）', async () => {
    // org5 管理员读 org6 学员 → 404（不泄露存在性）
    const r1 = await api('GET', `/students/${stuOrg6Id}`, undefined, org5Token);
    expect(r1.status).toBe(404);
    // 反向同理
    const r2 = await api('GET', `/students/${stuOrg5Id}`, undefined, org6Token);
    expect(r2.status).toBe(404);
  });

  it('题库平台统一模式：机构管理员无法自建题库/组卷（无机构私有数据可泄露）', async () => {
    const q = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
      content: `隔离测试-${suffix}`, difficulty: 'EASY',
      options: [{ label: 'A', content: 'x', isCorrect: true }],
    }, org5Token);
    expect(q.status).toBe(403);

    const p = await api('POST', '/papers', {
      name: `隔离测试卷-${suffix}`, subjectId: 1, createdBy: 1,
    }, org6Token);
    expect(p.status).toBe(403);

    // 平台级题库对两机构一致开放（同为 orgId=null 的系统资源，总数一致）
    const l5 = await api('GET', '/questions?pageSize=1', undefined, org5Token);
    const l6 = await api('GET', '/questions?pageSize=1', undefined, org6Token);
    expect(l5.data.total).toBe(l6.data.total);
  });

  it('工作台统计隔离：机构管理员只见本组织规模，小于超管全平台', async () => {
    const s5 = await api('GET', '/dashboard/stats', undefined, org5Token);
    const sa = await api('GET', '/dashboard/stats', undefined, adminToken);
    expect(s5.status).toBe(200);
    expect(sa.status).toBe(200);
    const org5Students = s5.data.global.totalStudents;
    const allStudents = sa.data.global.totalStudents;
    // ★ 功能结果断言：org5 学员数 ≥ 1（刚创建的隔离测试A）且严格小于全平台
    expect(org5Students).toBeGreaterThanOrEqual(1);
    expect(org5Students).toBeLessThan(allStudents);
  });
});
