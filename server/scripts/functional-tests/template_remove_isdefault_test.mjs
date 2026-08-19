/**
 * 真功能测试：模板 remove() 软删除时清 isDefault（2026-08-13）
 * 覆盖：
 *  1. isDefault:true 的模板停用 → isDefault 被清为 false（isActive:false 同步）
 *  2. 停用后再重新启用（isActive:true）→ 不再是默认（消除「重新启用即默认」隐患）
 *  3. setDefault 与 remove 组合：设默认 → 停用 → 断言默认已清
 * 运行：cd server && node template_remove_isdefault_test.mjs
 * 前置：server 已用新 build 重启，登录节流已放宽
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const BASE = 'http://localhost:3001';
const API = `${BASE}/api`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

async function login(username, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  return j.accessToken;
}
async function api(method, path, token, body) {
  const r = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b };
}

const ts = Date.now().toString(36);
const MIN_CANVAS = { width: 1200, height: 848, background: '#ffffff', elements: [] };
const tplNames = [`test-rm-${ts}`];

async function main() {
  // admin 临时挂 SUPER_ADMIN（历史测试清过角色）
  const adminUser = await p.user.findUnique({ where: { username: 'admin' }, select: { id: true } });
  const superAdminRole = await p.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  await p.userRoleAssignment.create({ data: { userId: adminUser.id, roleId: superAdminRole.id } });
  const tok = await login('admin', '123456');
  ok('管理员登录', !!tok);

  console.log('── 1. 停用 isDefault 模板 → isDefault 清空 ──');
  const c1 = await api('POST', '/certificate-templates', tok, { name: `test-rm-${ts}`, description: 't', type: 'COMPLETION', canvasJson: MIN_CANVAS, isDefault: true });
  ok('建模板 isDefault:true 成功', c1.status === 201 || c1.status === 200, `→ ${c1.status}`);
  const t1 = c1.body?.id || (c1.body?.data?.id);
  const id1 = c1.body?.id ?? c1.body?.data?.id;
  ok('拿到模板 id', !!id1);

  const del = await api('DELETE', `/certificate-templates/${id1}`, tok);
  ok('停用 200', del.status === 200, `→ ${del.status}`);
  const db1 = await p.certificateTemplate.findUnique({ where: { id: id1 } });
  ok('停用后 isActive=false', db1?.isActive === false);
  ok('停用后 isDefault=false（本次修复核心）', db1?.isDefault === false, `→ isDefault=${db1?.isDefault}`);

  console.log('── 2. 重新启用 → 不再是默认 ──');
  await p.certificateTemplate.update({ where: { id: id1 }, data: { isActive: true } });
  const db1b = await p.certificateTemplate.findUnique({ where: { id: id1 } });
  ok('重新启用 isActive=true', db1b?.isActive === true);
  ok('重新启用 isDefault 仍为 false（消除「重新启用即默认」隐患）', db1b?.isDefault === false);

  console.log('── 3. setDefault → remove 组合 ──');
  const c2 = await api('POST', '/certificate-templates', tok, { name: `test-rm-${ts}b`, description: 't', type: 'HOURS', canvasJson: MIN_CANVAS, isDefault: false });
  const id2 = c2.body?.id ?? c2.body?.data?.id;
  const sd = await api('POST', `/certificate-templates/${id2}/set-default`, tok);
  const db2 = await p.certificateTemplate.findUnique({ where: { id: id2 } });
  ok('setDefault 生效', db2?.isDefault === true, `→ ${sd.status}`);
  const del2 = await api('DELETE', `/certificate-templates/${id2}`, tok);
  const db2b = await p.certificateTemplate.findUnique({ where: { id: id2 } });
  ok('停用后 isDefault 清空', db2b?.isDefault === false);
  ok('停用后 isActive=false', db2b?.isActive === false);

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  await cleanup(adminUser.id, superAdminRole.id);
  process.exit(fail === 0 ? 0 : 1);
}

async function cleanup(adminId, superRoleId) {
  await p.certificateTemplate.deleteMany({ where: { name: { in: tplNames } } });
  await p.userRoleAssignment.deleteMany({ where: { userId: adminId, roleId: superRoleId } });
}

main().catch((e) => { console.error('❌ 测试异常：', e); process.exit(1); });
