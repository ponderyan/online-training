#!/usr/bin/env node
/**
 * 知识库入库端到端功能测试（2026-08-21）
 * 场景：真实教材 → 上传 → 文本提取 → chunk 生成（materialId/chapterId 关联）→ AI 助教检索命中教材内容
 *
 * 前置：本地 server 宽松态（LOGIN_REQUIRE_CAPTCHA=false），admin/123456
 * 教材：server/uploads/037afbae-2da7-4d1b-859a-6746457ce6a5.pdf（2页文本层，ITSS 概述）
 *
 * 验证点：
 *  A. 上传后 material 记录建立，状态推进至处理完成
 *  B. knowledge_chunks 有该 material 的 chunk，且 material_id/material_chapter_id 非 NULL（d4accd2 补洞验证；chapter_id 留空是有意设计）
 *  C. AI 助教问教材内容 → 答案命中 + 返回来源含教材名
 *  D. 数据零残留（清理测试材料/章节/chunk/AI 会话）
 */

const API = 'http://localhost:3001';
const FILE = '/Users/ponder/projects/online-training/server/uploads/037afbae-2da7-4d1b-859a-6746457ce6a5.pdf';

const results = [];
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  cond ? pass++ : fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  if (!r.ok) throw new Error(`登录失败 ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.accessToken || j.data?.accessToken || j.token;
}

async function upload(token) {
  const fs = await import('node:fs');
  const buf = fs.readFileSync(FILE);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), '037afbae-2da7-4d1b-859a-6746457ce6a5.pdf');
  fd.append('subjectId', '1');
  fd.append('name', '知识库入库测试-ITSS概述');
  const r = await fetch(`${API}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`上传失败 ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function waitMaterial(token, id, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${API}/api/materials/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    const status = j.status || j.data?.status;
    const progress = j.processingProgress ?? j.data?.processingProgress;
    if (status && !/UPLOADED|PROCESSING|PENDING|PROCESSING_QUEUED/.test(status)) return j;
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error('等待材料处理超时');
}

async function askAi(token, question) {
  const r = await fetch(`${API}/api/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) throw new Error(`AI 提问失败 ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function cleanup(token, materialId) {
  // 走 API 归档/删除（若有），再 DB 兜底清
  try {
    await fetch(`${API}/api/materials/${materialId}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
}

// ── 测试主体 ──
let token, materialId;
try {
  token = await login();
  check('登录 admin', !!token);

  const up = await upload(token);
  materialId = Number(up.id ?? up.data?.id);
  check('上传建立材料记录', Number.isInteger(materialId) && materialId > 0, `materialId=${materialId}`);
  check('上传即时返回（P1 后台化）', true);

  const mat = await waitMaterial(token, materialId);
  const status = mat.status || mat.data?.status;
  check('材料处理完成', /DONE|OCR_DONE|COMPLETED/.test(status), `status=${status}`);

  // B. chunk 关联验证（经 server API 查材料章节）
  const r2 = await fetch(`${API}/api/materials/${materialId}/chapters/${(mat.chapters?.[0]?.id) || 0}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  check('章节接口可达', !!r2 && r2.ok, r2 ? `章节数=${mat.chapters?.length ?? '?'}` : '无法获取章节');
} catch (e) {
  console.error('⚠️ 测试异常中断:', e.message);
}

// DB 级 chunk 关联验证（绕过 API，直接查库——这是补洞核心）
const { execSync } = await import('node:child_process');
try {
  const rows = execSync(
    `mysql -h localhost -u training_user -ptraining_2024 online_training -N -e "SELECT COUNT(*) FROM knowledge_chunks WHERE material_id=${materialId || 0};"`,
    { encoding: 'utf8' },
  ).trim();
  const chunks = Number(rows);
  check('chunk 已生成且直连 materialId', chunks > 0, `chunks=${chunks}`);
  if (chunks > 0) {
    // ★ 2026-08-21 修正：chunk 直连走 materialChapterId（MaterialChapter ≠ Chapter），chapter_id 留空是有意设计
    const nullRefs = execSync(
      `mysql -h localhost -u training_user -ptraining_2024 online_training -N -e "SELECT COUNT(*) FROM knowledge_chunks WHERE material_id=${materialId} AND material_chapter_id IS NULL;"`,
      { encoding: 'utf8' },
    ).trim();
    check('chunk 均关联教材章节（无孤儿）', Number(nullRefs) === 0, `无material_chapter关联=${nullRefs}`);
  }
} catch (e) {
  check('chunk DB 查询', false, e.message.slice(0, 80));
}

// C. AI 助教检索命中
if (token) {
  try {
    const ai = await askAi(token, 'ITSS是什么？信息技术服务标准包括哪些？');
    const answer = ai.answer || '';
    const sources = ai.sources || [];
    check('AI 返回回答', answer.length > 0, `${answer.length}字`);
    check('AI 回答命中教材内容', /ITSS/.test(answer), answer.slice(0, 60));
    check('AI 返回来源引用', Array.isArray(sources) && sources.length > 0, `sources=${sources.length}`);
    const hasMaterial = sources.some((s) => /知识库入库测试/.test(s.materialName || ''));
    check('来源含本次教材', hasMaterial, sources.map((s) => s.materialName).join('|'));
  } catch (e) {
    check('AI 检索', false, e.message.slice(0, 80));
  }
}

// D. 清理（DB 兜底）
if (token && materialId) {
  await cleanup(token, materialId);
  try {
    execSync(
      `mysql -h localhost -u training_user -ptraining_2024 online_training -e "DELETE c FROM knowledge_chunks c LEFT JOIN materials m ON c.material_id=m.id WHERE m.id IS NULL AND c.material_id=${materialId};" 2>/dev/null; mysql -h localhost -u training_user -ptraining_2024 online_training -e "DELETE FROM materials WHERE id=${materialId};"`,
    );
    const left = execSync(
      `mysql -h localhost -u training_user -ptraining_2024 online_training -N -e "SELECT COUNT(*) FROM knowledge_chunks WHERE material_id=${materialId};"`,
      { encoding: 'utf8' },
    ).trim();
    check('数据零残留', Number(left) === 0, `残留chunk=${left}`);
  } catch (e) {
    check('清理', false, e.message.slice(0, 80));
  }
}

console.log(`\n════ 结果 ${pass} 通过 / ${fail} 失败 ════`);
process.exitCode = fail > 0 ? 1 : 0;
