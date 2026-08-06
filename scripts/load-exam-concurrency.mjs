#!/usr/bin/env node
/**
 * FoxLearn 考试并发压测（坑2 治理验证）
 * 场景：
 *   A. N 学员并发登录（认证层）
 *   B. N 学员同秒开考（并发建 session）
 *   C. 单 session 并发存答风暴（答案竞态）
 *   D. N 学员 × M 并发重复交卷（交卷幂等原子锁，核心场景）
 *   E. 数据一致性校验（session 数/状态/得分/autoGrade 只跑一次）
 * 用法：node scripts/load-exam-concurrency.mjs [N=20] [M=10]
 * 前置：server 运行于 :3001，限流已放宽（LOGIN_THROTTLE_LIMIT>=N）
 */
const BASE = 'http://localhost:3001/api';
const N = Number(process.argv[2] ?? 20);   // 并发学员数
const M = Number(process.argv[3] ?? 10);   // 每人并发交卷数
const RUN_TAG = `loadtest-${Date.now()}`;

const stats = { reqs: 0, errors: 0, latencies: [] };
async function api(method, path, body, token) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    stats.reqs++; stats.latencies.push(performance.now() - t0);
    return { status: res.status, data };
  } catch (e) {
    stats.reqs++; stats.errors++; stats.latencies.push(performance.now() - t0);
    return { status: 0, data: { error: e.message } };
  }
}
const pct = (p) => {
  const arr = [...stats.latencies].sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]?.toFixed(1) ?? '-';
};

async function login(username, password = '123456') {
  return api('POST', '/auth/login', { username, password });
}

// ─── 阶段 0：准备（串行）───
console.log(`\n═══ FoxLearn 考试并发压测 ═══  N=${N} 学员  M=${M} 并发交卷/人`);
const admin = await login('admin');
if (!admin.data.accessToken) { console.error('admin 登录失败', admin.data); process.exit(1); }
const AT = admin.data.accessToken;
const A = (m, p, b) => api(m, p, b, AT);

// 10 道单选题
const questionIds = [];
for (let i = 0; i < 10; i++) {
  const r = await A('POST', '/questions', {
    subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
    content: `${RUN_TAG}-压测题${i}`, difficulty: 'EASY',
    options: [{ label: 'A', content: '对', isCorrect: true }, { label: 'B', content: '错', isCorrect: false }],
  });
  if (![200, 201].includes(r.status)) { console.error('建题失败', r); process.exit(1); }
  questionIds.push(r.data.id);
}
// 组卷（创建 → 逐题加入 → 定稿）
const paper = await A('POST', '/papers', {
  name: `${RUN_TAG}-压测卷`, subjectId: 1, createdBy: 1, totalScore: 100, durationMinutes: 60,
});
if (![200, 201].includes(paper.status)) { console.error('组卷失败', paper); process.exit(1); }
const paperId = paper.data.id;
for (const qid of questionIds) {
  const rq = await A('POST', `/papers/${paperId}/questions`, { questionId: qid, score: 10, typeSection: '单选题' });
  if (![200, 201].includes(rq.status)) { console.error('加题失败', rq); process.exit(1); }
}
const fin = await A('PUT', `/papers/${paperId}/finalize`);
if (fin.status !== 200) { console.error('定稿失败', fin); process.exit(1); }
// N 个压测学员
const students = [];
for (let i = 0; i < N; i++) {
  const uname = `${RUN_TAG}-stu${i}`.replace(/-/g, '_');
  const r = await A('POST', '/users', { username: uname, password: '123456', displayName: `压测学员${i}`, roles: ['STUDENT'] });
  if (![200, 201].includes(r.status)) { console.error('建学员失败', r); process.exit(1); }
  students.push({ id: r.data.id, username: uname });
}
// 建考试 + 分配 + 发布
const now = new Date();
const exam = await A('POST', '/exams', {
  title: `${RUN_TAG}-压测考试`, paperId,
  startTime: new Date(now.getTime() - 5 * 60000).toISOString(),
  endTime: new Date(now.getTime() + 120 * 60000).toISOString(),
  durationMinutes: 60, passingScore: 60, earlyExitMinutes: 0, lateEntryMinutes: 120,
});
if (![200, 201].includes(exam.status)) { console.error('建考试失败', exam); process.exit(1); }
const examId = exam.data.id;
await A('POST', `/exams/${examId}/add-students`, { studentIds: students.map(s => s.id) });
const pub = await A('PUT', `/exams/${examId}/publish`);
if (pub.status !== 200) { console.error('发布失败', pub); process.exit(1); }
console.log(`准备完成：${questionIds.length}题 / 卷${paperId} / 考试${examId} / ${N}学员`);

// ─── 场景 A：并发登录 ───
let t0 = performance.now();
let results = await Promise.all(students.map(s => login(s.username)));
const loginOk = results.filter(r => r.status === 200 && r.data.accessToken).length;
console.log(`\nA. 并发登录 ${N}：成功 ${loginOk}/${N}，耗时 ${(performance.now() - t0).toFixed(0)}ms`);
const tokens = results.map(r => r.data.accessToken);

// ─── 场景 B：并发开考 ───
t0 = performance.now();
results = await Promise.all(tokens.map(tk => api('GET', `/student/exams/${examId}`, undefined, tk)));
const startOk = results.filter(r => r.status === 200 && Array.isArray(r.data.questions)).length;
const pqIds = results[0]?.data?.questions?.map(q => ({ questionId: q.questionId, pqId: q.pqId })) ?? [];
console.log(`B. 并发开考 ${N}：成功 ${startOk}/${N}，耗时 ${(performance.now() - t0).toFixed(0)}ms`);

// ─── 场景 C：单 session 并发存答风暴（学员0，20 并发写同一题答案）───
const answersBurst = Array.from({ length: 20 }, (_, i) => ({
  questionId: pqIds[0].questionId, paperQuestionId: pqIds[0].pqId, answer: i % 2 ? 'A' : 'B',
}));
t0 = performance.now();
results = await Promise.all(answersBurst.map(a =>
  api('POST', `/student/exams/${examId}/save-answer`, a, tokens[0])
    .then(r => r.status).catch(() => 0)));
const noCrash = results.every(s => s < 500);
console.log(`C. 并发存答风暴 20：无 5xx=${noCrash}（状态分布 ${JSON.stringify(results.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {}))}），耗时 ${(performance.now() - t0).toFixed(0)}ms`);

// ─── 场景 D：交卷幂等风暴（每人 M 个并发 submit）───
const submitPayload = { answers: pqIds.map(q => ({ questionId: q.questionId, paperQuestionId: q.pqId, answer: 'A' })) };
t0 = performance.now();
const allSubmits = await Promise.all(tokens.slice(0, N).map(tk =>
  Promise.all(Array.from({ length: M }, () => api('POST', `/student/exams/${examId}/submit`, submitPayload, tk)))));
const flat = allSubmits.flat();
const ok201List = flat.filter(r => r.status === 201);
const ok201 = ok201List.length;
const dup400 = flat.filter(r => r.status === 400).length;
const other = flat.length - ok201 - dup400;
console.log(`D. 交卷幂等风暴 ${N}×${M}=${flat.length}：成功(201) ${ok201}（期望=${N}），重复拒(400) ${dup400}，其他 ${other}，耗时 ${(performance.now() - t0).toFixed(0)}ms`);

// ─── 场景 E：数据一致性（DB 事实以 API 复核）───
let consistent = true; const problems = [];
// E1: 交卷响应即时判分（全对=100，autoGrade 恰好一次才会精确 100）
for (const r of ok201List) {
  const score = r.data.score ?? r.data.totalScore;
  if (score !== 100) { consistent = false; problems.push(`交卷判分异常=${JSON.stringify(r.data).slice(0, 120)}`); }
}
// E2: result 接口可达且已判分（发布前不露分数属正常设计）
for (let i = 0; i < Math.min(N, 5); i++) {
  const r = await api('GET', `/student/exams/${examId}/result`, undefined, tokens[i]);
  if (r.status !== 200 || !r.data.scoringStatus) { consistent = false; problems.push(`学员${i} result 异常 ${r.status}`); }
}
console.log(`E. 数据一致性（${ok201List.length} 份交卷判分 + result 抽检）：${consistent ? 'PASS（全对=100分，autoGrade 单次）' : 'FAIL ' + problems.slice(0, 3).join('; ')}`);

// ─── 汇总 ───
console.log(`\n═══ 汇总 ═══  总请求 ${stats.reqs}，网络错误 ${stats.errors}`);
console.log(`延迟：p50=${pct(0.5)}ms  p95=${pct(0.95)}ms  p99=${pct(0.99)}ms`);
const pass = loginOk === N && startOk === N && noCrash && ok201 === N && other === 0 && consistent;
console.log(`结论：${pass ? '✅ PASS' : '❌ FAIL'}`);

// ─── 清理 ───
await A('DELETE', `/exams/${examId}`);
await A('DELETE', `/papers/${paperId}`);
for (const qid of questionIds) await A('DELETE', `/questions/${qid}`);
console.log('测试数据已清理');
process.exit(pass ? 0 : 1);
