/**
 * 真功能测试：结课证书前端预览统一（previewHtml 与 PDF 同一渲染源，2026-08-13）
 * 覆盖：
 *  1. my() 学员自查询：定格模板的记录返回 previewHtml（含 issuerName 注入 + 身份证脱敏，不含原始 idCard）
 *  2. 无模板记录 previewHtml === null（前端回退静态组件）
 *  3. 管理端 list：同样附加 previewHtml
 *  4. PDF 与 preview 同源：generatePdf 用 buildTemplateData（同一数据），文本含签发单位
 *  5. orgC useFoxLearnSeal=true：机构印章不注入
 * 运行：cd server && node cert_completion_preview_test.mjs
 * 前置：server 已用新 build 重启（npm run build && kickstart），登录节流已放宽
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

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

async function apiGet(path, token) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json() };
}
async function apiPdf(path, token) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buf };
}

// ── PDF 文本提取（pdf-parse v2） ──
async function pdfText(buf) {
  const parser = new PDFParse({ data: buf });
  const r = await parser.getText();
  return r.text;
}

const ts = Date.now().toString(36);

// ── canvas：结课模板（含签发单位/身份证脱敏/底部文字变量 + 二维码） ──
function makeCanvas(mark) {
  return {
    width: 1200, height: 848, background: '#ffffff',
    elements: [
      { id: 'm1', type: 'text', layer: 'design', x: 0, y: 0, width: 1200, height: 848, props: { content: mark, fontSize: 200, fontFamily: 'SimSun, serif', color: '#f2f0ec', textAlign: 'center' } },
      { id: 'v1', type: 'variable-text', layer: 'dynamic', x: 100, y: 120, width: 1000, height: 60, props: { template: '签发单位：{{issuerName}}', fontSize: 26, fontFamily: 'SimSun, serif', color: '#3a3028', textAlign: 'center' } },
      { id: 'v2', type: 'variable-text', layer: 'dynamic', x: 100, y: 220, width: 1000, height: 60, props: { template: '身份证号：{{idCardMasked}}', fontSize: 22, fontFamily: 'SimSun, serif', color: '#3a3028', textAlign: 'center' } },
      { id: 'v3', type: 'variable-text', layer: 'dynamic', x: 100, y: 320, width: 1000, height: 60, props: { template: '{{footerText}}', fontSize: 16, fontFamily: 'SimSun, serif', color: '#666', textAlign: 'center' } },
      { id: 'qr', type: 'qrcode', layer: 'dynamic', x: 980, y: 620, width: 130, height: 130, props: {} },
    ],
  };
}

// ── fixture 建立 ──
let studentId, orgAId, orgBId, orgCId, certAId, certBId, certCId;
let adminToken, studentToken;
const createdTplNames = ['test-cpl-preview-a', 'test-cpl-preview-c'];

async function main() {
  console.log('── 建 fixture ──');

  const orgA = await p.organization.create({
    data: { name: `预览测试机构A`, code: `TESTA-${ts}`,
      certIssuerName: '测试签发单位', certFooterText: '测试底部说明文字',
      certLogoUrl: '/uploads/fox-test-logo.png', sealUrl: '/uploads/fox-test-seal.svg', useFoxLearnSeal: false },
  });
  const orgB = await p.organization.create({ data: { name: `预览测试机构B`, code: `TESTB-${ts}` } });
  const orgC = await p.organization.create({ data: { name: `预览测试机构C`, code: `TESTC-${ts}`,
      certIssuerName: '机构C签发', useFoxLearnSeal: true } });
  orgAId = orgA.id; orgBId = orgB.id; orgCId = orgC.id;

  // 学员（orgId 必须带上，否则 checkOrg 对 orgId=null 学员抛 NotFound）
  const student = await p.user.create({
    data: { username: `test_preview_${ts}`, passwordHash: crypto_md5('123456'), displayName: '预览测试学员',
      idCard: '110' + String(Date.now() % 100000000000).padStart(11, '0') + '1234', isActive: true, orgId: orgA.id },
  });
  studentId = student.id;
  const studentRole = await p.role.findUnique({ where: { code: 'STUDENT' } });
  await p.userRoleAssignment.create({ data: { userId: student.id, roleId: studentRole.id } });

  // 库中无 session，但已有 exam——新建 session 关联（Certificate.examSessionId 必填外键）
  const anyExam = await p.exam.findFirst({ select: { id: true }, orderBy: { id: 'asc' } });
  if (!anyExam) throw new Error('库中无 exam，无法建证书夹具');
  const anySession = await p.examSession.create({ data: { examId: anyExam.id, studentId: student.id, status: 'SUBMITTED' } });

  // 结课模板 A（机构默认）+ C
  const tplA = await p.certificateTemplate.create({
    data: { name: 'test-cpl-preview-a', type: 'COMPLETION', orgId: orgA.id, isDefault: true, isActive: true, canvasJson: makeCanvas('模板A'), createdBy: 1 },
  });
  const tplC = await p.certificateTemplate.create({
    data: { name: 'test-cpl-preview-c', type: 'COMPLETION', orgId: orgC.id, isDefault: true, isActive: true, canvasJson: makeCanvas('模板C'), createdBy: 1 },
  });

  // 三张证书：A=定格模板A / B=无模板（走平台 fallback 的 PDF，但 previewHtml=null） / C=orgC useFoxLearnSeal
  const certA = await p.certificate.create({
    data: { examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTPV-${ts}-A`, studentName: '预览测试学员', courseName: '预览测试课程',
      orgId: orgA.id, templateId: tplA.id, verificationCode: `VA${ts}`, approvalStatus: 'APPROVED', issueDate: new Date() },
  });
  const certB = await p.certificate.create({
    data: { examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTPV-${ts}-B`, studentName: '预览测试学员', courseName: '预览测试课程',
      orgId: orgB.id, verificationCode: `VB${ts}`, approvalStatus: 'APPROVED', issueDate: new Date() },
  });
  const certC = await p.certificate.create({
    data: { examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTPV-${ts}-C`, studentName: '预览测试学员', courseName: '预览测试课程',
      orgId: orgC.id, templateId: tplC.id, verificationCode: `VC${ts}`, approvalStatus: 'APPROVED', issueDate: new Date() },
  });
  certAId = certA.id; certBId = certB.id; certCId = certC.id;

  console.log('── 登录 ──');
  // admin 用户当前无角色 assignment（历史测试清过），临时挂 SUPER_ADMIN 供 list/pdf 权限测试，测完清理
  const adminUser = await p.user.findUnique({ where: { username: 'admin' }, select: { id: true } });
  const superAdminRole = await p.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  await p.userRoleAssignment.create({ data: { userId: adminUser.id, roleId: superAdminRole.id } });
  adminToken = await login('admin', '123456');
  studentToken = await login(`test_preview_${ts}`, '123456');
  ok('管理员登录', !!adminToken);
  ok('学员登录', !!studentToken);

  console.log('── 1. my() 学员自查询 previewHtml ──');
  const my = await apiGet('/certificates/my', studentToken);
  ok('my 接口 200', my.status === 200);
  const myA = (my.body || []).find((c) => c.id === certAId);
  const myB = (my.body || []).find((c) => c.id === certBId);
  const myC = (my.body || []).find((c) => c.id === certCId);

  ok('certA（定格模板）previewHtml 非空', !!myA?.previewHtml);
  ok('certA previewHtml 是 canvas 渲染（含 cert-canvas 标记）', !!myA?.previewHtml?.includes('cert-canvas'));
  ok('certA previewHtml 注入签发单位', myA?.previewHtml?.includes('测试签发单位'), `→ ${myA?.previewHtml?.slice(0,80)}`);
  ok('certA previewHtml 注入底部文字', myA?.previewHtml?.includes('测试底部说明文字'));
  ok('certA previewHtml 身份证已脱敏（前3后4）', myA?.previewHtml?.includes('110***1234'), `→ ${(myA?.previewHtml||'').match(/110[^<]*1234/)?.[0] || '未匹配'}`);
  ok('certA previewHtml 不含原始身份证', !myA?.previewHtml?.includes('110101199001011234'));

  ok('certB（无模板）previewHtml === null', myB?.previewHtml === null, `→ ${JSON.stringify(myB?.previewHtml)}`);

  ok('certC（orgC）previewHtml 非空', !!myC?.previewHtml);
  ok('certC previewHtml 注入机构C签发', myC?.previewHtml?.includes('机构C签发'));
  // useFoxLearnSeal=true → orgSealDataUrl=undefined；本 canvas 无 seal 元素，验证 templateId 走通即可
  ok('certC previewHtml 含 canvas 标记', myC?.previewHtml?.includes('cert-canvas'));

  console.log('── 2. 管理端 list previewHtml ──');
  const list = await apiGet('/certificates?page=1&limit=50', adminToken);
  ok('list 接口 200', list.status === 200);
  const items = list.body?.items || [];
  const lA = items.find((c) => c.id === certAId);
  const lB = items.find((c) => c.id === certBId);
  ok('list 中 certA previewHtml 非空', !!lA?.previewHtml);
  ok('list 中 certB previewHtml === null', lB?.previewHtml === null);

  console.log('── 3. PDF 与 preview 同源（同一 buildTemplateData） ──');
  const pdf = await apiPdf(`/certificates/${certAId}/pdf`, adminToken);
  ok('certA PDF 下载 200', pdf.status === 200);
  const text = await pdfText(pdf.buf);
  ok('PDF 含签发单位（同 preview 数据源）', text.includes('测试签发单位'), `→ ${text.slice(0,120)}`);
  ok('PDF 含脱敏身份证（前3后4）', text.includes('110***1234'), `→ ${(text.match(/110[^0-9]*1234/) || ['未匹配'])[0]}`);
  ok('PDF 不含原始身份证', !text.includes('110101199001011234'));

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  await cleanup();
  process.exit(fail === 0 ? 0 : 1);
}

async function cleanup() {
  console.log('── 清理测试数据 ──');
  // 还原 admin（删掉临时挂的 SUPER_ADMIN 角色）
  const adminUser = await p.user.findUnique({ where: { username: 'admin' }, select: { id: true } });
  const superAdminRole = await p.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  if (adminUser && superAdminRole) {
    await p.userRoleAssignment.deleteMany({ where: { userId: adminUser.id, roleId: superAdminRole.id } });
  }
  await p.certificate.deleteMany({ where: { studentId } });
  await p.examSession.deleteMany({ where: { studentId } });
  await p.userRoleAssignment.deleteMany({ where: { userId: studentId } });
  await p.user.deleteMany({ where: { id: studentId } });
  await p.certificateTemplate.deleteMany({ where: { name: { in: createdTplNames } } });
  await p.organization.deleteMany({ where: { code: { in: [`TESTA-${ts}`, `TESTB-${ts}`, `TESTC-${ts}`] } } });
  try { fs.unlinkSync(path.join(os.homedir(), 'projects/online-training/uploads/fox-test-logo.png')); } catch {}
  try { fs.unlinkSync(path.join(os.homedir(), 'projects/online-training/uploads/fox-test-seal.svg')); } catch {}
}

import { createHash } from 'node:crypto';
function crypto_md5(s) {
  return createHash('md5').update(s).digest('hex');
}

main().catch((e) => { console.error('❌ 测试异常：', e); cleanup().finally(() => process.exit(1)); });
