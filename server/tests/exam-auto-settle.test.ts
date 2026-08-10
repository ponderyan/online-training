/**
 * 过期考试自动结算 + 监考大屏聚合 API 集成测试
 * 覆盖：
 * 1. GET /exams/:id/proctoring/board 聚合数据结构
 * 2. 人工标记/撤销缺考（含守卫）
 * 3. endTime 过期后 cron 自动结算：未开考学员标缺考、考试自动 FINISHED
 * 所有数据动态创建，不依赖预置 ID。需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken: string;

let questionId: number;
let paperId: number;
let examId: number;
let examId2: number;
let sessionIdA: number;
const stamp = Date.now();
const stuA = { username: `settle_a_${stamp}`, password: '123456', displayName: '结算测试A' };
const stuB = { username: `settle_b_${stamp}`, password: '123456', displayName: '结算测试B' };
let stuAId: number;
let stuBId: number;

async function api(method: string, path: string, body?: any, token = adminToken) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getBoard() {
  const r = await api('GET', `/exams/${examId}/proctoring/board`);
  expect(r.status).toBe(200);
  return r.data;
}

describe('过期考试自动结算 + 监考大屏', () => {
  beforeAll(async () => {
    const admin = await api('POST', '/auth/login', { username: 'admin', password: '123456' }, '');
    adminToken = admin.data.accessToken;
    expect(adminToken).toBeTruthy();

    // 注册两名学员
    for (const s of [stuA, stuB]) {
      const r = await api('POST', '/auth/register', s, '');
      expect([200, 201]).toContain(r.status);
    }
    const la = await api('POST', '/auth/login', { username: stuA.username, password: stuA.password }, '');
    const lb = await api('POST', '/auth/login', { username: stuB.username, password: stuB.password }, '');
    stuAId = la.data.user.id;
    stuBId = lb.data.user.id;
  }, 30000);

  afterAll(async () => {
    // 发布后的考试 API 删不掉（业务约束），best-effort 清理，失败忽略
    if (examId2) await api('DELETE', `/exams/${examId2}`).catch(() => {});
    if (examId) await api('DELETE', `/exams/${examId}`).catch(() => {});
    if (paperId) await api('DELETE', `/papers/${paperId}`).catch(() => {});
    if (questionId) await api('DELETE', `/questions/${questionId}`).catch(() => {});
  });

  it('Step 1: 搭建 考试（endTime 在未来）+ 2 名学员', async () => {
    const q = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
      content: `结算测试题-${stamp}`, difficulty: 'EASY',
      options: [
        { label: 'A', content: '对', isCorrect: true },
        { label: 'B', content: '错', isCorrect: false },
      ],
    });
    expect([200, 201]).toContain(q.status);
    questionId = q.data.id;

    const p1 = await api('POST', '/papers', {
      name: `结算测试卷-${stamp}`, subjectId: 1, createdBy: 1, totalScore: 100, durationMinutes: 60,
    });
    expect([200, 201]).toContain(p1.status);
    paperId = p1.data.id;
    await api('POST', `/papers/${paperId}/questions`, { questionId, score: 100, typeSection: '单选题' });
    const fin = await api('PUT', `/papers/${paperId}/finalize`);
    expect(fin.status).toBe(200);

    const now = new Date();
    const e = await api('POST', '/exams', {
      title: `结算测试考试-${stamp}`,
      paperId,
      startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      durationMinutes: 60,
      lateEntryMinutes: 120,
    });
    expect([200, 201]).toContain(e.status);
    examId = e.data.id;

    const add = await api('POST', `/exams/${examId}/add-students`, { studentIds: [stuAId, stuBId] });
    expect([200, 201]).toContain(add.status);
    const pub = await api('PUT', `/exams/${examId}/publish`);
    expect(pub.status).toBe(200);
  }, 30000);

  it('Step 2: board API 返回完整聚合结构', async () => {
    const b = await getBoard();
    expect(b.exam.title).toContain('结算测试考试');
    expect(b.exam.questionCount).toBe(1);
    expect(b.exam.paperTotalScore).toBe(100);
    expect(b.stats.totalStudents).toBe(2);
    expect(b.stats.notStartedCount).toBe(2);
    expect(b.stats.submissionRate).toBe(0);
    expect(Array.isArray(b.sessions)).toBe(true);
    expect(Array.isArray(b.recentViolations)).toBe(true);
    expect(b.serverTime).toBeTruthy();
    sessionIdA = b.sessions[0].sessionId;
  });

  it('Step 3: 人工标记缺考 + 守卫 + 撤销', async () => {
    // 标记 A 缺考
    const r1 = await api('PUT', `/exams/${examId}/proctoring/sessions/${sessionIdA}/absent`, { absent: true, operatorName: '测试监考' });
    expect(r1.status).toBe(200);
    expect(r1.data.absent).toBe(true);

    let b = await getBoard();
    expect(b.stats.absentCount).toBe(1);
    expect(b.sessions.find((s: any) => s.sessionId === sessionIdA).absent).toBe(true);

    // 重复标记应报错
    const r2 = await api('PUT', `/exams/${examId}/proctoring/sessions/${sessionIdA}/absent`, { absent: true, operatorName: '测试监考' });
    expect(r2.status).toBe(400);

    // 撤销缺考 → 回到未开考
    const r3 = await api('PUT', `/exams/${examId}/proctoring/sessions/${sessionIdA}/absent`, { absent: false, operatorName: '测试监考' });
    expect(r3.status).toBe(200);
    b = await getBoard();
    expect(b.stats.absentCount).toBe(0);
    const sa = b.sessions.find((s: any) => s.sessionId === sessionIdA);
    expect(sa.absent).toBe(false);
    expect(sa.status).toBe('ASSIGNED');
  });

  it('Step 4: 直建 endTime 已过期的考试 → cron 自动结算（缺考+FINISHED）', async () => {
    // 发布后的考试不允许经 API 改时间（业务约束），故直接创建已过期考试模拟存量
    const now = Date.now();
    const e = await api('POST', '/exams', {
      title: `结算测试过期考试-${stamp}`,
      paperId,
      startTime: new Date(now - 10 * 60000).toISOString(),
      endTime: new Date(now - 60000).toISOString(),
      durationMinutes: 5,
    });
    expect([200, 201]).toContain(e.status);
    examId2 = e.data.id;
    const add = await api('POST', `/exams/${examId2}/add-students`, { studentIds: [stuAId] });
    expect([200, 201]).toContain(add.status);
    const pub = await api('PUT', `/exams/${examId2}/publish`);
    expect(pub.status).toBe(200);

    // 轮询等待 cron（每分钟一次），最多 80 秒
    let settled: any = null;
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const r = await api('GET', `/exams/${examId2}/proctoring/board`);
      if (r.status === 200 && r.data.exam.status === 'FINISHED') { settled = r.data; break; }
    }
    expect(settled).toBeTruthy();
    expect(settled.stats.absentCount).toBe(1);      // 未开考 → 自动缺考
    expect(settled.stats.submissionRate).toBe(100);
    for (const s of settled.sessions) {
      expect(s.absent).toBe(true);
      expect(s.status).toBe('SUBMITTED');
    }
  }, 120000);
});
