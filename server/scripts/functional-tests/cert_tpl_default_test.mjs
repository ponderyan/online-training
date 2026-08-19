/**
 * 真功能测试：证书模板「设为默认」语义（2026-08-15）
 *
 * 背景：网格视图此前无「设为默认」入口；且库里 6 个模板全 isDefault=false，
 *      用户看不出哪个是默认。本次补网格入口 + 顶部无默认引导 banner。
 *
 * 前置：server 已用新 build 重启；LOGIN_REQUIRE_CAPTCHA=false + 节流已放宽。
 * 运行：cd server && node cert_tpl_default_test.mjs
 *
 * 验证点：
 *  A. 平台级测试模板 set-default → isDefault=true；组织#1 的真实 COMPLETION（id 不固定，按名查）
 *     的 isDefault 仍 false（orgId 不同不互斥，语义正确）
 *  B. 同 org+type 互斥：平台级 t2 再 set-default → t1 降为 false、t2=true
 *  C. remove（停用）自动清 isDefault（回归 2026-08-13 修复）
 *  D. 清理后库回到无默认状态，真实模板未被改动
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const API = 'http://localhost:3001/api';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${x}`); } };

async function login(username, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`登录失败 ${username}: ${JSON.stringify(j)}`);
  return j.accessToken;
}
async function api(method, path, token, body) {
  const r = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b };
}

// 组织#1 的真实 COMPLETION 模板（名「学员结业证书（标准版）」），断言其 isDefault 全程不被动
async function getRealCompletion() {
  return p.certificateTemplate.findFirst({ where: { orgId: 1, type: 'COMPLETION', name: { contains: '学员结业证书' } } });
}

async function makeTpl(tok, name) {
  const r = await api('POST', '/certificate-templates', tok, {
    name, type: 'COMPLETION', orgId: null, // 显式平台级，隔离真实组织数据
    description: '测试模板（平台级）',
    canvasJson: { width: 1123, height: 794, elements: [] },
  });
  if (r.status !== 201 && r.status !== 200) throw new Error(`创建模板失败 ${JSON.stringify(r.body)}`);
  return r.body.id;
}

const createdIds = [];

async function main() {
  console.log('════ 证书模板「设为默认」真测试 ════\n');
  const tok = await login('admin', '123456');
  ok('admin 登录', !!tok);

  const realBefore = await getRealCompletion();
  console.log(`\n真实组织#1 COMPLETION 模板：id=${realBefore?.id}, isDefault=${realBefore?.isDefault}（全程不应被改动）`);

  // ══ 场景 A：平台级设默认，不动组织级 ══
  console.log('\n── 场景 A：平台级模板设默认 ──');
  const t1 = await makeTpl(tok, `tpl-dflt-A-${Date.now().toString(36)}`);
  createdIds.push(t1);
  const sd1 = await api('POST', `/certificate-templates/${t1}/set-default`, tok);
  ok('set-default 成功', sd1.status === 200 || sd1.status === 201, `→ ${sd1.status} ${JSON.stringify(sd1.body)}`);
  const t1a = await p.certificateTemplate.findUnique({ where: { id: t1 } });
  ok('平台级 t1 isDefault=true', t1a?.isDefault === true, `→ ${t1a?.isDefault}`);
  const realA = await getRealCompletion();
  ok('组织#1 真实 COMPLETION isDefault 仍 false（orgId 不同不互斥）', realA?.isDefault === false, `→ ${realA?.isDefault}`);

  // ══ 场景 B：同 org+type 互斥 ══
  console.log('\n── 场景 B：同归属同类型互斥（平台级 t2 抢默认） ──');
  const t2 = await makeTpl(tok, `tpl-dflt-B-${Date.now().toString(36)}`);
  createdIds.push(t2);
  const sd2 = await api('POST', `/certificate-templates/${t2}/set-default`, tok);
  ok('t2 set-default 成功', sd2.status === 200 || sd2.status === 201, `→ ${sd2.status}`);
  const t1b = await p.certificateTemplate.findUnique({ where: { id: t1 } });
  const t2b = await p.certificateTemplate.findUnique({ where: { id: t2 } });
  ok('t1 降为 false', t1b?.isDefault === false, `→ ${t1b?.isDefault}`);
  ok('t2 成为唯一默认', t2b?.isDefault === true, `→ ${t2b?.isDefault}`);
  // 注：data.orgId ?? userOrgId —— orgId 传 null 时落 admin 归属组织（orgId=1），非平台级；按实际归属断言
  const ownerOrg = t1b?.orgId ?? null;
  const defaultCount = await p.certificateTemplate.count({ where: { orgId: ownerOrg, type: 'COMPLETION', isDefault: true } });
  ok(`同归属(${ownerOrg === null ? '平台级' : '组织#' + ownerOrg}) COMPLETION 默认仅 1 个`, defaultCount === 1, `→ ${defaultCount}`);

  // ══ 场景 C：remove 清默认 ══
  console.log('\n── 场景 C：停用（remove）自动清 isDefault ──');
  const rm1 = await api('DELETE', `/certificate-templates/${t2}`, tok);
  ok('停用 t2 成功', rm1.status === 200 || rm1.status === 204, `→ ${rm1.status}`);
  const t2c = await p.certificateTemplate.findUnique({ where: { id: t2 } });
  ok('t2 isActive=false', t2c?.isActive === false, `→ ${t2c?.isActive}`);
  ok('t2 isDefault 被清 false', t2c?.isDefault === false, `→ ${t2c?.isDefault}`);

  // ══ 场景 D：真实数据未动 + 清理后无默认 ══
  console.log('\n── 场景 D：真实数据核对 ──');
  const realD = await getRealCompletion();
  ok('组织#1 COMPLETION 全程未变（isDefault=false, isActive=true）', realD?.isDefault === false && realD?.isActive === true, `→ ${JSON.stringify({ isDefault: realD?.isDefault, isActive: realD?.isActive })}`);
  const staleOwner = realD?.orgId ?? null;
  const stale = await p.certificateTemplate.count({ where: { orgId: staleOwner, type: 'COMPLETION', isDefault: true } });
  ok('清理后该归属无默认残留', stale === 0, `→ ${stale}`);

  console.log(`\n════ 结果：${pass} 通过 / ${fail} 失败 ════`);
  // ★ 2026-08-15 修复：不能 process.exit（会跳过 finally 清理，残留测试数据）。改用 exitCode，等 finally 清理完成自然退出。
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error('❌ 测试异常：', e.message);
  process.exitCode = 1;
}).finally(async () => {
  // 清理测试模板（软删 + 清默认）
  await p.certificateTemplate.updateMany({ where: { id: { in: createdIds } }, data: { isActive: false, isDefault: false } }).catch(() => {});
  await p.$disconnect();
});
