/**
 * 真功能测试：证书审批流模型 A（确认出证 + 审批解锁）— 2026-08-14
 *
 * 背景：此前 confirmScores（成绩确认）自动发证直接 APPROVED，绕过 cert_approval_required=true 的审批配置；
 *      且机构用户确认时绕过 cert_org_self_issue 直接发证。本次改为「确认出证 + 审批解锁」模型。
 *
 * 前置：server 已用新 build 重启；LOGIN_REQUIRE_CAPTCHA=false + LOGIN_THROTTLE_LIMIT/THROTTLE_LIMIT 已放宽。
 * 运行：cd server && node cert_approval_flow_test.mjs
 *
 * 场景（复用库中 exam 1【已确认 0 个 session】，每个场景独立 student+session+申请）：
 *  A. cert_approval_required=true（默认）→ 成绩确认 → 证书 PENDING + 申请 PENDING（关联 certificateId）
 *     + PENDING 下载 PDF→400 + verify valid:false + 学员端 my 不可见 + 管理端 PENDING 筛选命中 / ACTIVE 不命中
 *  B. 审批页批准 → 证书 APPROVED + 申请 APPROVED + 下载 200 + verify valid:true + 学员端可见 + ACTIVE 命中
 *  D. cert_org_self_issue=false + 机构用户(org_admin)确认 → 不自动发证，申请留 PENDING
 *  C. cert_approval_required=false → 成绩确认 → 证书 APPROVED + 申请 APPROVED（全自动）
 *  E. 驳回反向撤销：确认自动发证 PENDING → 驳回申请 → 关联证书被撤销(isRevoked) + 申请 REJECTED
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const p = new PrismaClient();
const API = 'http://localhost:3001/api';
const EXAM_ID = 1;

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

async function readCfg(key) { return (await p.systemConfig.findFirst({ where: { key } }))?.value ?? null; }
async function writeCfg(key, value) {
  const row = await p.systemConfig.findFirst({ where: { key } });
  const data = { value, desc: row?.desc ?? '', group: row?.group ?? 'cert', inputType: row?.inputType ?? 'boolean', options: row?.options ?? null };
  if (row) await p.systemConfig.update({ where: { id: row.id }, data });
  else await p.systemConfig.create({ data: { key, ...data } });
}

async function makeStudent(tag) {
  const ts = Date.now().toString(36);
  return p.user.create({ data: { username: `certflow_${tag}_${ts}`, passwordHash: createHash('md5').update('123456').digest('hex'), displayName: `证书流测试${tag}`, isActive: true } });
}
async function makeSession(studentId) {
  return p.examSession.create({ data: { examId: EXAM_ID, studentId, status: 'SUBMITTED', scoringStatus: 'PUBLISHED', isPassed: true, finalScore: 90 } });
}
async function findApp(sessionId) {
  return p.certificateApplication.findFirst({ where: { sessionId } });
}

const createdStudentIds = [];
const createdCertIds = [];

async function main() {
  console.log('════ 证书审批流模型 A 真测试 ════\n');
  // 记录并锁定配置
  const origApproval = await readCfg('cert_approval_required');
  const origSelfIssue = await readCfg('cert_org_self_issue');
  await writeCfg('cert_approval_required', 'true');
  await writeCfg('cert_org_self_issue', 'false');
  console.log('配置锁定：cert_approval_required=true, cert_org_self_issue=false\n');

  const adminTok = await login('admin', '123456');
  const orgTok = await login('org_admin', '123456');
  ok('admin（SUPER_ADMIN）登录', !!adminTok);
  ok('org_admin 登录', !!orgTok);

  // ══ 场景 A + B：审批模式（确认出证 → PENDING → 批准解锁） ══
  console.log('\n── 场景 A：cert_approval_required=true → 确认出证但待审批 ──');
  const stu1 = await makeStudent('A');
  createdStudentIds.push(stu1.id);
  const sess1 = await makeSession(stu1.id);
  await p.certificateApplication.create({ data: { sessionId: sess1.id, studentId: stu1.id, status: 'PENDING' } });
  const cA = await api('POST', `/grading/${EXAM_ID}/confirm`, adminTok);
  ok('confirm 返回 success', cA.body?.success === true, `→ ${JSON.stringify(cA.body)}`);
  ok('confirm certPendingApproval=1（进入待审批）', cA.body?.certPendingApproval === 1, `→ ${JSON.stringify(cA.body)}`);
  const app1 = await findApp(sess1.id);
  const certA = app1?.certificateId ? await p.certificate.findUnique({ where: { id: app1.certificateId } }) : null;
  if (certA) createdCertIds.push(certA.id);
  ok('证书已生成', !!certA, `→ app.certificateId=${app1?.certificateId}`);
  ok('证书 approvalStatus=PENDING', certA?.approvalStatus === 'PENDING', `→ ${certA?.approvalStatus}`);
  ok('申请 status 仍 PENDING（等审批解锁）', app1?.status === 'PENDING', `→ ${app1?.status}`);
  const logA = await p.certificateApprovalLog.findFirst({ where: { certificateId: certA?.id } });
  ok('审批日志 action=AUTO_ISSUED（证书id正确关联）', logA?.action === 'AUTO_ISSUED', `→ ${JSON.stringify(logA?.action)}`);

  // PENDING 下载门控
  const dlA = await api('GET', `/certificates/${certA.id}/pdf`, adminTok);
  ok('PENDING 下载 PDF → 400', dlA.status === 400, `→ ${dlA.status} ${JSON.stringify(dlA.body)}`);
  // verify 未生效
  const vA = await api('GET', `/certificates/verify?no=${encodeURIComponent(certA.certificateNo)}&code=${certA.verificationCode}`, null);
  ok('PENDING verify → valid:false', vA.body?.valid === false, `→ ${JSON.stringify(vA.body)}`);
  // 学员端不可见
  const stuTokA = await login(stu1.username, '123456');
  const myA = await api('GET', '/certificates/my', stuTokA);
  ok('学员端 my 不含 PENDING 证书', !(myA.body || []).some(c => c.id === certA.id), `→ ${myA.body?.length} 条`);
  // 管理端筛选
  const listPendA = await api('GET', '/certificates?status=PENDING&page=1&limit=100', adminTok);
  ok('管理端 PENDING 筛选命中', (listPendA.body?.items || []).some(c => c.id === certA.id));
  const listActA = await api('GET', '/certificates?status=ACTIVE&page=1&limit=100', adminTok);
  ok('管理端 ACTIVE 筛选不命中 PENDING', !(listActA.body?.items || []).some(c => c.id === certA.id));
  // 状态筛选确实生效（此前 status 参数被忽略）：对比无筛选列表
  const listAllA = await api('GET', '/certificates?page=1&limit=100', adminTok);
  ok('PENDING 证书出现在无筛选列表', (listAllA.body?.items || []).some(c => c.id === certA.id));

  // ══ 场景 B：批准解锁 ══
  console.log('\n── 场景 B：审批页批准 → 证书生效 ──');
  const apA = await api('POST', `/certificates/applications/${app1.id}/approve`, adminTok, { operatorId: 1 });
  ok('approve 成功', apA.status === 200 || apA.status === 201, `→ ${apA.status}`);
  const certA2 = await p.certificate.findUnique({ where: { id: certA.id } });
  const app1b = await findApp(sess1.id);
  ok('批准后证书 APPROVED', certA2?.approvalStatus === 'APPROVED', `→ ${certA2?.approvalStatus}`);
  ok('批准后申请 APPROVED', app1b?.status === 'APPROVED', `→ ${app1b?.status}`);
  const dlA2 = await api('GET', `/certificates/${certA.id}/pdf`, adminTok);
  ok('APPROVED 下载 PDF → 200', dlA2.status === 200, `→ ${dlA2.status}`);
  const vA2 = await api('GET', `/certificates/verify?no=${encodeURIComponent(certA.certificateNo)}&code=${certA.verificationCode}`, null);
  ok('APPROVED verify → valid:true', vA2.body?.valid === true, `→ ${JSON.stringify(vA2.body)}`);
  const myA2 = await api('GET', '/certificates/my', stuTokA);
  ok('学员端 my 含 APPROVED 证书', (myA2.body || []).some(c => c.id === certA.id));
  const listActA2 = await api('GET', '/certificates?status=ACTIVE&page=1&limit=100', adminTok);
  ok('管理端 ACTIVE 筛选命中', (listActA2.body?.items || []).some(c => c.id === certA.id));

  // ══ 场景 D：机构用户确认 + 机构不能自行发证 → 不自动发证 ══
  console.log('\n── 场景 D：cert_org_self_issue=false + org_admin 确认 → 不自动发证 ──');
  const stu2 = await makeStudent('D');
  createdStudentIds.push(stu2.id);
  const sess2 = await makeSession(stu2.id);
  await p.certificateApplication.create({ data: { sessionId: sess2.id, studentId: stu2.id, status: 'PENDING' } });
  const cD = await api('POST', `/grading/${EXAM_ID}/confirm`, orgTok);
  ok('org_admin confirm 成功', cD.body?.success === true, `→ ${JSON.stringify(cD.body)}`);
  const app2 = await findApp(sess2.id);
  ok('申请仍 PENDING（等协会审批）', app2?.status === 'PENDING', `→ ${app2?.status}`);
  ok('未自动发证（certificateId 为空）', app2?.certificateId == null, `→ ${app2?.certificateId}`);
  const certD = app2?.certificateId ? await p.certificate.findUnique({ where: { id: app2.certificateId } }) : null;
  ok('无证书生成', certD == null);
  // 清理：驳回 app2 避免后续 confirm 处理它（同时测 reject 无证书路径）
  const rejD = await api('POST', `/certificates/applications/${app2.id}/reject`, adminTok, { reason: '测试清理', operatorId: 1 });
  ok('驳回 app2 成功', rejD.status === 200 || rejD.status === 201, `→ ${rejD.status}`);

  // ══ 场景 C：cert_approval_required=false → 全自动发证 ══
  console.log('\n── 场景 C：cert_approval_required=false → 确认直接 APPROVED ──');
  await writeCfg('cert_approval_required', 'false');
  const stu3 = await makeStudent('C');
  createdStudentIds.push(stu3.id);
  const sess3 = await makeSession(stu3.id);
  await p.certificateApplication.create({ data: { sessionId: sess3.id, studentId: stu3.id, status: 'PENDING' } });
  const cC = await api('POST', `/grading/${EXAM_ID}/confirm`, adminTok);
  ok('confirm 返回 certIssued=1', cC.body?.certIssued === 1, `→ ${JSON.stringify(cC.body)}`);
  const app3 = await findApp(sess3.id);
  const certC = app3?.certificateId ? await p.certificate.findUnique({ where: { id: app3.certificateId } }) : null;
  if (certC) createdCertIds.push(certC.id);
  ok('证书 APPROVED（全自动）', certC?.approvalStatus === 'APPROVED', `→ ${certC?.approvalStatus}`);
  ok('申请 APPROVED', app3?.status === 'APPROVED', `→ ${app3?.status}`);
  const dlC = await api('GET', `/certificates/${certC.id}/pdf`, adminTok);
  ok('APPROVED 可下载', dlC.status === 200, `→ ${dlC.status}`);

  // ══ 场景 E：驳回反向撤销（确认出证 PENDING → 驳回 → 证书撤销） ══
  console.log('\n── 场景 E：驳回 → 反向撤销已发的 PENDING 证书 ──');
  await writeCfg('cert_approval_required', 'true');
  const stu4 = await makeStudent('E');
  createdStudentIds.push(stu4.id);
  const sess4 = await makeSession(stu4.id);
  await p.certificateApplication.create({ data: { sessionId: sess4.id, studentId: stu4.id, status: 'PENDING' } });
  const cE = await api('POST', `/grading/${EXAM_ID}/confirm`, adminTok);
  const app4 = await findApp(sess4.id);
  const certE = app4?.certificateId ? await p.certificate.findUnique({ where: { id: app4.certificateId } }) : null;
  if (certE) createdCertIds.push(certE.id);
  ok('确认后证书 PENDING', certE?.approvalStatus === 'PENDING');
  const rejE = await api('POST', `/certificates/applications/${app4.id}/reject`, adminTok, { reason: '成绩资格不符', operatorId: 1 });
  ok('驳回成功', rejE.status === 200 || rejE.status === 201, `→ ${rejE.status}`);
  const certE2 = await p.certificate.findUnique({ where: { id: certE.id } });
  const app4b = await findApp(sess4.id);
  ok('驳回后证书被撤销（isRevoked=true）', certE2?.isRevoked === true, `→ isRevoked=${certE2?.isRevoked}`);
  ok('驳回后申请 REJECTED', app4b?.status === 'REJECTED', `→ ${app4b?.status}`);
  const logE = await p.certificateApprovalLog.findFirst({ where: { certificateId: certE.id, action: 'REJECTED' } });
  ok('驳回日志 certificateId=真实证书id（非申请id）', logE?.certificateId === certE.id, `→ ${logE?.certificateId}`);

  // ── 还原配置 ──
  if (origApproval == null) { const r = await p.systemConfig.findFirst({ where: { key: 'cert_approval_required' } }); if (r) await p.systemConfig.delete({ where: { id: r.id } }); }
  else await writeCfg('cert_approval_required', origApproval);
  if (origSelfIssue == null) { const r = await p.systemConfig.findFirst({ where: { key: 'cert_org_self_issue' } }); if (r) await p.systemConfig.delete({ where: { id: r.id } }); }
  else await writeCfg('cert_org_self_issue', origSelfIssue);

  console.log(`\n════ 结果：${pass} 通过 / ${fail} 失败 ════`);
  process.exit(fail === 0 ? 0 : 1);
}

async function cleanupAll() {
  // 清理顺序：审批日志 → 证书 → session（级联删申请）→ 学生
  await p.certificateApprovalLog.deleteMany({ where: { certificateId: { in: createdCertIds } } }).catch(() => {});
  await p.certificate.deleteMany({ where: { studentId: { in: createdStudentIds } } }).catch(() => {});
  await p.examSession.deleteMany({ where: { studentId: { in: createdStudentIds } } }).catch(() => {});
  await p.user.deleteMany({ where: { id: { in: createdStudentIds } } }).catch(() => {});
  await p.$disconnect();
}

main().then(cleanupAll).catch(async (e) => {
  console.error('❌ 测试异常：', e.message);
  await cleanupAll();
  process.exit(1);
});
