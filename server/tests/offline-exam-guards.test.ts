/**
 * 线下考试状态守卫集成测试
 * 需要 server 运行在 localhost:3001
 * 所有测试数据动态创建，不依赖任何预置数据 ID
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let token: string;
let testExamId: number;

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const data = await res.json();
  return data.accessToken;
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

/** 动态创建一场线下考试并推进到 SCORE_PUBLISHED 状态 */
async function buildScorePublishedExam(): Promise<{ examId: number; sessionIds: number[] }> {
  const { data: studentsData } = await api('GET', '/students?pageSize=3');
  const studentIds = (studentsData.items || []).map((s: any) => s.id);
  expect(studentIds.length).toBeGreaterThanOrEqual(2);

  const { data: examData } = await api('POST', '/exams', {
    title: `守卫测试-已发布-${Date.now()}`,
    examMode: 'OFFLINE',
    paperId: 1,
    startTime: '2026-09-01T09:00:00Z',
    endTime: '2026-09-01T11:00:00Z',
    durationMinutes: 120,
    passingScore: 60,
  });
  const examId = examData.id;
  expect(examId).toBeTruthy();

  await api('POST', `/exams/${examId}/add-students`, { studentIds });
  const { data: students } = await api('GET', `/exams/${examId}/students`);
  const sessionIds = (students || []).map((s: any) => s.id);

  await api('PUT', `/offline-exams/${examId}/publish`);
  await api('PUT', `/offline-exams/${examId}/start-grading`);
  for (const sessionId of sessionIds) {
    await api('POST', `/offline-exams/${examId}/scores`, {
      sessionId,
      scoreByType: { SINGLE_CHOICE: 20, MULTIPLE_CHOICE: 20, TRUE_FALSE: 20 },
      graderName: '测试阅卷人',
    });
  }
  await api('PUT', `/offline-exams/${examId}/confirm-scores`, {});
  const { data: published } = await api('PUT', `/offline-exams/${examId}/publish-scores`);
  expect(published.status).toBe('SCORE_PUBLISHED');
  return { examId, sessionIds };
}

describe('线下考试状态守卫', () => {
  beforeAll(async () => {
    token = await login();
    expect(token).toBeTruthy();

    // 创建一个测试用线下考试
    const { data } = await api('POST', '/exams', {
      title: `守卫测试-${Date.now()}`,
      examMode: 'OFFLINE',
      paperId: 1,
      startTime: '2026-09-01T09:00:00Z',
      endTime: '2026-09-01T11:00:00Z',
      durationMinutes: 120,
    });
    testExamId = data.id;
    expect(testExamId).toBeTruthy();
  });

  afterAll(async () => {
    if (testExamId) {
      await api('DELETE', `/exams/${testExamId}`);
    }
  });

  describe('DRAFT 状态', () => {
    it('assignSeats 应允许（DRAFT）', async () => {
      const { status } = await api('POST', `/offline-exams/${testExamId}/assign-seats`, {});
      // 0 sessions 也算成功（分配了0个）
      expect([200, 201]).toContain(status);
    });

    it('markAbsent 应拒绝（DRAFT 不在允许列表）', async () => {
      const { status, data } = await api('PUT', `/offline-exams/${testExamId}/sessions/999/absent`, { absent: true });
      expect(status).toBe(400);
      expect(data.message).toContain('不允许');
    });

    it('enterScore 应拒绝（DRAFT 不在允许列表）', async () => {
      const { status, data } = await api('POST', `/offline-exams/${testExamId}/scores`, {
        sessionId: 999, scoreByType: { SINGLE_CHOICE: 10 },
      });
      expect(status).toBe(400);
      expect(data.message).toContain('不允许');
    });

    it('startGrading 应拒绝（0 考生）', async () => {
      // 先 publish
      await api('PUT', `/offline-exams/${testExamId}/publish`);
      const { status, data } = await api('PUT', `/offline-exams/${testExamId}/start-grading`);
      expect(status).toBe(400);
      expect(data.message).toContain('尚未分配考生');
    });
  });

  describe('SCORE_PUBLISHED 状态（动态构造）', () => {
    let publishedExamId: number;
    let publishedSessionIds: number[] = [];

    beforeAll(async () => {
      const built = await buildScorePublishedExam();
      publishedExamId = built.examId;
      publishedSessionIds = built.sessionIds;
    });

    afterAll(async () => {
      if (publishedExamId) await api('DELETE', `/exams/${publishedExamId}`);
    });

    it('assignSeats 应拒绝', async () => {
      const { status, data } = await api('POST', `/offline-exams/${publishedExamId}/assign-seats`, {});
      expect(status).toBe(400);
      expect(data.message).toContain('不能再分配座位');
    });

    it('markAbsent 应拒绝', async () => {
      const { status, data } = await api('PUT', `/offline-exams/${publishedExamId}/sessions/${publishedSessionIds[0]}/absent`, { absent: true });
      expect(status).toBe(400);
      expect(data.message).toContain('不允许修改缺考标记');
    });

    it('reviewScore 应拒绝', async () => {
      const { status, data } = await api('PUT', `/offline-exams/${publishedExamId}/scores/${publishedSessionIds[0]}/review`, {
        reviewerName: 'test', approved: true,
      });
      expect(status).toBe(400);
      expect(data.message).toContain('不允许复核');
    });

    it('enterScore 应拒绝', async () => {
      const { status, data } = await api('POST', `/offline-exams/${publishedExamId}/scores`, {
        sessionId: publishedSessionIds[0], scoreByType: { SINGLE_CHOICE: 10 },
      });
      expect(status).toBe(400);
      expect(data.message).toContain('不允许录入');
    });
  });
});
