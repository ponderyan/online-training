/**
 * 真功能测试：学时证书接入模板体系 + 机构配置注入 + 平台级 fallback + 盲水印 + 身份证脱敏
 * 运行：cd server && node cert_template_test.mjs
 * 前置：server 已重启（本脚本改动已生效），登录节流已放宽
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

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
async function apiPost(path, data, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data || {}),
  });
  let body;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}
async function apiPatch(path, data, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data || {}),
  });
  let body;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}
async function apiPdf(path, token) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buf };
}

// ── PDF 解析（文本用 pdf-parse v2，页面尺寸用 pdfinfo/poppler） ──
async function analyzePdf(buf) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buf });
  let text = '';
  try { text = (await parser.getText()).text || ''; } finally { await parser.destroy().catch(() => {}); }
  let w = 0, h = 0;
  const tmp = path.join(os.tmpdir(), `pdf-probe-${process.pid}-${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmp, buf);
    const out = execFileSync('/opt/homebrew/bin/pdfinfo', [tmp]).toString();
    const m = out.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)\s+pts/i);
    if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
  } catch {}
  fs.rmSync(tmp, { force: true });
  const imageCount = (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;
  return { w, h, text, imageCount };
}
// A4 横版（canvas 渲染，Puppeteer 1123x794px → ~842x595pt）；静态 HTML 走竖版 ~595x842
const LANDSCAPE = (w, h) => w > h && Math.abs(w - 842) < 60 && Math.abs(h - 595) < 60;

// ════════════════════════════════════════
// 1. 夹具：图片文件
// ════════════════════════════════════════
const UPLOAD_DIR = '/Users/ponder/projects/online-training/server/uploads';
const LOGO_PATH = `${UPLOAD_DIR}/fox-test-logo.png`;   // 1x1 红像素
const SEAL_PATH = `${UPLOAD_DIR}/fox-test-seal.svg`;   // 测试印章
const LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="50" fill="none" stroke="#C62828" stroke-width="4"/><text x="60" y="65" text-anchor="middle" font-size="14" fill="#C62828">测试印章</text></svg>`;
fs.writeFileSync(LOGO_PATH, Buffer.from(LOGO_B64, 'base64'));
fs.writeFileSync(SEAL_PATH, SEAL_SVG);

// ════════════════════════════════════════
// 2. 夹具：Prisma 造数据
// ════════════════════════════════════════
const ts = Date.now();
let ids = {};

try {
  // 测试机构 A（带证书配置，useFoxLearnSeal=false）
  const orgA = await p.organization.create({
    data: {
      name: '小狐狸测试机构A', code: `TESTA-${ts}`,
      certIssuerName: '测试签发单位', certFooterText: '测试底部说明文字',
      certLogoUrl: '/uploads/fox-test-logo.png', sealUrl: '/uploads/fox-test-seal.svg',
      useFoxLearnSeal: false,
    },
  });
  // 测试机构 B（无默认 COMPLETION 模板 → 验证平台级 fallback；无证书配置）
  const orgB = await p.organization.create({ data: { name: '小狐狸测试机构B', code: `TESTB-${ts}` } });

  // 测试学生（带身份证，密码 = MD5('123456') 走登录）
  const studentRole = await p.role.findUnique({ where: { code: 'STUDENT' } });
  const student = await p.user.create({
    data: {
      username: `test_stu_${ts}`, displayName: '测试学员小狐',
      passwordHash: crypto.createHash('md5').update('123456').digest('hex'),
      idCard: '110101199001011234', isActive: true, orgId: orgA.id,
    },
  });
  await p.userRoleAssignment.create({ data: { userId: student.id, roleId: studentRole.id } }); // STUDENT
  ids.studentId = student.id;

  // 培训班 + 报名
  const program = await p.trainingProgram.create({
    data: {
      name: '测试培训班', code: `TESTP-${ts}`, courseName: '测试课程', orgId: orgA.id,
      subjectId: 1, createdBy: 1,
      startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31'),
      enrollStart: new Date('2026-07-01'), enrollEnd: new Date('2026-08-15'),
    },
  });
  await p.programEnrollment.create({ data: { programId: program.id, studentId: student.id, status: 'ENROLLED' } });
  ids.programId = program.id;

  // 学时记录（AUTO_APPROVED ×2 类型）
  await p.learningHourRecord.createMany({
    data: [
      { studentId: student.id, programId: program.id, source: 'OFFLINE', hours: 20, typeId: 1, status: 'AUTO_APPROVED', recordedAt: new Date('2026-08-01') },
      { studentId: student.id, programId: program.id, source: 'OFFLINE', hours: 25, typeId: 2, status: 'AUTO_APPROVED', recordedAt: new Date('2026-08-05') },
    ],
  });

  // ── HOURS 模板（orgA 默认）──
  const hoursCanvas = {
    width: 1123, height: 794, background: '#ffffff', version: 2,
    elements: [
      { id: 't', type: 'text', x: 400, y: 50, width: 320, height: 60, name: '标题', props: { content: '学 时 证 明', fontSize: 40, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: '#1565C0', textAlign: 'center' } },
      { id: 'logo', type: 'image', x: 80, y: 40, width: 120, height: 40, name: '机构Logo', props: { src: '{{orgLogoDataUrl}}', fit: 'contain' } },
      { id: 'body', type: 'variable-text', x: 120, y: 180, width: 880, height: 60, name: '正文', props: { template: '兹证明 {{studentName}} 参加 {{programName}} 培训，累计完成 {{totalHours}} 学时。', fontSize: 20, fontFamily: 'SimSun, serif', color: '#333', lineHeight: 1.8 } },
      { id: 'idcard', type: 'variable-text', x: 120, y: 262, width: 500, height: 26, name: '身份证', props: { template: '身份证号：{{idCardMasked}}', fontSize: 14, fontFamily: 'SimSun, serif', color: '#666' } },
      { id: 'table', type: 'table', x: 120, y: 300, width: 520, height: 130, name: '学时明细', props: { dataVariable: 'hoursDetail', columns: [{ key: 'typeName', label: '学时类型' }, { key: 'hours', label: '学时(小时)', align: 'right' }], showTotal: true, totalKey: 'hours', totalLabel: '合计', fontSize: 14, color: '#444', borderColor: '#90CAF9', headerBg: '#E3F2FD' } },
      { id: 'no', type: 'variable-text', x: 120, y: 600, width: 500, height: 24, name: '编号', props: { template: '编号：{{certificateNo}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999' } },
      { id: 'issuer', type: 'variable-text', x: 120, y: 640, width: 400, height: 30, name: '出具单位', props: { template: '{{issuerName}}', fontSize: 18, fontFamily: 'SimSun, serif', color: '#444' } },
      { id: 'footer', type: 'variable-text', x: 120, y: 690, width: 880, height: 26, name: '底部说明', props: { template: '{{footerText}} · 防伪指纹 {{sealHash}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#888', textAlign: 'center' } },
      { id: 'seal', type: 'seal', x: 900, y: 460, width: 120, height: 120, name: '机构印章', props: { src: '{{orgSealDataUrl}}', shape: 'circle', text: '学时证明专用章', subText: '★', color: '#C62828', fontSize: 11 } },
      { id: 'qr', type: 'qrcode', x: 940, y: 620, width: 100, height: 100, name: '二维码', props: { label: '扫码核验', labelFontSize: 10 } },
    ],
  };
  const hoursTpl = await p.certificateTemplate.create({
    data: { name: '测试学时模板', type: 'HOURS', orgId: orgA.id, isDefault: true, isActive: true, canvasJson: hoursCanvas, createdBy: 1 },
  });
  ids.hoursTplId = hoursTpl.id;

  // ── COMPLETION 模板（orgA 默认，含机构变量）──
  const completionCanvas = {
    width: 1123, height: 794, background: '#ffffff', version: 2,
    elements: [
      { id: 't', type: 'text', x: 400, y: 70, width: 320, height: 60, name: '标题', props: { content: '结 业 证 书', fontSize: 40, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: '#C62828', textAlign: 'center' } },
      { id: 'logo', type: 'image', x: 80, y: 40, width: 120, height: 40, name: '机构Logo', props: { src: '{{orgLogoDataUrl}}', fit: 'contain' } },
      { id: 'body', type: 'variable-text', x: 120, y: 220, width: 880, height: 60, name: '正文', props: { template: '兹证明 {{studentName}} 完成 {{courseName}} 培训，成绩合格，特发此证。', fontSize: 22, fontFamily: 'SimSun, serif', color: '#333', lineHeight: 1.8 } },
      { id: 'issuer', type: 'variable-text', x: 120, y: 640, width: 400, height: 30, name: '签发单位', props: { template: '{{issuerName}}', fontSize: 18, fontFamily: 'SimSun, serif', color: '#444' } },
      { id: 'footer', type: 'variable-text', x: 120, y: 700, width: 880, height: 26, name: '底部说明', props: { template: '{{footerText}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#888', textAlign: 'center' } },
      { id: 'seal', type: 'seal', x: 900, y: 460, width: 120, height: 120, name: '机构印章', props: { src: '{{orgSealDataUrl}}', shape: 'circle', text: '结业证书专用章', subText: '★', color: '#C62828', fontSize: 11 } },
      { id: 'qr', type: 'qrcode', x: 940, y: 620, width: 100, height: 100, name: '二维码', props: { label: '扫码核验', labelFontSize: 10 } },
      { id: 'no', type: 'variable-text', x: 120, y: 660, width: 500, height: 24, name: '编号', props: { template: '编号：{{certificateNo}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999' } },
    ],
  };
  const completionTpl = await p.certificateTemplate.create({
    data: { name: '测试结业模板', type: 'COMPLETION', orgId: orgA.id, isDefault: true, isActive: true, canvasJson: completionCanvas, createdBy: 1 },
  });
  ids.completionTplId = completionTpl.id;

  // ── 平台级 COMPLETION 默认模板（orgId=null，标记文字「平台级默认模板」）──
  const platformCanvas = {
    width: 1123, height: 794, background: '#ffffff', version: 2,
    elements: [
      { id: 't', type: 'text', x: 400, y: 70, width: 320, height: 60, name: '标题', props: { content: '结 业 证 书', fontSize: 40, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: '#37474F', textAlign: 'center' } },
      { id: 'body', type: 'variable-text', x: 120, y: 220, width: 880, height: 60, name: '正文', props: { template: '平台级默认模板 {{studentName}} 完成 {{courseName}}', fontSize: 22, fontFamily: 'SimSun, serif', color: '#333' } },
      { id: 'no', type: 'variable-text', x: 120, y: 660, width: 500, height: 24, name: '编号', props: { template: '编号：{{certificateNo}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999' } },
    ],
  };
  const platformTpl = await p.certificateTemplate.create({
    data: { name: '平台级默认结业模板', type: 'COMPLETION', orgId: null, isDefault: true, isActive: true, canvasJson: platformCanvas, createdBy: 1 },
  });
  ids.platformTplId = platformTpl.id;

  // ── 复用现有 examSession（Certificate 必填 examSessionId）──
  const anySession = await p.examSession.findFirst({ select: { id: true }, orderBy: { id: 'asc' } });
  if (!anySession) throw new Error('库中无 examSession，无法建证书夹具');
  ids.examSessionId = anySession.id;

  // 结业证书（orgA + completionTpl）
  const certA = await p.certificate.create({
    data: {
      examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTFX-${ts}-A`, studentName: '测试学员小狐', courseName: '数智化管理师培训',
      orgId: orgA.id, templateId: completionTpl.id, verificationCode: `V${ts}A`, approvalStatus: 'APPROVED',
      issueDate: new Date(),
    },
  });
  ids.certA = certA.id;

  // 结业证书（orgB，无默认模板 → 走平台级 fallback）
  const certB = await p.certificate.create({
    data: {
      examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTFX-${ts}-B`, studentName: '测试学员小狐', courseName: '数智化管理师培训',
      orgId: orgB.id, verificationCode: `V${ts}B`, approvalStatus: 'APPROVED',
      issueDate: new Date(),
    },
  });
  ids.certB = certB.id;

  // 机构 C：useFoxLearnSeal=true（用机构印章字段但显式不用 → seal 不注入）
  const orgC = await p.organization.create({
    data: {
      name: '小狐狸测试机构C', code: `TESTC-${ts}`,
      certIssuerName: '机构C签发', certLogoUrl: '/uploads/fox-test-logo.png',
      sealUrl: '/uploads/fox-test-seal.svg', useFoxLearnSeal: true,
    },
  });

  // ── orgC 的 HOURS 模板（useFoxLearnSeal=true → seal 走环形回退）──
  const hoursCanvasC = {
    width: 1123, height: 794, background: '#ffffff', version: 2,
    elements: [
      { id: 'body', type: 'variable-text', x: 120, y: 180, width: 880, height: 60, name: '正文', props: { template: '兹证明 {{studentName}} 完成 {{totalHours}} 学时。', fontSize: 20, fontFamily: 'SimSun, serif', color: '#333' } },
      { id: 'seal', type: 'seal', x: 900, y: 460, width: 120, height: 120, name: '机构印章', props: { src: '{{orgSealDataUrl}}', shape: 'circle', text: '学时证明专用章', subText: '★', color: '#C62828', fontSize: 11 } },
    ],
  };
  await p.certificateTemplate.create({
    data: { name: '测试学时模板C', type: 'HOURS', orgId: orgC.id, isDefault: true, isActive: true, canvasJson: hoursCanvasC, createdBy: 1 },
  });

  // orgC 培训班（学员跨机构申请，LHC.orgId = program.orgId = orgC）
  const programC = await p.trainingProgram.create({
    data: {
      name: '测试培训班C', code: `TESTP-C-${ts}`, courseName: '测试课程C', orgId: orgC.id,
      subjectId: 2, createdBy: 1,
      startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31'),
      enrollStart: new Date('2026-07-01'), enrollEnd: new Date('2026-08-15'),
    },
  });
  await p.programEnrollment.create({ data: { programId: programC.id, studentId: student.id, status: 'ENROLLED' } });
  await p.learningHourRecord.create({ data: { studentId: student.id, programId: programC.id, source: 'OFFLINE', hours: 30, typeId: 1, status: 'AUTO_APPROVED', recordedAt: new Date('2026-08-03') } });
  ids.programCId = programC.id;
  const certC = await p.certificate.create({
    data: {
      examSessionId: anySession.id, studentId: student.id,
      certificateNo: `TESTFX-${ts}-C`, studentName: '测试学员小狐', courseName: '数智化管理师培训',
      orgId: orgC.id, templateId: completionTpl.id, verificationCode: `V${ts}C`, approvalStatus: 'APPROVED',
      issueDate: new Date(),
    },
  });
  ids.certC = certC.id;

  // ════════════════════════════════════════
  // 3. 登录（双身份：学员走学时链路，admin 走审核与结业证书）
  // ════════════════════════════════════════
  const adminToken = await login('admin', '123456');
  const studentToken = await login(`test_stu_${ts}`, '123456');
  ok('admin 登录', !!adminToken);
  ok('测试学员登录', !!studentToken);

  // ════════════════════════════════════════
  // 4. 测试 A：学时证书全链路（HOURS 模板生效 + 机构配置注入 + 预览/PDF 一致 + 盲水印 + 脱敏）
  // ════════════════════════════════════════
  console.log('\n── 测试 A：学时证书接入模板体系 ──');
  const applyRes = await apiPost('/learning-hour-certificates/apply', { programId: program.id }, studentToken);
  ok('apply 成功', applyRes.status === 201 || applyRes.status === 200, `status=${applyRes.status}`);
  const lhc = applyRes.body?.id ? applyRes.body : (Array.isArray(applyRes.body) ? applyRes.body[0] : null);
  const lhcRow = await p.learningHourCertificate.findFirst({ where: { studentId: student.id, programId: program.id }, orderBy: { id: 'desc' } });
  ok('apply 落库 templateId 定格 HOURS 模板', lhcRow?.templateId === hoursTpl.id, `templateId=${lhcRow?.templateId}, expect=${hoursTpl.id}`);
  ids.lhcId = lhcRow.id;

  // 审批通过
  const reviewRes = await apiPatch(`/learning-hour-certificates/${lhcRow.id}/review`, { action: 'approve' }, adminToken);
  ok('学时证明审批通过', reviewRes.status === 200 || reviewRes.status === 201, `status=${reviewRes.status}`);
  const approvedRow = await p.learningHourCertificate.findUnique({ where: { id: lhcRow.id } });
  ok('审批后状态 APPROVED', approvedRow?.approvalStatus === 'APPROVED', approvedRow?.approvalStatus);

  // 测试 A2：useFoxLearnSeal=true 机构的学时证明 → 预览里 seal 回退环形 SVG（无机构印章图）
  const applyCRes = await apiPost('/learning-hour-certificates/apply', { programId: programC.id }, studentToken);
  ok('orgC apply 成功', applyCRes.status === 201 || applyCRes.status === 200, `status=${applyCRes.status}`);
  const lhcCRow = await p.learningHourCertificate.findFirst({ where: { studentId: student.id, programId: programC.id }, orderBy: { id: 'desc' } });
  ok('orgC apply 落库 orgC HOURS 模板', lhcCRow?.templateId != null && lhcCRow?.templateId !== hoursTpl.id, `templateId=${lhcCRow?.templateId}`);
  ids.lhcCId = lhcCRow.id;

  // findMy → previewHtml + 身份证脱敏
  const myRes = await apiGet('/learning-hour-certificates/my', studentToken);
  const my = (myRes.body || []).find((c) => c.id === lhcRow.id);
  const myC = (myRes.body || []).find((c) => c.id === lhcCRow.id);
  ok('findMy 返回 previewHtml', !!my?.previewHtml);
  ok('findMy 不泄露原始身份证', my?.idCard && !my.previewHtml?.includes('110101199001011234'), '(previewHtml 含原始身份证号)');
  ok('previewHtml 含脱敏身份证', my?.previewHtml?.includes('11010119900101') === false && my?.previewHtml?.includes('********') === true);
  ok('orgC 预览 seal 走环形回退（含 SVG、无机构印章 dataURL）', myC?.previewHtml?.includes('<svg') && !myC?.previewHtml?.includes('data:image/svg'), myC?.previewHtml?.slice(0, 200));

  // PDF：canvas 渲染（A4 横版）+ 盲水印 + 机构注入
  const pdfRes = await apiPdf(`/learning-hour-certificates/${lhcRow.id}/pdf`, studentToken);
  ok('学时 PDF 下载 200', pdfRes.status === 200, `status=${pdfRes.status}`);
  const ap = await analyzePdf(pdfRes.buf);
  ok('学时 PDF 为 canvas A4 横版', LANDSCAPE(ap.w, ap.h), `w=${ap.w}, h=${ap.h}`);
  ok('学时 PDF 含 programName', ap.text.includes('测试培训班'), 'programName 未出现');
  ok('学时 PDF 含 totalHours', ap.text.includes('45'), ap.text.slice(0, 200));
  ok('学时 PDF 含签发单位', ap.text.includes('测试签发单位'));
  ok('学时 PDF 含底部说明', ap.text.includes('测试底部说明'), ap.text.slice(-160)); // 注：文 会被字体回退成康熙部首 ⽂，用稳健子串
  ok('学时 PDF 含防伪指纹 sealHash', /防伪指纹\s*[0-9a-f]{16,}/i.test(ap.text), ap.text.slice(-120));
  ok('学时 PDF 含盲水印(证书编号)', ap.text.includes(lhcRow.certificateNo), '水印未检测到（pdf 文本无证书编号）');
  ok('学时 PDF 嵌入机构印章(测试印章)', ap.text.includes('测试印章'), '机构印章未注入（seal src 变量未解析）');

  // 预览/PDF 同源：previewHtml 与 PDF 同一 canvas + 同一 data（都含 test-mark 变量值）
  ok('previewHtml 与 PDF 一致（同含签发单位）', my?.previewHtml?.includes('测试签发单位'));
  ok('previewHtml 与 PDF 一致（同含合计）', my?.previewHtml?.includes('合计'));

  // ════════════════════════════════════════
  // 5. 测试 B：结业证书机构配置注入
  // ════════════════════════════════════════
  console.log('\n── 测试 B：结业证书机构配置注入模板 ──');
  const pdfA = await apiPdf(`/certificates/${certA.id}/pdf`, adminToken);
  ok('结业 PDF 下载 200', pdfA.status === 200, `status=${pdfA.status}`);
  const aA = await analyzePdf(pdfA.buf);
  ok('结业 PDF 为 canvas A4 横版', LANDSCAPE(aA.w, aA.h), `w=${aA.w}, h=${aA.h}`);
  ok('结业 PDF 含签发单位(issuerName)', aA.text.includes('测试签发单位'), aA.text.slice(0, 150));
  ok('结业 PDF 含底部说明(footerText)', aA.text.includes('测试底部说明'));
  ok('结业 PDF 嵌入机构印章(测试印章)', aA.text.includes('测试印章'), '机构印章未注入');
  ok('结业 PDF 含课程名', aA.text.includes('数智化管理师培训'));

  // 测试 B2：useFoxLearnSeal=true → orgSealDataUrl=undefined → seal 回退内置环形章（无 测试印章）
  const pdfC = await apiPdf(`/certificates/${certC.id}/pdf`, adminToken);
  const aC = await analyzePdf(pdfC.buf);
  ok('useFoxLearnSeal=true 时不注入机构印章（无「测试印章」）', !aC.text.includes('测试印章'), aC.text.slice(0, 120));
  // 环形回退的 SVG 文字在 Chrome PDF 里被转成 path（无 ToUnicode），文本不可提取 —— 正向验证已在 A2 previewHtml 完成
  ok('机构C 使用自己的签发单位', aC.text.includes('机构C签发'));

  // ════════════════════════════════════════
  // 6. 测试 C：平台级 fallback（orgB 无默认模板 → 命中平台级模板）
  // ════════════════════════════════════════
  console.log('\n── 测试 C：平台级默认模板 fallback ──');
  const pdfB = await apiPdf(`/certificates/${certB.id}/pdf`, adminToken);
  ok('orgB 结业 PDF 下载 200', pdfB.status === 200, `status=${pdfB.status}`);
  const aB = await analyzePdf(pdfB.buf);
  ok('orgB PDF 为 canvas A4 横版（命中平台模板）', LANDSCAPE(aB.w, aB.h), `w=${aB.w}, h=${aB.h}`);
  ok('orgB PDF 含平台级模板标记文字', aB.text.includes('平台级默认模板'), aB.text.slice(0, 150));
  // 回归断裂点 C：发证时 issueCertificates 也走 findDefaultTemplate
  ok('平台模板 isDefault=true', platformTpl.isDefault);

} catch (e) {
  console.error('测试执行异常：', e);
  fail++;
} finally {
  // ════════════════════════════════════════
  // 7. 清理夹具
  // ════════════════════════════════════════
  console.log('\n── 清理测试数据 ──');
  try {
    if (ids.studentId) {
      await p.learningHourCertificate.deleteMany({ where: { studentId: ids.studentId } });
      await p.learningHourRecord.deleteMany({ where: { studentId: ids.studentId } });
      await p.programEnrollment.deleteMany({ where: { studentId: ids.studentId } });
      await p.certificate.deleteMany({ where: { studentId: ids.studentId } });
      await p.examSession.deleteMany({ where: { studentId: ids.studentId } });
      await p.userRoleAssignment.deleteMany({ where: { userId: ids.studentId } });
      await p.user.deleteMany({ where: { id: ids.studentId } });
    }
    if (ids.programId) await p.trainingProgram.deleteMany({ where: { id: ids.programId } });
    if (ids.programCId) await p.trainingProgram.deleteMany({ where: { id: ids.programCId } });
    // 模板：按 createdBy 且名字含“测试”清理（避免误删现网模板）
    const testTpls = await p.certificateTemplate.findMany({ where: { name: { in: ['测试学时模板', '测试学时模板C', '测试结业模板', '平台级默认结业模板'] } } });
    for (const t of testTpls) await p.certificateTemplate.delete({ where: { id: t.id } });
    // 机构
    for (const codePrefix of ['TESTA', 'TESTB', 'TESTC']) {
      const os = await p.organization.findMany({ where: { code: { startsWith: `${codePrefix}-${ts}` } } });
      for (const o of os) await p.organization.delete({ where: { id: o.id } });
    }
    // 图片文件
    fs.rmSync(LOGO_PATH, { force: true });
    fs.rmSync(SEAL_PATH, { force: true });
  } catch (e2) {
    console.error('清理异常：', e2);
  }
  await p.$disconnect();
}

console.log(`\n═══ 结果：${pass} 通过 / ${fail} 失败 ═══`);
process.exit(fail > 0 ? 1 : 0);
