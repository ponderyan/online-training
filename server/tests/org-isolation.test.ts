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
let orgAToken: string;    // branch_admin（分支机构）
let orgBToken: string;    // dept_admin（另一机构）
let orgAId: number;       // branch_admin 的 orgId（从登录响应动态获取）
let orgBId: number;

let stuOrgAId: number;    // 动态创建的机构A学员
let stuOrgBId: number;
let bIsChildOfA = false; // orgB 是否为 orgA 的子组织（动态判定，兼容不同环境组织树）    // 动态创建的机构B学员
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
    const admin = await login('admin');
    const orgA = await login('branch_admin');
    const orgB = await login('dept_admin');
    adminToken = admin.accessToken;
    orgAToken = orgA.accessToken;
    orgBToken = orgB.accessToken;
    orgAId = orgA.user.orgId;
    orgBId = orgB.user.orgId;
    expect(adminToken).toBeTruthy();
    expect(orgAToken).toBeTruthy();
    expect(orgBToken).toBeTruthy();
    expect(orgAId).toBeTruthy();
    expect(orgBId).toBeTruthy();
    expect(orgAId).not.toBe(orgBId);

    // 超管分别在机构A / 机构B 创建一名学员
    const r1 = await api('POST', '/users', {
      username: usernameOrg5, password: '123456', displayName: '隔离测试A',
      roles: ['STUDENT'], orgId: orgAId,
    });
    expect([200, 201]).toContain(r1.status);
    stuOrgAId = r1.data.id;

    const r2 = await api('POST', '/users', {
      username: usernameOrg6, password: '123456', displayName: '隔离测试B',
      roles: ['STUDENT'], orgId: orgBId,
    });
    expect([200, 201]).toContain(r2.status);
    stuOrgBId = r2.data.id;

    // 动态判定 orgB 是否为 orgA 子孙（本地/CI 组织树不同，断言据此分支）。
    // 组织接口返回扁平列表，用 path 前缀判定（B.path 以 A.path 开头即为子孙）；
    // path 缺失的环境回退为逐层 parentId 上溯。
    const orgList = await api('GET', '/organizations', undefined, adminToken);
    const orgs: any[] = Array.isArray(orgList.data) ? orgList.data : (orgList.data?.items || []);
    const orgAInfo = orgs.find((o: any) => o.id === orgAId);
    const orgBInfo = orgs.find((o: any) => o.id === orgBId);
    if (orgAInfo?.path && orgBInfo?.path) {
      bIsChildOfA = orgBInfo.path.startsWith(orgAInfo.path) && orgBInfo.id !== orgAInfo.id;
    } else {
      // path 缺失：沿 parentId 上溯
      let cur = orgBInfo, guard = 0;
      while (cur?.parentId && guard++ < 20) {
        if (cur.parentId === orgAId) { bIsChildOfA = true; break; }
        cur = orgs.find((o: any) => o.id === cur.parentId);
      }
    }
  });

  // 隔离规则（组织树语义）：父组织可见自身+子孙；子组织只见自身，不可见父/兄弟。
  // orgB 与 orgA 的层级关系因环境而异（本地 orgB 是 orgA 子组织，CI 平级），
  // beforeAll 动态判定 bIsChildOfA，断言据此分支。
  it('学员列表隔离：机构A 可见本组织学员；对机构B 学员按树语义可见/不可见', async () => {
    const { status, data } = await api('GET', '/students?pageSize=100', undefined, orgAToken);
    expect(status).toBe(200);
    const ids = (data.items || []).map((s: any) => s.id);
    expect(ids).toContain(stuOrgAId);
    if (bIsChildOfA) {
      expect(ids).toContain(stuOrgBId); // 父可见子
    } else {
      expect(ids).not.toContain(stuOrgBId); // 平级互不可见
    }
  });

  it('学员列表隔离：机构B 只见本组织，看不到机构A 学员', async () => {
    const { status, data } = await api('GET', '/students?pageSize=100', undefined, orgBToken);
    expect(status).toBe(200);
    const ids = (data.items || []).map((s: any) => s.id);
    expect(ids).toContain(stuOrgBId);
    expect(ids).not.toContain(stuOrgAId); // 无论 B 是否为 A 的子，子不可见父/平级互不可见
  });

  it('跨组织按 ID 直读学员详情被拒（防 IDOR）', async () => {
    // B 读 A 的学员 → 一律 404（子不可见父 / 平级互不可见）
    const r2 = await api('GET', `/students/${stuOrgAId}`, undefined, orgBToken);
    expect(r2.status).toBe(404);
    // A 读 B 的学员 → 按树语义：父读子 200，平级 404
    const r1 = await api('GET', `/students/${stuOrgBId}`, undefined, orgAToken);
    expect(r1.status).toBe(bIsChildOfA ? 200 : 404);
  });

  it('题库平台统一模式：机构管理员无法自建题库/组卷（无机构私有数据可泄露）', async () => {
    const q = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
      content: `隔离测试-${suffix}`, difficulty: 'EASY',
      options: [{ label: 'A', content: 'x', isCorrect: true }],
    }, orgAToken);
    expect(q.status).toBe(403);

    const p = await api('POST', '/papers', {
      name: `隔离测试卷-${suffix}`, subjectId: 1, createdBy: 1,
    }, orgBToken);
    expect(p.status).toBe(403);

    // 平台级题库对两机构一致开放（同为 orgId=null 的系统资源，总数一致）
    const lA = await api('GET', '/questions?pageSize=1', undefined, orgAToken);
    const lB = await api('GET', '/questions?pageSize=1', undefined, orgBToken);
    expect(lA.data.total).toBe(lB.data.total);
  });

  it('工作台统计隔离：机构管理员只见本组织规模，小于超管全平台', async () => {
    const sA = await api('GET', '/dashboard/stats', undefined, orgAToken);
    const sa = await api('GET', '/dashboard/stats', undefined, adminToken);
    expect(sA.status).toBe(200);
    expect(sa.status).toBe(200);
    const orgAStudents = sA.data.global.totalStudents;
    const allStudents = sa.data.global.totalStudents;
    // ★ 功能结果断言：机构A 学员数 ≥ 1（刚创建的隔离测试A）且严格小于全平台
    expect(orgAStudents).toBeGreaterThanOrEqual(1);
    expect(orgAStudents).toBeLessThan(allStudents);
  });
});
