/**
 * 真功能测试：证书审批/管理业务逻辑修复（2026-08-16）
 *
 * 覆盖用户两次留言的「业务逻辑不对」：
 *  A. listApplications 非超管 500 回归（申请表缺 orgId 字段导致 Prisma Unknown argument）
 *  B. 驳回 = 审批拒绝（REJECTED），不再用撤销（isRevoked）表达 → 两页状态一致
 *  C. verify 门控收紧：仅 APPROVED && 未撤销有效，REJECTED 不再误判有效
 *  D. revoke 门控：PENDING/REJECTED 不可撤销 + 撤销留 approvalLog + 通知
 *  E. 证书管理「已拒绝」筛选有数据（REJECTED 状态真实存在）
 *  F. approve 正常链路：发证 + 申请 APPROVED + 证书 APPROVED
 *
 * 前置：server 已 build 并 kickstart；LOGIN_REQUIRE_CAPTCHA=false + 节流放宽。
 * 运行：cd server && node cert_logic_fix_test.mjs
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
async function makeStudent(tag) {
  const ts = Date.now().toString(36);
  return p.user.create({ data: { username: `certfix_${tag}_${ts}`, passwordHash: createHash('md5').update('123456').digest('hex'), displayName: `证书修复${tag}`, isActive: true } });
}

const createdStudentIds = [];
const createdCertIds = [];
const createdAppIds = [];
const createdSessionIds = [];

async function makeBase(tag, extra = {}) {
  const stu = await makeStudent(tag);
  createdStudentIds.push(stu.id);
  const sess = await p.examSession.create({
    data: { examId: 1, studentId: stu.id, status: 'SUBMITTED', scoringStatus: 'PUBLISHED', isPassed: true, finalScore: 90, ...extra },
  });
  createdSessionIds.push(sess.id);
  return { stu, sess };
}

async function main() {
  console.log('════ 证书审批/管理业务逻辑修复真测试 ════\n');
  const tok = await login('admin', '123456');
  ok('admin 登录', !!tok);

  // ══ A. branch_admin 申请列表 500 回归 ══
  console.log('\n── A. 机构管理员申请列表（此前 500）──');
  const bTok = await login('branch_admin', '123456');
  ok('branch_admin 登录', !!bTok);
  const appsRes = await api('GET', '/certificates/applications?status=PENDING&page=1&limit=10', bTok);
  ok('申请列表 200（不再 500）', appsRes.status === 200, `→ ${appsRes.status}`);
  const visibleOrgIds = new Set([2, null]); // branch orgId=2 + 平台级
  ok('返回申请均属本机构/平台级（无越权）', Array.isArray(appsRes.body?.items) && appsRes.body.items.every(i => visibleOrgIds.has(i.orgId)), `→ ${JSON.stringify(appsRes.body?.items?.slice(0,1))}`);

  // ══ B. 驳回 → REJECTED ══
  console.log('\n── B. 驳回申请 → 证书 REJECTED（不再撤销）──');
  const b1 = await makeBase('B');
  const appB = await p.certificateApplication.create({ data: { sessionId: b1.sess.id, studentId: b1.stu.id, status: 'PENDING', orgId: null } });
  createdAppIds.push(appB.id);
  const certB = await p.certificate.create({
    data: {
      examSessionId: b1.sess.id, studentId: b1.stu.id,
      certificateNo: `FX-LF-${Date.now().toString(36)}`, studentName: '驳回测试', courseName: '测试课程',
      verificationCode: `LFVC-${Date.now().toString(36)}`, approvalStatus: 'PENDING', orgId: null,
    },
  });
  createdCertIds.push(certB.id);
  await p.certificateApplication.update({ where: { id: appB.id }, data: { certificateId: certB.id } });
  const rejB = await api('POST', `/certificates/applications/${appB.id}/reject`, tok, { reason: '成绩存疑，需复核', operatorId: 1 });
  ok('驳回成功', rejB.status === 200 || rejB.status === 201, `→ ${rejB.status}`);
  const certBAfter = await p.certificate.findUnique({ where: { id: certB.id } });
  ok('证书 approvalStatus=REJECTED', certBAfter?.approvalStatus === 'REJECTED', `→ ${certBAfter?.approvalStatus}`);
  ok('证书 isRevoked=false（不再用撤销表达驳回）', certBAfter?.isRevoked === false, `→ ${certBAfter?.isRevoked}`);
  ok('证书 rejectReason 留痕', certBAfter?.rejectReason === '成绩存疑，需复核', `→ ${certBAfter?.rejectReason}`);
  const appBAfter = await p.certificateApplication.findUnique({ where: { id: appB.id } });
  ok('申请状态 REJECTED（两页一致）', appBAfter?.status === 'REJECTED', `→ ${appBAfter?.status}`);

  // ══ C. verify 门控：REJECTED 无效 ══
  console.log('\n── C. 验证门控收紧 ──');
  const vC = await api('GET', `/certificates/verify?no=${certB.certificateNo}&code=${certB.verificationCode}`, null);
  ok('REJECTED 证书验证无效', vC.body?.valid === false, `→ ${JSON.stringify(vC.body)}`);

  // ══ D. revoke 门控 + 日志 + 通知 ══
  console.log('\n── D. 撤销门控与留痕 ──');
  const d1 = await makeBase('D1');
  const certD1 = await p.certificate.create({
    data: { examSessionId: d1.sess.id, studentId: d1.stu.id, certificateNo: `FX-LF-${Date.now().toString(36)}`, studentName: 'PENDING撤测', courseName: '测试', verificationCode: `LFVC-${Date.now().toString(36)}`, approvalStatus: 'PENDING', orgId: null },
  });
  createdCertIds.push(certD1.id);
  const revD1 = await api('POST', `/certificates/${certD1.id}/revoke`, tok, { reason: '误撤', operatorId: 1 });
  ok('PENDING 证书撤销被拒（400）', revD1.status === 400, `→ ${revD1.status} ${JSON.stringify(revD1.body)}`);
  ok('拒绝消息提示去审批页', JSON.stringify(revD1.body ?? '').includes('审批'), `→ ${JSON.stringify(revD1.body)}`);

  const d2 = await makeBase('D2');
  const certD2 = await p.certificate.create({
    data: { examSessionId: d2.sess.id, studentId: d2.stu.id, certificateNo: `FX-LF-${Date.now().toString(36)}`, studentName: 'REJ撤测', courseName: '测试', verificationCode: `LFVC-${Date.now().toString(36)}`, approvalStatus: 'REJECTED', rejectReason: '已驳回', orgId: null },
  });
  createdCertIds.push(certD2.id);
  const revD2 = await api('POST', `/certificates/${certD2.id}/revoke`, tok, { reason: '误撤', operatorId: 1 });
  ok('REJECTED 证书撤销被拒（400）', revD2.status === 400, `→ ${revD2.status}`);

  const d3 = await makeBase('D3');
  const certD3 = await p.certificate.create({
    data: { examSessionId: d3.sess.id, studentId: d3.stu.id, certificateNo: `FX-LF-${Date.now().toString(36)}`, studentName: '正常撤测', courseName: '测试', verificationCode: `LFVC-${Date.now().toString(36)}`, approvalStatus: 'APPROVED', orgId: null },
  });
  createdCertIds.push(certD3.id);
  const revD3 = await api('POST', `/certificates/${certD3.id}/revoke`, tok, { reason: '考试作弊，证书作废', operatorId: 1 });
  ok('APPROVED 证书撤销成功', revD3.status === 200 || revD3.status === 201, `→ ${revD3.status}`);
  const certD3After = await p.certificate.findUnique({ where: { id: certD3.id } });
  ok('证书 isRevoked=true', certD3After?.isRevoked === true);
  const logD3 = await p.certificateApprovalLog.findFirst({ where: { certificateId: certD3.id, action: 'REVOKED' } });
  ok('撤销写审批日志 REVOKED', !!logD3, `→ ${logD3?.note}`);
  let notifD3 = 0;
  for (let i = 0; i < 20 && notifD3 === 0; i++) { // 通知是异步 void 写入，轮询等待
    notifD3 = await p.notification.count({ where: { userId: d3.stu.id } });
    if (notifD3 === 0) await new Promise(r => setTimeout(r, 100));
  }
  ok('撤销通知学员', notifD3 > 0, `→ ${notifD3} 条`);
  const vD3 = await api('GET', `/certificates/verify?no=${certD3.certificateNo}&code=${certD3.verificationCode}`, null);
  ok('已撤销证书验证无效', vD3.body?.valid === false, `→ ${JSON.stringify(vD3.body)}`);

  // ══ E. 「已拒绝」筛选有数据 ══
  console.log('\n── E. 证书管理「已拒绝」筛选 ──');
  const listE = await api('GET', `/certificates?status=REJECTED&page=1&limit=50`, tok);
  ok('筛选接口 200', listE.status === 200, `→ ${listE.status}`);
  ok('REJECTED 筛选包含驳回的证书', Array.isArray(listE.body?.items) && listE.body.items.some(c => c.id === certB.id), `→ ${listE.body?.items?.length} 条`);
  ok('REJECTED 证书不误入有效筛选', (await api('GET', '/certificates?status=ACTIVE&page=1&limit=50', tok)).body.items.every(c => c.id !== certB.id));

  // ══ F. approve 正常链路 ══
  console.log('\n── F. 批准申请正常发证 ──');
  const f1 = await makeBase('F');
  const appF = await p.certificateApplication.create({ data: { sessionId: f1.sess.id, studentId: f1.stu.id, status: 'PENDING', orgId: null } });
  createdAppIds.push(appF.id);
  const apF = await api('POST', `/certificates/applications/${appF.id}/approve`, tok, { operatorId: 1 });
  ok('批准成功', apF.status === 200 || apF.status === 201, `→ ${apF.status} ${JSON.stringify(apF.body)}`);
  const appFAfter = await p.certificateApplication.findUnique({ where: { id: appF.id } });
  ok('申请 APPROVED', appFAfter?.status === 'APPROVED', `→ ${appFAfter?.status}`);
  const certF = await p.certificate.findFirst({ where: { examSessionId: f1.sess.id } });
  if (certF) createdCertIds.push(certF.id);
  ok('批准后证书已生成', !!certF);
  ok('证书 APPROVED', certF?.approvalStatus === 'APPROVED', `→ ${certF?.approvalStatus}`);

  console.log(`\n════ 结果：${pass} 通过 / ${fail} 失败 ════`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error('❌ 测试异常：', e.message);
  process.exitCode = 1;
}).finally(async () => {
  // 清理：通知 → 证书 → 申请 → session → 用户
  if (createdStudentIds.length) {
    await p.notification.deleteMany({ where: { userId: { in: createdStudentIds } } }).catch(() => {});
  }
  await p.certificateApprovalLog.deleteMany({ where: { certificateId: { in: createdCertIds } } }).catch(() => {});
  await p.certificateTrace.deleteMany({ where: { certificateId: { in: createdCertIds } } }).catch(() => {});
  await p.certificate.deleteMany({ where: { id: { in: createdCertIds } } }).catch(() => {});
  await p.certificateApplication.deleteMany({ where: { id: { in: createdAppIds } } }).catch(() => {});
  await p.examSession.deleteMany({ where: { id: { in: createdSessionIds } } }).catch(() => {});
  await p.user.deleteMany({ where: { id: { in: createdStudentIds } } }).catch(() => {});
  await p.$disconnect();
});
