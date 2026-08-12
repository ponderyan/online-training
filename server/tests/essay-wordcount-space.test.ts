/**
 * 论文题英文作答字数统计：折叠空白而非删空白（坑5，2026-08-12）
 * 背景：旧逻辑 `replace(/\s+/g, '')` 会把英文词间空格删掉 → 英文答案被低估。
 * 修复后 `replace(/\s+/g, ' ').trim()` 折叠空白为单空格，与前端 QuestionContent 字数统计一致。
 *
 * 边界用例：MIN_WORDS=20，作答 "one two three four five"
 *   - 字母数 = 19，空格数 = 5，总字符 = 24
 *   - 旧逻辑（删空白）：19 < 20 → 应被拒 400
 *   - 新逻辑（折叠空白）：24 ≥ 20 → 应通过 201
 * 所有数据动态创建，不依赖预置 ID；需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
const MIN_WORDS = 20;
let adminToken: string;
let studentToken: string;
let studentUserId: number;
let essayId: number;
let paperId: number;
let examId: number;
let pqEssayId: number;

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

describe('论文题英文空格字数统计（坑5）', () => {
  beforeAll(async () => {
    const admin = await login('admin');
    adminToken = admin.accessToken;
    expect(adminToken).toBeTruthy();
    const stu = await login('stu001');
    studentToken = stu.accessToken;
    studentUserId = stu.user.id;
    expect(studentToken).toBeTruthy();
  }, 30000);

  afterAll(async () => {
    if (examId) await api('DELETE', `/exams/${examId}`);
    if (paperId) await api('DELETE', `/papers/${paperId}`);
    if (essayId) await api('DELETE', `/questions/${essayId}`);
  });

  it('Step 1: 建论文题 + 组卷 + 建考试并发布', async () => {
    const q = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY',
      content: `英文空格计数测试-${Date.now()}：用英文作答。`,
      difficulty: 'EASY',
      analysis: '写作要点：结构完整',
      minAnswerWords: MIN_WORDS,
      rubric: [{ description: '结构完整', points: 6, type: 'add' }],
    });
    expect([200, 201]).toContain(q.status);
    essayId = q.data.id;

    const p = await api('POST', '/papers', {
      name: `英文空格测试卷-${Date.now()}`, subjectId: 1, createdBy: 1,
      totalScore: 50, durationMinutes: 60,
    });
    expect([200, 201]).toContain(p.status);
    paperId = p.data.id;

    const addQ = await api('POST', `/papers/${paperId}/questions`, { questionId: essayId, score: 50, typeSection: '论文题' });
    expect([200, 201]).toContain(addQ.status);

    const finalize = await api('PUT', `/papers/${paperId}/finalize`);
    expect(finalize.status).toBe(200);

    const now = new Date();
    const e = await api('POST', '/exams', {
      title: `英文空格测试考试-${Date.now()}`,
      paperId,
      startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      durationMinutes: 60,
      passingScore: 30,
      earlyExitMinutes: 0,
      lateEntryMinutes: 120,
    });
    expect([200, 201]).toContain(e.status);
    examId = e.data.id;

    const addStu = await api('POST', `/exams/${examId}/add-students`, { studentIds: [studentUserId] });
    expect([200, 201]).toContain(addStu.status);

    const pub = await api('PUT', `/exams/${examId}/publish`);
    expect(pub.status).toBe(200);
  }, 30000);

  it('Step 2: 英文作答（19字母+5空格=24字符）交卷成功（旧逻辑会误判不足20）', async () => {
    const start = await api('GET', `/student/exams/${examId}`, undefined, studentToken);
    expect(start.status).toBe(200);
    const q = start.data.questions.find((x: any) => x.questionId === essayId);
    expect(q).toBeTruthy();
    pqEssayId = q.pqId;

    const en = 'one two three four five'; // 19 字母 + 5 空格 = 24 字符；删空白后 19 < 20
    const r = await api('POST', `/student/exams/${examId}/submit`, {
      answers: [{ questionId: essayId, paperQuestionId: pqEssayId, answer: `<p>${en}</p>` }],
    }, studentToken);
    expect(r.status).toBe(201);
    expect(r.data.success).toBe(true);
  }, 30000);
});
