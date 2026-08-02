/**
 * 线下考试完整生命周期集成测试
 * 测试状态机: DRAFT → PUBLISHED → AWAITING_GRADING → GRADING_IN_PROGRESS → SCORE_CONFIRMED → SCORE_PUBLISHED
 * 需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let token: string;
let examId: number;
let studentIds: number[] = [];
let sessionIds: number[] = [];

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  return (await res.json()).accessToken;
}

async function api(method: string, path: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('线下考试完整生命周期', () => {
  beforeAll(async () => {
    token = await login();
    expect(token).toBeTruthy();

    // 获取一些学员 ID
    const { data: studentsData } = await api('GET', '/students?pageSize=3');
    studentIds = (studentsData.items || []).map((s: any) => s.id);
    expect(studentIds.length).toBeGreaterThanOrEqual(2);
  });

  afterAll(async () => {
    if (examId) await api('DELETE', `/exams/${examId}`);
  });

  it('Step 1: 创建线下考试 (DRAFT)', async () => {
    const { status, data } = await api('POST', '/exams', {
      title: `生命周期测试-${Date.now()}`,
      examMode: 'OFFLINE',
      paperId: 1,
      startTime: '2026-09-01T09:00:00Z',
      endTime: '2026-09-01T11:00:00Z',
      durationMinutes: 120,
      passingScore: 60,
    });
    expect([200, 201]).toContain(status);
    examId = data.id;
    expect(examId).toBeTruthy();
    expect(data.status).toBe('DRAFT');
  });

  it('Step 2: 添加考生', async () => {
    const { status } = await api('POST', `/exams/${examId}/add-students`, {
      studentIds,
    });
    expect([200, 201]).toContain(status);

    // 验证 sessions 已创建
    const { data: students } = await api('GET', `/exams/${examId}/students`);
    sessionIds = (students || []).map((s: any) => s.id);
    expect(sessionIds.length).toBe(studentIds.length);
  });

  it('Step 3: 分配座位 (DRAFT 允许)', async () => {
    const { status, data } = await api('POST', `/offline-exams/${examId}/assign-seats`, {});
    expect([200, 201]).toContain(status);
    expect(data.assigned).toBe(studentIds.length);
  });

  it('Step 4: 发布考试 DRAFT → PUBLISHED', async () => {
    const { status, data } = await api('PUT', `/offline-exams/${examId}/publish`);
    expect(status).toBe(200);
    expect(data.status).toBe('PUBLISHED');
  });

  it('Step 5: 标记一名学员缺考 (PUBLISHED 允许)', async () => {
    const { status } = await api('PUT', `/offline-exams/${examId}/sessions/${sessionIds[0]}/absent`, { absent: true });
    expect(status).toBe(200);
  });

  it('Step 6: 进入阅卷 PUBLISHED → AWAITING_GRADING', async () => {
    const { status, data } = await api('PUT', `/offline-exams/${examId}/start-grading`);
    expect(status).toBe(200);
    expect(data.status).toBe('AWAITING_GRADING');
  });

  it('Step 7: 录入成绩 (AWAITING_GRADING 允许，自动流转到 GRADING_IN_PROGRESS)', async () => {
    // 为所有非缺考学员录入成绩（第 1 名已缺考，录入第 2、3 名）
    for (let i = 1; i < sessionIds.length; i++) {
      const { status, data } = await api('POST', `/offline-exams/${examId}/scores`, {
        sessionId: sessionIds[i],
        scoreByType: { SINGLE_CHOICE: 20, MULTIPLE_CHOICE: 20, TRUE_FALSE: 20 },
        graderName: '测试阅卷人',
      });
      expect(status).toBe(201);
      expect(data.totalScore).toBe(60);
    }
  });

  it('Step 8: 确认成绩 GRADING_IN_PROGRESS → SCORE_CONFIRMED', async () => {
    const { status, data } = await api('PUT', `/offline-exams/${examId}/confirm-scores`, {});
    expect(status).toBe(200);
    expect(data.status).toBe('SCORE_CONFIRMED');
  });

  it('Step 9: 发布成绩 SCORE_CONFIRMED → SCORE_PUBLISHED', async () => {
    const { status, data } = await api('PUT', `/offline-exams/${examId}/publish-scores`);
    expect(status).toBe(200);
    expect(data.status).toBe('SCORE_PUBLISHED');
  });

  it('Step 10: 发布后操作全部被守卫拦截', async () => {
    const r1 = await api('POST', `/offline-exams/${examId}/assign-seats`, {});
    expect(r1.status).toBe(400);

    const r2 = await api('PUT', `/offline-exams/${examId}/sessions/${sessionIds[1]}/absent`, { absent: true });
    expect(r2.status).toBe(400);

    const r3 = await api('POST', `/offline-exams/${examId}/scores`, {
      sessionId: sessionIds[1], scoreByType: { SINGLE_CHOICE: 5 },
    });
    expect(r3.status).toBe(400);
  });
});
