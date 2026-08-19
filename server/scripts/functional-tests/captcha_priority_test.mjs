/**
 * 真功能测试：验证码先于密码校验（2026-08-13）
 * 前置：server 已 build 重启，LOGIN_REQUIRE_CAPTCHA 未设置（默认强制），登录节流已放宽。
 * 覆盖（强制模式）：
 *  1. 缺验证码 + 错密码 → 200 {error:'请输入验证码'}，failedLoginCount 不变（验证码缺失不进密码校验）
 *  2. 缺验证码 + 对密码 → 200 {error:'请输入验证码'}，failedLoginCount 不变
 *  3. 错验证码 + 对密码 → 200 {error:'验证码错误'}，failedLoginCount 不变（验证码错误不计数）
 *  4. 错验证码 + 错密码 → 200 {error:'验证码错误'}，failedLoginCount 不变
 *  5. 空 captchaId + 任意答案 → 验证码错误，failedLoginCount 不变
 * 注：正确验证码通过路径无法自动测（SVG 字符已转 path，无 OCR 文本），由 LOGIN_REQUIRE_CAPTCHA=false
 *     关闭模式回归保证（旧测试脚本不传验证码登录即覆盖「无验证码限制时的既有密码校验行为」）。
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const p = new PrismaClient();
const API = 'http://localhost:3001/api';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

async function login(body) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

const ts = Date.now().toString(36);
let userId;

async function main() {
  const u = await p.user.create({
    data: { username: `test_cap_${ts}`, passwordHash: createHash('md5').update('123456').digest('hex'), displayName: '验证码测试', isActive: true },
  });
  userId = u.id;
  const getCount = () => p.user.findUnique({ where: { id: u.id } }).then(x => ({ failed: x.failedLoginCount, locked: x.lockedUntil }));

  console.log('── 1. 缺验证码（强制拦截 + 不计数）──');
  const r1 = await login({ username: u.username, password: 'wrong' });
  const c1 = await getCount();
  ok('缺验证码+错密码 → 验证码错误提示', r1.body?.error === '请输入验证码', `→ ${JSON.stringify(r1.body)}`);
  ok('缺验证码+错密码 → captchaRequired=true', r1.body?.captchaRequired === true);
  ok('缺验证码+错密码 → failedLoginCount 不变', c1.failed === 0 || c1.failed === null, `→ ${c1.failed}`);

  const r1b = await login({ username: u.username, password: '123456' });
  const c1b = await getCount();
  ok('缺验证码+对密码 → 验证码错误提示', r1b.body?.error === '请输入验证码');
  ok('缺验证码+对密码 → failedLoginCount 不变', (c1b.failed ?? 0) === (c1.failed ?? 0), `→ ${c1b.failed}`);

  console.log('── 2. 错验证码（拦截 + 不计数）──');
  const r2 = await login({ username: u.username, password: '123456', captchaId: 'nonexistent-id', captchaAnswer: '99' });
  const c2 = await getCount();
  ok('错验证码+对密码 → 验证码错误', r2.body?.error === '验证码错误', `→ ${JSON.stringify(r2.body)}`);
  ok('错验证码+对密码 → failedLoginCount 不变', (c2.failed ?? 0) === (c1b.failed ?? 0), `→ ${c2.failed}`);

  const r3 = await login({ username: u.username, password: 'wrong', captchaId: 'nonexistent-id', captchaAnswer: '99' });
  const c3 = await getCount();
  ok('错验证码+错密码 → 验证码错误', r3.body?.error === '验证码错误');
  ok('错验证码+错密码 → failedLoginCount 不变', (c3.failed ?? 0) === (c2.failed ?? 0), `→ ${c3.failed}`);

  console.log('── 3. 空 captchaId（同样拦截，堵绕过路径）──');
  const r4 = await login({ username: u.username, password: '123456', captchaId: '', captchaAnswer: '1' });
  const c4 = await getCount();
  ok('空 captchaId → 请输入验证码（不绕过）', r4.body?.error === '请输入验证码', `→ ${JSON.stringify(r4.body)}`);
  ok('空 captchaId → failedLoginCount 不变', (c4.failed ?? 0) === (c3.failed ?? 0), `→ ${c4.failed}`);

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  await p.user.delete({ where: { id: u.id } });
  await p.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('❌ 测试异常：', e.message);
  if (userId) await p.user.delete({ where: { id: userId } }).catch(() => {});
  await p.$disconnect();
  process.exit(1);
});
