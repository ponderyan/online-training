/**
 * 线上考试全链路集成测试（作业单 v2 任务2 链路1）
 * 出题 → 组卷 → 创建考试 → 发布 → 学员答题 → 交卷 → 客观题自动判分 → 主观题人工阅卷 → 成绩发布
 * 所有数据动态创建，不依赖任何预置 ID
 * 需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken: string;
let studentToken: string;
let studentUserId: number;

let questionObjId: number;   // 单选题 ID
let questionSubjId: number;  // 简答题 ID
let paperId: number;
let pqObjId: number;         // 试卷中客观题的 paperQuestionId
let pqSubjId: number;        // 试卷中主观题的 paperQuestionId
let examId: number;
let answerId: number;        // 主观题答案 ID（阅卷用）

const OBJ_SCORE = 20;   // 客观题分值
const SUBJ_SCORE = 30;  // 主观题分值
const GRADE_SCORE = 25; // 阅卷给分
const PASSING = 40;     // 及格线 → 20+25=45 应判通过

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

describe('线上考试全链路', () => {
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
    if (questionObjId) await api('DELETE', `/questions/${questionObjId}`);
    if (questionSubjId) await api('DELETE', `/questions/${questionSubjId}`);
  });

  it('Step 1: 创建客观题 + 主观题', async () => {
    const r1 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
      content: `链测客观题-${Date.now()}`, difficulty: 'EASY',
      options: [
        { label: 'A', content: '正确答案', isCorrect: true },
        { label: 'B', content: '干扰项1', isCorrect: false },
        { label: 'C', content: '干扰项2', isCorrect: false },
      ],
    });
    expect([200, 201]).toContain(r1.status);
    questionObjId = r1.data.id;
    expect(questionObjId).toBeTruthy();

    const r2 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SHORT_ANSWER',
      content: `链测主观题-${Date.now()}`, difficulty: 'MEDIUM_EASY',
    });
    expect([200, 201]).toContain(r2.status);
    questionSubjId = r2.data.id;
    expect(questionSubjId).toBeTruthy();
  });

  it('Step 2: 组卷（创建试卷 + 加题 + 定稿）', async () => {
    const r1 = await api('POST', '/papers', {
      name: `链测试卷-${Date.now()}`, subjectId: 1, createdBy: 1,
      totalScore: OBJ_SCORE + SUBJ_SCORE, durationMinutes: 60,
    });
    expect([200, 201]).toContain(r1.status);
    paperId = r1.data.id;
    expect(paperId).toBeTruthy();
    expect(r1.data.status).toBe('DRAFT');

    const r2 = await api('POST', `/papers/${paperId}/questions`, {
      questionId: questionObjId, score: OBJ_SCORE, typeSection: '单选题',
    });
    expect([200, 201]).toContain(r2.status);

    const r3 = await api('POST', `/papers/${paperId}/questions`, {
      questionId: questionSubjId, score: SUBJ_SCORE, typeSection: '简答题',
    });
    expect([200, 201]).toContain(r3.status);
    // 注：addQuestion 返回的是试卷对象，paperQuestionId 在开考时从 pqId 字段获取

    const r4 = await api('PUT', `/papers/${paperId}/finalize`);
    expect(r4.status).toBe(200);
  });

  it('Step 3: 创建考试 + 分配学员 + 发布', async () => {
    const now = new Date();
    const r1 = await api('POST', '/exams', {
      title: `链测线上考试-${Date.now()}`,
      paperId,
      startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      durationMinutes: 60,
      passingScore: PASSING,
      earlyExitMinutes: 0,   // 允许立即交卷（默认 30 分钟限制）
      lateEntryMinutes: 120, // 放宽迟到限制
    });
    expect([200, 201]).toContain(r1.status);
    examId = r1.data.id;
    expect(examId).toBeTruthy();

    const r2 = await api('POST', `/exams/${examId}/add-students`, { studentIds: [studentUserId] });
    expect([200, 201]).toContain(r2.status);

    const r3 = await api('PUT', `/exams/${examId}/publish`);
    expect(r3.status).toBe(200);
    expect(r3.data.status).toBe('PUBLISHED');
  });

  it('Step 4: 学员开考，拿到试题', async () => {
    const { status, data } = await api('GET', `/student/exams/${examId}`, undefined, studentToken);
    expect(status).toBe(200);
    const questions = data.questions;
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(2);
    // ★ 从开考响应提取 paperQuestionId（字段名 pqId）
    pqObjId = questions.find((q: any) => q.questionId === questionObjId)!.pqId;
    pqSubjId = questions.find((q: any) => q.questionId === questionSubjId)!.pqId;
    expect(pqObjId).toBeTruthy();
    expect(pqSubjId).toBeTruthy();
  });

  it('Step 5: 交卷（客观题答对 + 主观题作答）→ 客观题自动判分，isPassed 保持 null', async () => {
    const { status, data } = await api('POST', `/student/exams/${examId}/submit`, {
      answers: [
        { questionId: questionObjId, paperQuestionId: pqObjId, answer: 'A' },
        { questionId: questionSubjId, paperQuestionId: pqSubjId, answer: '这是主观题作答内容，链测。' },
      ],
    }, studentToken);
    expect(status).toBe(201);
    // ★ 功能结果断言：客观题 20 分已自动判出；含主观题 → isPassed 必须为 null（待人工阅卷）
    expect(data.totalScore).toBe(OBJ_SCORE);
    expect(data.scoringStatus).toBe('PENDING');
    expect(data.isPassed).toBeNull();
  });

  it('Step 5.5: 交卷幂等——重复提交被拒且成绩不变（串行 + 并发）', async () => {
    const body = {
      answers: [
        { questionId: questionObjId, paperQuestionId: pqObjId, answer: 'B' }, // 试图篡改答案
      ],
    };
    // 串行重复提交 → 400
    const r1 = await api('POST', `/student/exams/${examId}/submit`, body, studentToken);
    expect(r1.status).toBe(400);
    // 并发重复提交（模拟双开标签页/网络重试）→ 全部 400
    const rs = await Promise.all([
      api('POST', `/student/exams/${examId}/submit`, body, studentToken),
      api('POST', `/student/exams/${examId}/submit`, body, studentToken),
      api('POST', `/student/exams/${examId}/submit`, body, studentToken),
    ]);
    for (const r of rs) expect(r.status).toBe(400);
    // ★ 功能结果断言：答案未被篡改，客观题得分不变
    const check = await api('GET', `/grading/${examId}/${studentUserId}`);
    const answers: any[] = check.data.answers || check.data.items || [];
    const obj = answers.find((a: any) => a.paperQuestionId === pqObjId);
    expect(obj.score).toBe(OBJ_SCORE);
  });

  it('Step 6: 管理员阅卷主观题给分 → 总分 45，判定通过', async () => {
    // 取该学员的答卷列表，定位主观题答案 ID
    const { status, data } = await api('GET', `/grading/${examId}/${studentUserId}`);
    expect(status).toBe(200);
    const answers: any[] = data.answers || data.items || [];
    const subjAnswer = answers.find((a: any) => a.questionId === questionSubjId || a.paperQuestionId === pqSubjId);
    expect(subjAnswer).toBeTruthy();
    answerId = subjAnswer.answerId;

    const grade = await api('PUT', `/grading/${examId}/${studentUserId}/${answerId}`, {
      score: GRADE_SCORE, graderNote: '链测阅卷',
    });
    expect(grade.status).toBe(200);
    // ★ 功能结果断言：阅卷后总分 = 客观 20 + 主观 25 = 45 ≥ 40 → 通过
    expect(grade.data.finalScore ?? grade.data.totalScore).toBe(OBJ_SCORE + GRADE_SCORE);
    expect(grade.data.isPassed).toBe(true);
  });

  it('Step 7: 成绩发布 → 学员端可见最终成绩与通过结论', async () => {
    const pub = await api('POST', `/grading/${examId}/publish`);
    expect([200, 201]).toContain(pub.status);

    const { status, data } = await api('GET', `/student/exams/${examId}/result`, undefined, studentToken);
    expect(status).toBe(200);
    const body = JSON.stringify(data);
    expect(body).toContain('45');
    // isPassed=true：兼容布尔或字符串形式的宽松匹配
    expect(data.isPassed === true || body.includes('"isPassed":true')).toBe(true);
  });
});
