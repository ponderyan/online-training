/**
 * 论文题（ESSAY）增强集成测试（2026-08-11）
 * A1 作答最低字数：出题配置 → 定稿快照 → 交卷硬校验
 * A2 rubric 评分标准：出题配置 → 校验 → 定稿继承到 PaperQuestion
 * 所有数据动态创建，不依赖预置 ID；需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken: string;
let studentToken: string;
let studentUserId: number;

let essayId: number;
let paperId: number;
let examId: number;
let pqEssayId: number;

const MIN_WORDS = 20; // 测试用小字数，便于构造达标/不达标作答
const ESSAY_RUBRIC = [
  { description: '论点明确、结构完整', points: 6, type: 'add' },
  { description: '论据充分且引用教材观点', points: 6, type: 'add' },
  { description: '逻辑混乱或偏离主题', points: 5, type: 'deduct' },
];

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

describe('论文题增强（字数要求 + rubric）', () => {
  beforeAll(async () => {
    const admin = await login('admin');
    adminToken = admin.accessToken;
    expect(adminToken).toBeTruthy();
    const stu = await login('stu001');
    studentToken = stu.accessToken;
    studentUserId = stu.user.id;
    expect(studentToken).toBeTruthy();
  });

  afterAll(async () => {
    if (examId) await api('DELETE', `/exams/${examId}`);
    if (paperId) await api('DELETE', `/papers/${paperId}`);
    if (essayId) await api('DELETE', `/questions/${essayId}`);
  });

  it('Step 1: 创建论文题（minAnswerWords + rubric）并回读', async () => {
    const r = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY',
      content: `增强链测论文题-${Date.now()}：论述企业数字化转型的实施路径。`,
      difficulty: 'HARD',
      analysis: '写作要点：战略定位/技术选型/组织变革/风险管控',
      minAnswerWords: MIN_WORDS,
      rubric: ESSAY_RUBRIC,
    });
    expect([200, 201]).toContain(r.status);
    essayId = r.data.id;
    expect(r.data.minAnswerWords).toBe(MIN_WORDS);
    expect(Array.isArray(r.data.rubric)).toBe(true);
    expect(r.data.rubric.length).toBe(3);

    const g = await api('GET', `/questions/${essayId}`);
    expect(g.status).toBe(200);
    expect(g.data.minAnswerWords).toBe(MIN_WORDS);
    expect(g.data.rubric.length).toBe(3);
  });

  it('Step 2: 非法 minAnswerWords / rubric 被拒（400）', async () => {
    const r1 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY',
      content: `非法字数测试-${Date.now()}`, difficulty: 'EASY', minAnswerWords: -5,
    });
    expect(r1.status).toBe(400);

    const r2 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY',
      content: `非法rubric测试-${Date.now()}`, difficulty: 'EASY',
      rubric: [{ description: '', points: 0, type: 'xxx' }],
    });
    expect(r2.status).toBe(400);
  });

  it('Step 3: 更新时可清空 rubric（null → 清除）', async () => {
    const r = await api('PUT', `/questions/${essayId}`, { rubric: null });
    expect(r.status).toBe(200);
    expect(r.data.rubric == null).toBe(true);
    // 恢复 rubric 供后续快照继承断言
    const r2 = await api('PUT', `/questions/${essayId}`, { rubric: ESSAY_RUBRIC });
    expect(r2.status).toBe(200);
    expect(r2.data.rubric.length).toBe(3);
  });

  it('Step 4: 组卷并定稿 → 快照携带 minAnswerWords，PaperQuestion.rubric 继承题库', async () => {
    const r1 = await api('POST', '/papers', {
      name: `增强链测试卷-${Date.now()}`, subjectId: 1, createdBy: 1,
      totalScore: 50, durationMinutes: 60,
    });
    expect([200, 201]).toContain(r1.status);
    paperId = r1.data.id;

    const r2 = await api('POST', `/papers/${paperId}/questions`, {
      questionId: essayId, score: 50, typeSection: '论文题',
    });
    expect([200, 201]).toContain(r2.status);

    const r3 = await api('PUT', `/papers/${paperId}/finalize`);
    expect(r3.status).toBe(200);

    // 读取试卷详情：快照与 rubric
    const g = await api('GET', `/papers/${paperId}`);
    expect(g.status).toBe(200);
    const pq = (g.data.questions || []).find((x: any) => x.questionId === essayId);
    expect(pq).toBeTruthy();
    expect(pq.snapshot?.minAnswerWords).toBe(MIN_WORDS);
    expect(Array.isArray(pq.rubric) && pq.rubric.length).toBe(3);
  });

  it('Step 5: 创建考试并发布，开考返回 minAnswerWords', async () => {
    const now = new Date();
    const r1 = await api('POST', '/exams', {
      title: `增强链测考试-${Date.now()}`,
      paperId,
      startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      durationMinutes: 60,
      passingScore: 30,
      earlyExitMinutes: 0,
      lateEntryMinutes: 120,
    });
    expect([200, 201]).toContain(r1.status);
    examId = r1.data.id;

    const r2 = await api('POST', `/exams/${examId}/add-students`, { studentIds: [studentUserId] });
    expect([200, 201]).toContain(r2.status);

    const r3 = await api('PUT', `/exams/${examId}/publish`);
    expect(r3.status).toBe(200);

    const start = await api('GET', `/student/exams/${examId}`, undefined, studentToken);
    expect(start.status).toBe(200);
    const q = start.data.questions.find((x: any) => x.questionId === essayId);
    expect(q).toBeTruthy();
    pqEssayId = q.pqId;
    expect(q.minAnswerWords).toBe(MIN_WORDS);
  });

  it('Step 6: 字数不达标交卷被拒（400 + 明确提示）', async () => {
    const r = await api('POST', `/student/exams/${examId}/submit`, {
      answers: [
        { questionId: essayId, paperQuestionId: pqEssayId, answer: '<p>太短了。</p>' },
      ],
    }, studentToken);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).toContain('作答字数不足');
  });

  it('Step 7: 字数达标（HTML 去标签计数）交卷成功', async () => {
    // 25 个汉字 > MIN_WORDS(20)，包裹 HTML 标签验证去标签计数
    const longText = '企业数字化转型需要从战略定位、技术选型、组织变革和风险管控四个方面系统推进。';
    const r = await api('POST', `/student/exams/${examId}/submit`, {
      answers: [
        { questionId: essayId, paperQuestionId: pqEssayId, answer: `<p>${longText}</p>` },
      ],
    }, studentToken);
    expect(r.status).toBe(201);
    expect(r.data.success).toBe(true);
    // 纯主观题 → 待人工阅卷
    expect(r.data.scoringStatus).toBe('PENDING');
  });
});
