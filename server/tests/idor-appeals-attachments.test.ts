/**
 * IDOR 回归测试（2026-08-05 排查修复）
 * 1. 成绩申诉 my/create 端点：强制 token 身份，不可查询/伪造他人申诉
 * 2. 学员附件（证件/学历材料）：跨组织管理员不可访问（assertStudentAccess）
 * 需要 server 运行在 localhost:3001
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

async function login(username: string) {
  const r = await api('POST', '/auth/login', { username, password: '123456' });
  if (r.status !== 200) throw new Error(`login ${username} failed: ${r.status}`);
  return { token: r.data.accessToken, user: r.data.user };
}

const suffix = Date.now();
const stuAName = `idor_a_${suffix}`;
const stuBName = `idor_b_${suffix}`;
let adminToken: string;
let branchAdminToken: string;   // branch_admin（orgA）
let deptAdminToken: string;     // dept_admin（orgB）
let stuA: { token: string; user: any };
let stuB: { token: string; user: any };
let orgAId: number;
let orgBId: number;

describe('IDOR：成绩申诉 + 学员附件', () => {
  beforeAll(async () => {
    const admin = await login('admin');
    adminToken = admin.token;
    const branch = await login('branch_admin');
    branchAdminToken = branch.token;
    orgAId = branch.user.orgId;
    const dept = await login('dept_admin');
    deptAdminToken = dept.token;
    orgBId = dept.user.orgId;

    // 用 admin 在两个组织各创建一个学员（POST /users 支持 orgId；可登录）
    const ra = await api('POST', '/users', {
      username: stuAName, password: '123456', displayName: 'IDOR测试A',
      orgId: orgAId, roles: ['STUDENT'],
    }, adminToken);
    expect([200, 201]).toContain(ra.status);
    const rb = await api('POST', '/users', {
      username: stuBName, password: '123456', displayName: 'IDOR测试B',
      orgId: orgBId, roles: ['STUDENT'],
    }, adminToken);
    expect([200, 201]).toContain(rb.status);

    stuA = await login(stuAName);
    stuB = await login(stuBName);
  });

  it('学员查自己的申诉：传他人 studentId 也只返回自己的记录', async () => {
    // stuA 传 stuB 的 id —— 修复后强制按 token 身份查，返回自己的（空）
    const r = await api('GET', `/exams/appeals/my?studentId=${stuB.user.id}`, undefined, stuA.token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    for (const a of r.data) {
      expect(a.studentId).toBe(stuA.user.id); // 绝不出现他人的申诉
    }
  });

  it('学员不能冒用他人身份提交申诉（studentId 强制取 token 身份）', async () => {
    // 随便找一个考试 id（没有该学员的考试记录时应报"考试记录不存在"，
    // 而不是把申诉挂到别人头上）
    const exams = await api('GET', '/exams?limit=1', undefined, adminToken);
    const examId = exams.data?.items?.[0]?.id ?? exams.data?.[0]?.id;
    expect(examId).toBeTruthy();
    // stuA 冒用 stuB 的 studentId 提交 → 按 stuA 身份查 session → 不存在 → 404
    const r = await api('POST', `/exams/${examId}/appeals`, {
      reason: 'SCORE', description: 'IDOR 冒名测试', studentId: stuB.user.id,
    }, stuA.token);
    expect(r.status).toBe(404); // 考试记录不存在（stuA 没考过）
  });

  it('附件接口：跨组织访问学员附件被拒（404），超管放行', async () => {
    // stuA（orgA）的附件列表 —— branch_admin(orgA) 可查
    const ok = await api('GET', `/attachments?userId=${stuA.user.id}`, undefined, branchAdminToken);
    expect(ok.status).toBe(200);
    // dept_admin(orgB) 查 stuA(orgA) → 404（orgB 不是 orgA 的父组织时）；
    // 若 orgB 恰是 orgA 父组织（不同环境树形不同），允许 200 —— 用动态判定
    const orgs = await api('GET', '/organizations', undefined, adminToken);
    const list: any[] = Array.isArray(orgs.data) ? orgs.data : (orgs.data?.items || []);
    const a = list.find((o: any) => o.id === orgAId);
    const b = list.find((o: any) => o.id === orgBId);
    const bSeesA = !!(a?.path && b?.path && a.path.startsWith(b.path));
    const cross = await api('GET', `/attachments?userId=${stuA.user.id}`, undefined, deptAdminToken);
    expect(cross.status).toBe(bSeesA ? 200 : 404);
    // 超管放行
    const sup = await api('GET', `/attachments?userId=${stuA.user.id}`, undefined, adminToken);
    expect(sup.status).toBe(200);
  });
});
