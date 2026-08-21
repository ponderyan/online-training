#!/usr/bin/env node
/**
 * AI 领域工具功能测试（2026-08-21）
 * 覆盖 buildDomainTools 的 5 个工具：
 *   1. search_knowledge      —— 教材检索（空库优雅降级）
 *   2. get_recent_wrong      —— 学员 10 错题与薄弱知识点
 *   3. get_question_detail   —— 题目完整信息
 *   4. get_knowledge_graph   —— 知识图谱层级（新，2026-08-21）
 *   5. generate_variation    —— 变式题生成（新，2026-08-21，真实 DeepSeek 调用）
 *
 * 两层验证：
 *   A. 直接调 handler（dist 模块 + 真实 DB，确定性强）
 *   B. 经运行中 server /api/ai/ask e2e（验证新工具在 agent 循环中真实可被调用）
 *
 * 前置：本地 server 宽松态已重启（含新 dist），admin/123456，ai_configs 有 active DeepSeek
 */

const API = 'http://localhost:3001';
const results = [];
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  cond ? pass++ : fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

// ── 直接 handler 测试：从 dist 实例化服务 ──
async function handlerTests() {
  const { PrismaService } = await import('../../dist/modules/prisma/prisma.service.js');
  const { EmbeddingService } = await import('../../dist/modules/ai-assistant/agent/embedding.service.js');
  const { RetrievalService } = await import('../../dist/modules/ai-assistant/agent/retrieval.service.js');
  const { buildDomainTools } = await import('../../dist/modules/ai-assistant/agent/domain-tools.js');

  const prisma = new PrismaService();
  await prisma.$connect();
  const embedding = new EmbeddingService();
  const retrieval = new RetrievalService(prisma, embedding);
  const tools = buildDomainTools(retrieval, prisma);

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const names = tools.map((t) => t.name).sort();
  check(
    '工具注册完整（5 个）',
    JSON.stringify(names) ===
      JSON.stringify(['generate_variation', 'get_knowledge_graph', 'get_question_detail', 'get_recent_wrong', 'search_knowledge']),
    names.join(', '),
  );

  // ── 测试锚点：从库取真实数据 ──
  const q1 = await prisma.question.findFirst({ select: { id: true, content: true } });
  check('题库有题目可测', !!q1, q1 ? `题${q1.id}: ${q1.content.slice(0, 20)}` : '题库为空');
  // 顶层知识点 + 其一个子节点（验证祖先路径）
  const top = await prisma.knowledgePoint.findFirst({
    where: { parentId: null },
    select: { id: true, name: true },
  });
  const child = await prisma.knowledgePoint.findFirst({
    where: { parentId: top?.id },
    select: { id: true, name: true, parentId: true },
  });

  const ctx = { userId: 10, sessionId: 0 };

  // ── 临时种子：question_knowledge_points 当前为空（0 行），为验证聚合逻辑种入 2 条，最后清理 ──
  const seededQuestionId = 35; // 学员10唯一非主观错题（is_subjective=0）
  await prisma.questionKnowledgePoint.upsert({
    where: { questionId_knowledgePointId: { questionId: seededQuestionId, knowledgePointId: 1 } },
    update: {},
    create: { questionId: seededQuestionId, knowledgePointId: 1, weight: 1 },
  });
  await prisma.questionKnowledgePoint.upsert({
    where: { questionId_knowledgePointId: { questionId: 1, knowledgePointId: 1 } },
    update: {},
    create: { questionId: 1, knowledgePointId: 1, weight: 1 },
  });
  let seeded = true;

  try {
  // ── 1. get_question_detail ──
  if (q1) {
    const r = await byName.get_question_detail.handler({ questionId: q1.id }, ctx);
    const o = r.output;
    check('get_question_detail 返回题干', !!o.content, o.content?.slice(0, 20));
    check('get_question_detail 含解析字段', typeof o.analysis === 'string' && o.analysis.length > 0, `${o.analysis?.length}字`);
    check('get_question_detail 含选项', Array.isArray(o.options) && o.options.length > 0, `${o.options?.length}项`);
    check('get_question_detail 含知识点', Array.isArray(o.knowledgePoints) && o.knowledgePoints.length > 0, o.knowledgePoints?.join('|'));
    const bad = await byName.get_question_detail.handler({ questionId: 999999 }, ctx);
    check('get_question_detail 题目不存在容错', !!bad.output.error, bad.output.error);
  }

  // ── 2. get_knowledge_graph（新工具）──
  if (top) {
    const r = await byName.get_knowledge_graph.handler({ query: top.name }, ctx);
    const p = r.output.points?.[0];
    check('get_knowledge_graph 命中知识点', !!p && p.name === top.name, p?.name);
    check('get_knowledge_graph 返回 path', typeof p?.path === 'string' && p.path.includes(top.name), p?.path);
    check('get_knowledge_graph 返回 children 列表', Array.isArray(p?.children), `${p?.children?.length ?? 0}个子节点`);
    check('get_knowledge_graph 返回题目数', Number.isInteger(p?.questionCount) && p.questionCount >= 0, `题数=${p?.questionCount}`);
  }
  if (child) {
    const r = await byName.get_knowledge_graph.handler({ query: String(child.id) }, ctx);
    const p = r.output.points?.[0];
    check('get_knowledge_graph 按 ID 命中', !!p && p.id === child.id, `id=${child.id}`);
    check('get_knowledge_graph 祖先路径完整', p?.path?.includes(`${top.name} > ${child.name}`), p?.path);
  }
  const miss = await byName.get_knowledge_graph.handler({ query: '不存在知识点XYZ' }, ctx);
  check('get_knowledge_graph 未命中容错', miss.output.count === 0 && /未找到/.test(miss.output.message), miss.output.message);

  // ── 3. get_recent_wrong（学员 10 有 45 条错题）──
  const wr = await byName.get_recent_wrong.handler({ count: 10 }, ctx);
  check('get_recent_wrong 返回错题', Array.isArray(wr.output.wrongQuestions) && wr.output.wrongQuestions.length > 0, `${wr.output.wrongQuestions?.length}道`);
  check('get_recent_wrong 返回薄弱点', Array.isArray(wr.output.weakPoints) && wr.output.weakPoints.length > 0, wr.output.weakPoints?.map((w) => `${w.knowledgePoint}×${w.wrongCount}`).join(', '));

  // ── 4. generate_variation（新工具，真实 DeepSeek）──
  if (q1) {
    try {
      const r = await byName.generate_variation.handler({ questionId: q1.id, count: 1 }, ctx);
      const o = r.output;
      if (o.error) {
        check('generate_variation 调用', false, o.error.slice(0, 120));
      } else {
        const v = o.variations?.[0];
        check('generate_variation 返回变式题', Array.isArray(o.variations) && o.variations.length > 0, `${o.variations?.length}道`);
        check('变式题含题干', typeof v?.content === 'string' && v.content.length > 0, v?.content?.slice(0, 25));
        check('变式题含选项且带正确标记', Array.isArray(v?.options) && v.options.some((x) => x.isCorrect) && v.options.length >= 2, `${v?.options?.length}项`);
        check('变式题含解析', typeof v?.analysis === 'string' && v.analysis.length > 0, `${v?.analysis?.length}字`);
      }
    } catch (e) {
      check('generate_variation 调用', false, `异常: ${e.message.slice(0, 100)}`);
    }
  }

  // ── 5. search_knowledge（当前知识库为空 → 优雅降级）──
  const sk = await byName.search_knowledge.handler({ query: 'ITSS', limit: 5 }, ctx);
  check('search_knowledge 空库不崩溃', !!sk.output && Array.isArray(sk.sources), sk.output?.message);
  check('search_knowledge 空库返回未找到', /未找到/.test(sk.output?.message || ''), sk.output?.message);

  } catch (e) {
    check('handler 测试无异常', false, e.message.slice(0, 120));
  } finally {
    // 清理临时种子（零残留）
    if (seeded) {
      try {
        await prisma.questionKnowledgePoint.deleteMany({
          where: { questionId: { in: [1, seededQuestionId] }, knowledgePointId: 1 },
        });
      } catch (e) {
        console.error('⚠️ 清理种子失败:', e.message);
      }
    }
    await prisma.$disconnect();
  }
  return;
}

// ── e2e：运行中 server 经 agent 循环（SSE + 会话）调新工具 ──
// ★ 2026-08-21 修正：必须走 /api/ai/ask/stream（含工具循环），/api/ai/ask 是无工具的旧版简单 RAG
async function e2eTests() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const j = await login.json();
  const token = j.accessToken || j.data?.accessToken || j.token;
  check('e2e 登录 admin', !!token);
  if (!token) return;

  // 建会话
  const cs = await fetch(`${API}/api/ai/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'AI工具测试' }),
  });
  const csj = await cs.json();
  const sessionId = csj.id ?? csj.data?.id;
  check('e2e 创建会话', Number.isInteger(sessionId), `sessionId=${sessionId}`);
  if (!Number.isInteger(sessionId)) return;

  let toolCalls = [];
  let answer = '';
  try {
    const r = await fetch(`${API}/api/ai/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        question: '知识图谱中「项目管理基础」下面包含哪些子知识点？请按层级列出',
        sessionId,
      }),
    });
    // 解析 SSE
    const text = await r.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'step' && ev.toolName) toolCalls.push(ev.toolName);
        if (ev.type === 'delta' && ev.content) answer += ev.content;
        if (ev.type === 'sources') toolCalls.push(`sources:${ev.sources?.length ?? 0}`);
      } catch {}
    }
    check('e2e agent 流返回回答', answer.length > 0, `${answer.length}字`);
    check(
      'e2e 调用了 get_knowledge_graph 工具',
      toolCalls.includes('get_knowledge_graph'),
      `实际调用: ${[...new Set(toolCalls)].join(', ') || '无'}`,
    );
    check(
      'e2e 回答体现知识图谱层级',
      /项目管理基础/.test(answer) && /项目生命周期|项目管理过程组|项目与项目管理概念/.test(answer),
      answer.slice(0, 60).replace(/\n/g, ' '),
    );
  } catch (e) {
    check('e2e 流式调用', false, e.message.slice(0, 100));
  }

  // 清理会话（零残留）
  try {
    await fetch(`${API}/api/ai/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
}

// ── 主流程 ──
try {
  await handlerTests();
} catch (e) {
  console.error('⚠️ handler 测试异常中断:', e.message);
}
try {
  await e2eTests();
} catch (e) {
  console.error('⚠️ e2e 测试异常中断:', e.message);
}

console.log(`\n════ 结果 ${pass} 通过 / ${fail} 失败 ════`);
process.exitCode = fail > 0 ? 1 : 0;
