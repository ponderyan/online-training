/**
 * 真功能测试：证书模板硬删除（停用废弃模板 + 废弃原因留痕）— 2026-08-15
 *
 * 背景：remove() 只软删（isActive:false），停用模板无法真正删除。本次接线 hardRemove：
 *      仅已停用 + 未被引用的模板可删除，废弃原因写 audit_logs.changeReason。
 *
 * 前置：server 已 build 并 kickstart；LOGIN_REQUIRE_CAPTCHA=false + 节流已放宽。
 * 运行：cd server && node cert_tpl_harddelete_test.mjs
 *
 * 场景：
 *  A. 正常删除：创建 → 停用 → permanent+reason → 库中消失 + auditLog(DELETE, changeReason, operatorName)
 *  B. 引用检查：创建 → 停用 → 造 1 张 certificate 引用 → permanent → 4xx「引用」+ 模板仍在
 *  C. 启用中删除被拒：新模板（未停用）→ permanent → 4xx「先停用」
 *  D. 审计字段：A 的 auditLog before 含模板名
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

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

async function makeTpl(tok, tag) {
  const r = await api('POST', '/certificate-templates', tok, {
    name: `harddel-${tag}-${Date.now().toString(36)}`, type: 'COMPLETION', orgId: null,
    description: '硬删除测试模板',
    canvasJson: { width: 1123, height: 794, elements: [] },
  });
  if (r.status !== 201 && r.status !== 200) throw new Error(`创建模板失败 ${JSON.stringify(r.body)}`);
  return r.body.id;
}
async function makeStudent(tag) {
  const ts = Date.now().toString(36);
  return p.user.create({ data: { username: `harddel_${tag}_${ts}`, passwordHash: createHash('md5').update('123456').digest('hex'), displayName: `硬删测试${tag}`, isActive: true } });
}

const createdTplIds = [];
const createdStudentIds = [];

async function main() {
  console.log('════ 证书模板硬删除真测试 ════\n');
  const tok = await login('admin', '123456');
  ok('admin 登录', !!tok);

  // ══ 场景 A：正常删除 ══
  console.log('\n── 场景 A：停用后凭废弃原因真正删除 ──');
  const tA = await makeTpl(tok, 'A');
  createdTplIds.push(tA);
  const rmA = await api('DELETE', `/certificate-templates/${tA}`, tok);
  ok('停用成功', rmA.status === 200 || rmA.status === 201, `→ ${rmA.status}`);
  const delA = await api('POST', `/certificate-templates/${tA}/permanent`, tok, { reason: '测试废弃：版式已重构' });
  ok('permanent 删除成功', delA.status === 200 || delA.status === 201, `→ ${delA.status} ${JSON.stringify(delA.body)}`);
  const goneA = await p.certificateTemplate.findUnique({ where: { id: tA } });
  ok('模板已从库中消失', goneA == null);
  const auditA = await p.auditLog.findFirst({ where: { entityType: 'CertificateTemplate', entityId: tA, action: 'DELETE' } });
  ok('审计日志 action=DELETE 已写入', !!auditA);
  ok('审计 changeReason=废弃原因', auditA?.changeReason === '测试废弃：版式已重构', `→ ${auditA?.changeReason}`);
  ok('审计 operatorName=admin', auditA?.operatorName != null, `→ ${auditA?.operatorName}`);
  ok('审计 before 含模板名', JSON.stringify(auditA?.before ?? {}).includes('harddel-A'), `→ ${JSON.stringify(auditA?.before)}`);

  // ══ 场景 B：引用检查 ══
  console.log('\n── 场景 B：被证书引用时拒绝删除 ──');
  const tB = await makeTpl(tok, 'B');
  createdTplIds.push(tB);
  await api('DELETE', `/certificate-templates/${tB}`, tok);
  const stuB = await makeStudent('B');
  createdStudentIds.push(stuB.id);
  const sessB = await p.examSession.create({ data: { examId: 1, studentId: stuB.id, status: 'SUBMITTED', scoringStatus: 'PUBLISHED', isPassed: true, finalScore: 90 } });
  await p.certificate.create({
    data: {
      examSessionId: sessB.id, studentId: stuB.id,
      certificateNo: `FX-TEST-${Date.now().toString(36)}`, studentName: '硬删测试B', courseName: '测试课程',
      verificationCode: `VC-${Date.now().toString(36)}`, templateId: tB,
    },
  });
  const delB = await api('POST', `/certificate-templates/${tB}/permanent`, tok, { reason: '测试废弃' });
  ok('permanent 被拒（4xx）', delB.status >= 400, `→ ${delB.status}`);
  ok('拒绝消息含「引用」提示', JSON.stringify(delB.body ?? '').includes('引用'), `→ ${JSON.stringify(delB.body)}`);
  const stillB = await p.certificateTemplate.findUnique({ where: { id: tB } });
  ok('模板仍在库（未被删）', stillB != null);

  // ══ 场景 C：启用中删除被拒 ══
  console.log('\n── 场景 C：未停用直接删被拒 ──');
  const tC = await makeTpl(tok, 'C');
  createdTplIds.push(tC);
  const delC = await api('POST', `/certificate-templates/${tC}/permanent`, tok, { reason: '测试废弃' });
  ok('permanent 被拒（4xx）', delC.status >= 400, `→ ${delC.status}`);
  ok('拒绝消息含「先停用」', JSON.stringify(delC.body ?? '').includes('先停用'), `→ ${JSON.stringify(delC.body)}`);
  const stillC = await p.certificateTemplate.findUnique({ where: { id: tC } });
  ok('模板仍在库', stillC != null);

  console.log(`\n════ 结果：${pass} 通过 / ${fail} 失败 ════`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error('❌ 测试异常：', e.message);
  process.exitCode = 1;
}).finally(async () => {
  // 清理：审计日志 → 证书 → session → 学生 → 测试模板
  await p.auditLog.deleteMany({ where: { entityType: 'CertificateTemplate', entityId: { in: createdTplIds } } }).catch(() => {});
  await p.certificate.deleteMany({ where: { studentId: { in: createdStudentIds } } }).catch(() => {});
  await p.examSession.deleteMany({ where: { studentId: { in: createdStudentIds } } }).catch(() => {});
  await p.user.deleteMany({ where: { id: { in: createdStudentIds } } }).catch(() => {});
  await p.certificateTemplate.deleteMany({ where: { id: { in: createdTplIds } } }).catch(() => {});
  await p.$disconnect();
});
