/**
 * 判分逻辑深层测试（autoGrade + recalculateSessionScore）
 * 覆盖：
 * 1. 单选精确匹配判分
 * 2. 判断大小写不敏感（'a' ≡ 'A'）
 * 3. 多选字符串答案归一化（"C, A" ≡ ["A","C"]，乱序+空格）
 * 4. 填空按空部分给分（对 1 空得半分，isCorrect=false）
 * 5. 含主观题 → 交卷后 isPassed=null（不提前判定）
 * 6. 主观题评分后重算：totalScore/subjectiveScore/isPassed/scoringStatus 联动
 * 7. 默认合格线 = 试卷满分 60%（未设 passingScore；50 分卷 → 30 分线，35 过 / 29 不过）
 * 8. 评分上限校验（超过该题满分被拒）
 * 所有数据动态创建。需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken = '';
let studentToken = '';
let studentUserId = 0;
const stamp = Date.now();
const stu = { username: `grade_deep_${stamp}`, password: '123456', displayName: '判分深测学员' };

let qSingle = 0;
let qTF = 0;
let qMulti = 0;
let qFill = 0;
let qEssay = 0;
let paperId = 0;
let examId = 0;
let pqSingle = 0;
let pqTF = 0;
let pqMulti = 0;
let pqFill = 0;
let pqEssay = 0;
let essayAnswerId = 0;

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

describe('判分逻辑深层测试', () => {
  beforeAll(async () => {
    const login = await api('POST', '/auth/login', { username: 'admin', password: '123456' }, '');
    adminToken = login.data.accessToken;
    expect(adminToken).toBeTruthy();

    const reg = await api('POST', '/auth/register', stu, '');
    expect([200, 201]).toContain(reg.status);
    const sl = await api('POST', '/auth/login', { username: stu.username, password: stu.password }, '');
    studentToken = sl.data.accessToken;
    studentUserId = sl.data.user.id;
  }, 30000);

  afterAll(async () => {
    if (examId) await api('DELETE', `/exams/${examId}`).catch(() => {});
    if (paperId) await api('DELETE', `/papers/${paperId}`).catch(() => {});
    for (const q of [qSingle, qTF, qMulti, qFill, qEssay]) {
      if (q) await api('DELETE', `/questions/${q}`).catch(() => {});
    }
  });

  it('Step 1: 建 5 种题型（单选/判断/多选/填空/论文）', async () => {
    const r1 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE', content: `判分单选-${stamp}`, difficulty: 'EASY',
      options: [
        { label: 'A', content: '正确项', isCorrect: true },
        { label: 'B', content: '干扰项', isCorrect: false },
      ],
    });
    qSingle = r1.data.id;
    expect([200, 201]).toContain(r1.status);

    const r2 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'TRUE_FALSE', content: `判分判断-${stamp}`, difficulty: 'EASY',
      options: [
        { label: 'A', content: '对', isCorrect: true },
        { label: 'B', content: '错', isCorrect: false },
      ],
    });
    qTF = r2.data.id;
    expect([200, 201]).toContain(r2.status);

    const r3 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'MULTIPLE_CHOICE', content: `判分多选-${stamp}`, difficulty: 'MEDIUM_EASY',
      options: [
        { label: 'A', content: '正确1', isCorrect: true },
        { label: 'B', content: '干扰', isCorrect: false },
        { label: 'C', content: '正确2', isCorrect: true },
        { label: 'D', content: '干扰2', isCorrect: false },
      ],
    });
    qMulti = r3.data.id;
    expect([200, 201]).toContain(r3.status);

    const r4 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'FILL_BLANK', content: `判分填空-${stamp}`, difficulty: 'MEDIUM_EASY',
      blanks: [{ answer: '北京' }, { answer: 'Shanghai' }],
    });
    qFill = r4.data.id;
    expect([200, 201]).toContain(r4.status);

    const r5 = await api('POST', '/questions', {
      subjectId: 1, chapterId: 1, type: 'ESSAY', content: `判分论文-${stamp}`, difficulty: 'MEDIUM_HARD',
    });
    qEssay = r5.data.id;
    expect([200, 201]).toContain(r5.status);
  });

  it('Step 2: 组卷（5+5+10+10+20=50，不设 passingScore）+ 考试 + 发布', async () => {
    const p = await api('POST', '/papers', {
      name: `判分深测卷-${stamp}`, subjectId: 1, createdBy: 1, totalScore: 50, durationMinutes: 60,
    });
    expect([200, 201]).toContain(p.status);
    paperId = p.data.id;

    const adds: [number, number][] = [[qSingle, 5], [qTF, 5], [qMulti, 10], [qFill, 10], [qEssay, 20]];
    for (const [qid, score] of adds) {
      const r = await api('POST', `/papers/${paperId}/questions`, { questionId: qid, score, typeSection: '深测' });
      expect([200, 201]).toContain(r.status);
    }
    const fin = await api('PUT', `/papers/${paperId}/finalize`);
    expect(fin.status).toBe(200);

    const now = new Date();
    const e = await api('POST', '/exams', {
      title: `判分深测考试-${stamp}`, paperId,
      startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      durationMinutes: 60,
      earlyExitMinutes: 0,
      lateEntryMinutes: 120,
    });
    expect([200, 201]).toContain(e.status);
    examId = e.data.id;

    const add = await api('POST', `/exams/${examId}/add-students`, { studentIds: [studentUserId] });
    expect([200, 201]).toContain(add.status);
    const pub = await api('PUT', `/exams/${examId}/publish`);
    expect(pub.status).toBe(200);
  });

  it('Step 3: 学员开考拿 pqId', async () => {
    const { status, data } = await api('GET', `/student/exams/${examId}`, undefined, studentToken);
    expect(status).toBe(200);
    const qs = data.questions;
    pqSingle = qs.find((q: any) => q.questionId === qSingle)!.pqId;
    pqTF = qs.find((q: any) => q.questionId === qTF)!.pqId;
    pqMulti = qs.find((q: any) => q.questionId === qMulti)!.pqId;
    pqFill = qs.find((q: any) => q.questionId === qFill)!.pqId;
    pqEssay = qs.find((q: any) => q.questionId === qEssay)!.pqId;
    expect(pqSingle && pqTF && pqMulti && pqFill && pqEssay).toBeTruthy();
  });

  it('Step 4: 交卷 → 客观题自动判分深规则（大小写/乱序字符串/按空部分给分）', async () => {
    const { status, data } = await api('POST', `/student/exams/${examId}/submit`, {
      answers: [
        { questionId: qSingle, paperQuestionId: pqSingle, answer: 'A' },        // 对 → 5
        { questionId: qTF, paperQuestionId: pqTF, answer: 'a' },                // 小写 ≡ A → 5
        { questionId: qMulti, paperQuestionId: pqMulti, answer: 'C, A' },       // 乱序字符串 → 10
        { questionId: qFill, paperQuestionId: pqFill, answer: ['北京', 'WRONG'] }, // 对 1 空 → 5
        { questionId: qEssay, paperQuestionId: pqEssay, answer: '论文作答：数智化转型需要组织与人才双轮驱动。' },
      ],
    }, studentToken);
    expect(status).toBe(201);
    // 客观题合计 5+5+10+5=25；含主观题 → isPassed 必须 null
    expect(data.totalScore).toBe(25);
    expect(data.isPassed).toBeNull();

    const view = await api('GET', `/grading/${examId}/${studentUserId}`);
    expect(view.status).toBe(200);
    const answers: any[] = view.data.answers;
    const byQ = (qid: number) => answers.find(a => a.questionId === qid);
    expect(byQ(qSingle)).toMatchObject({ score: 5, isCorrect: true });
    expect(byQ(qTF)).toMatchObject({ score: 5, isCorrect: true });       // 大小写不敏感
    expect(byQ(qMulti)).toMatchObject({ score: 10, isCorrect: true });   // 字符串归一化
    expect(byQ(qFill)).toMatchObject({ score: 5, isCorrect: false });    // 按空部分给分
    expect(byQ(qEssay).score).toBeNull();                                // 主观题待人工评
    essayAnswerId = byQ(qEssay).answerId;
  });

  it('Step 5: 评分上限校验 → 超过该题满分被拒', async () => {
    const r = await api('PUT', `/grading/${examId}/${studentUserId}/${essayAnswerId}`, { score: 21 });
    expect(r.status).toBe(200); // 控制器返回 200 + error 字段（既有约定）
    expect(String(r.data.error || '')).toContain('满分');
  });

  it('Step 6: 论文评 10 分 → 总分 35 ≥ 默认合格线 30 → isPassed=true，scoringStatus=GRADED', async () => {
    const r = await api('PUT', `/grading/${examId}/${studentUserId}/${essayAnswerId}`, { score: 10, graderNote: '深测' });
    expect(r.status).toBe(200);
    expect(r.data.success).toBe(true);
    expect(r.data.totalScore).toBe(35);
    expect(r.data.subjectiveScore).toBe(10);
    expect(r.data.isPassed).toBe(true); // 50 分卷默认线 30

    const view = await api('GET', `/grading/${examId}/${studentUserId}`);
    expect(view.data.scoringStatus).toBe('GRADED');
    expect(view.data.finalScore).toBe(35);
  });

  it('Step 7: 改判 4 分 → 总分 29 < 30 → isPassed 翻转为 false（重算联动）', async () => {
    const r = await api('PUT', `/grading/${examId}/${studentUserId}/${essayAnswerId}`, { score: 4 });
    expect(r.status).toBe(200);
    expect(r.data.totalScore).toBe(29);
    expect(r.data.subjectiveScore).toBe(4);
    expect(r.data.isPassed).toBe(false);
  });
});
