/**
 * 智能组卷算法深层测试（POST /papers/generate）
 * 覆盖：
 * 1. 难度比例分配（50/50 → 精确 2+2）
 * 2. EVEN 章节策略按章节均分
 * 3. 必选题 includeQuestionIds 锁定
 * 4. ESSAY 论文题参与组卷
 * 5. 题库题量不足 → 400 明确报错（禁止静默缺题）
 * 6. 题型分值合计≠总分 → 400
 * 7. 内容级去重：高度相似题不同卷 + 补题
 * 8. 选题无重复
 * 独立科目 + 双章节 + 受控题库，不依赖预置数据。需要 server 运行在 localhost:3001
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001/api';
let adminToken = '';
const stamp = Date.now();

let subjectId: number;
let ch1 = 0;
let ch2 = 0;
const qIds: number[] = [];
const paperIds: number[] = [];
const scEasy1: number[] = [];
const scEasy2: number[] = [];
const scHard1: number[] = [];
const scHard2: number[] = [];
let tfTwinA = 0;
let tfTwinB = 0;
let essay1 = 0;
let essay2 = 0;

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

async function createQ(type: string, difficulty: string, chapterId: number, content: string) {
  const body: any = { subjectId, chapterId, type, difficulty, content };
  if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
    body.options = [
      { label: 'A', content: '正确', isCorrect: true },
      { label: 'B', content: '错误', isCorrect: false },
    ];
  }
  const r = await api('POST', '/questions', body);
  expect([200, 201]).toContain(r.status);
  qIds.push(r.data.id);
  return r.data.id as number;
}

async function generate(cfg: {
  typeConfigs: { questionType: string; count: number; scorePerQuestion: number }[];
  totalScore: number;
  difficultyDistribution?: Record<string, number>;
  chapterStrategy?: string;
  includeQuestionIds?: number[];
}) {
  return api('POST', '/papers/generate', {
    name: `算法深测-${stamp}-${Math.floor(Math.random() * 1e6)}`,
    subjectId,
    totalScore: cfg.totalScore,
    durationMinutes: 60,
    chapterStrategy: cfg.chapterStrategy || 'RANDOM',
    sourceMix: 100,
    difficultyDistribution: cfg.difficultyDistribution || { EASY: 100, MEDIUM_EASY: 0, MEDIUM_HARD: 0, HARD: 0 },
    typeConfigs: cfg.typeConfigs,
    includeQuestionIds: cfg.includeQuestionIds,
  });
}

async function paperQuestions(paperId: number): Promise<any[]> {
  const r = await api('GET', `/papers/${paperId}`);
  expect(r.status).toBe(200);
  return (r.data.questions || []).map((pq: any) => pq.question);
}

describe('智能组卷算法深层测试', () => {
  beforeAll(async () => {
    const login = await api('POST', '/auth/login', { username: 'admin', password: '123456' }, '');
    adminToken = login.data.accessToken;
    expect(adminToken).toBeTruthy();

    // 独立科目 + 双章节
    const sub = await api('POST', '/subjects', { name: `算法深测科目-${stamp}`, code: `ALG${String(stamp).slice(-5)}` });
    expect([200, 201]).toContain(sub.status);
    subjectId = sub.data.id;
    const c1 = await api('POST', '/chapters', { subjectId, name: '章节一' });
    const c2 = await api('POST', '/chapters', { subjectId, name: '章节二' });
    expect([200, 201]).toContain(c1.status);
    expect([200, 201]).toContain(c2.status);
    ch1 = c1.data.id;
    ch2 = c2.data.id;

    // 单选题池：EASY/HARD × 双章节 × 4（题干语义互异，避免触发内容级去重）
    const texts = {
      e1: ['狐狸喜欢在清晨的森林里散步', '培训考核应当遵循公平公正原则', '数智化转型需要数据驱动决策', '学员完成课程后可以获得证书'],
      e2: ['北京是中华人民共和国的首都', '在线学习平台支持随时随地上课', '行业协会制定标准规范发展', '人工智能正在改变教育方式'],
      h1: ['论述题评分需要依据采分点逐项给分', '组织架构调整影响权限继承关系', '数据库事务保证数据一致性', '分布式系统需要处理网络分区'],
      h2: ['加密算法保障信息传输安全', '缓存策略影响系统响应速度', '负载均衡提升服务可用性', '消息队列实现异步解耦'],
    };
    for (let i = 0; i < 4; i++) scEasy1.push(await createQ('SINGLE_CHOICE', 'EASY', ch1, `${texts.e1[i]}${stamp}`));
    for (let i = 0; i < 4; i++) scEasy2.push(await createQ('SINGLE_CHOICE', 'EASY', ch2, `${texts.e2[i]}${stamp}`));
    for (let i = 0; i < 4; i++) scHard1.push(await createQ('SINGLE_CHOICE', 'HARD', ch1, `${texts.h1[i]}${stamp}`));
    for (let i = 0; i < 4; i++) scHard2.push(await createQ('SINGLE_CHOICE', 'HARD', ch2, `${texts.h2[i]}${stamp}`));
    // 判断题池：双胞胎（内容高度相似）+ 差异题
    tfTwinA = await createQ('TRUE_FALSE', 'EASY', ch1, `去重双胞胎题目${stamp}系统描述正确的选项是`);
    tfTwinB = await createQ('TRUE_FALSE', 'EASY', ch1, `去重双胞胎题目${stamp}系统描述正确的选项是。`);
    await createQ('TRUE_FALSE', 'EASY', ch2, `判断差异题：完全不同的表述${stamp}狐学培训`);
    // 论文题池
    essay1 = await createQ('ESSAY', 'EASY', ch1, `算法论文题${stamp}：论述数智化转型`);
    essay2 = await createQ('ESSAY', 'EASY', ch2, `算法论文题${stamp}：论述人才培养`);
  }, 60000);

  afterAll(async () => {
    for (const p of paperIds) await api('DELETE', `/papers/${p}`).catch(() => {});
    for (const q of qIds) await api('DELETE', `/questions/${q}`).catch(() => {});
    if (ch1) await api('DELETE', `/chapters/${ch1}`).catch(() => {});
    if (ch2) await api('DELETE', `/chapters/${ch2}`).catch(() => {});
    if (subjectId) await api('DELETE', `/subjects/${subjectId}`).catch(() => {});
  });

  it('难度比例 50/50 → 精确 2 EASY + 2 HARD 且无重复题', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'SINGLE_CHOICE', count: 4, scorePerQuestion: 5 }],
      totalScore: 20,
      difficultyDistribution: { EASY: 50, MEDIUM_EASY: 0, MEDIUM_HARD: 0, HARD: 50 },
    });
    expect(r.status).toBe(201);
    paperIds.push(r.data.id);
    const qs = await paperQuestions(r.data.id);
    expect(qs.length).toBe(4);
    expect(new Set(qs.map(q => q.id)).size).toBe(4);
    const byDiff: Record<string, number> = {};
    qs.forEach(q => { byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1; });
    expect(byDiff.EASY).toBe(2);
    expect(byDiff.HARD).toBe(2);
  });

  it('EVEN 章节策略 → 题量按章节均分（2+2）', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'SINGLE_CHOICE', count: 4, scorePerQuestion: 5 }],
      totalScore: 20,
      chapterStrategy: 'EVEN',
    });
    expect(r.status).toBe(201);
    paperIds.push(r.data.id);
    const qs = await paperQuestions(r.data.id);
    expect(qs.length).toBe(4);
    const byCh: Record<number, number> = {};
    qs.forEach(q => { byCh[q.chapterId] = (byCh[q.chapterId] || 0) + 1; });
    expect(byCh[ch1]).toBe(2);
    expect(byCh[ch2]).toBe(2);
  });

  it('必选题锁定 → includeQuestionIds 中的题必在卷内', async () => {
    const locked = scEasy1[0];
    const r = await generate({
      typeConfigs: [{ questionType: 'SINGLE_CHOICE', count: 3, scorePerQuestion: 5 }],
      totalScore: 15,
      includeQuestionIds: [locked],
    });
    expect(r.status).toBe(201);
    paperIds.push(r.data.id);
    const qs = await paperQuestions(r.data.id);
    expect(qs.length).toBe(3);
    expect(qs.some(q => q.id === locked)).toBe(true);
  });

  it('ESSAY 论文题参与组卷 → 卷内含论文题', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'ESSAY', count: 1, scorePerQuestion: 20 }],
      totalScore: 20,
    });
    expect(r.status).toBe(201);
    paperIds.push(r.data.id);
    const qs = await paperQuestions(r.data.id);
    expect(qs.length).toBe(1);
    expect(qs[0].type).toBe('ESSAY');
    expect([essay1, essay2]).toContain(qs[0].id);
  });

  it('题库题量不足 → 400 且明确报错（不产出缺题卷）', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'TRUE_FALSE', count: 10, scorePerQuestion: 1 }],
      totalScore: 10,
    });
    expect(r.status).toBe(400);
    expect(String(r.data.message)).toContain('题量不足');
  });

  it('题型分值合计≠总分 → 400', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'SINGLE_CHOICE', count: 2, scorePerQuestion: 5 }],
      totalScore: 999,
    });
    expect(r.status).toBe(400);
    expect(String(r.data.message)).toContain('不一致');
  });

  it('内容级去重 → 双胞胎题不同卷', async () => {
    const r = await generate({
      typeConfigs: [{ questionType: 'TRUE_FALSE', count: 2, scorePerQuestion: 1 }],
      totalScore: 2,
    });
    expect(r.status).toBe(201);
    paperIds.push(r.data.id);
    const qs = await paperQuestions(r.data.id);
    expect(qs.length).toBe(2);
    const ids = qs.map(q => q.id);
    expect(ids.includes(tfTwinA) && ids.includes(tfTwinB)).toBe(false);
  });
});
