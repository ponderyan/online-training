/**
 * 教材 OCR 功能测试：扫描 PDF / 中文图片 / 纯图片 PPTX 三种样本
 * 验证：上传 → OCR(RapidOCR) → 章节结构正确
 * 前置：server 已运行，测试期验证码已放宽
 */
import { readFileSync } from 'fs';

const BASE = 'http://localhost:3001/api';
let token = '';
let failures = 0;

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const d = await res.json();
  if (!d.accessToken) throw new Error('登录失败: ' + JSON.stringify(d));
  token = d.accessToken;
  console.log('✅ 登录成功');
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function getSubject() {
  const { json } = await api('/subjects');
  if (!json || json.length === 0) throw new Error('无科目数据');
  return json[0].id;
}

async function uploadMaterial(filePath, name, batchNote = '测试：单选题5道') {
  const buf = readFileSync(filePath);
  const fd = new FormData();
  const fname = filePath.split('/').pop();
  fd.append('file', new Blob([buf]), fname);
  fd.append('name', name);
  fd.append('subjectId', String(await getSubject()));
  fd.append('batchNote', batchNote);
  const res = await fetch(`${BASE}/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function check(cond, label, detail = '') {
  if (cond) console.log(`  ✅ ${label}`);
  else { console.log(`  ❌ ${label} ${detail}`); failures++; }
}

async function main() {
  await login();
  const cases = [
    { file: '/tmp/scan-book.pdf',  name: 'OCR扫描教材', expectChapters: ['第一章', '第二章'] },
    { file: '/tmp/rapidocr-test.png', name: 'OCR图片教材', expectChapters: ['第一章'] },
    { file: '/tmp/img-only-book.pptx', name: 'OCR图片PPT', expectChapters: ['第一章', '第二章'] },
  ];

  for (const c of cases) {
    console.log(`\n── ${c.file.split('/').pop()} (${c.name}) ──`);
    const { status, json } = await uploadMaterial(c.file, c.name);
    check(status === 201, `上传返回 ${status}`);
    if (status !== 201 || !json) { console.log('  ', JSON.stringify(json)); continue; }
    check(json.status === 'OCR_DONE', `状态=${json.status}`, `(期望 OCR_DONE，error=${json.errorMessage})`);
    if (json.errorMessage) console.log('  ⚠️ errorMessage:', json.errorMessage);

    // 章节结构
    const detail = await api(`/materials/${json.id}`);
    const chapters = detail.json?.chapters || [];
    console.log(`  📚 章节数: ${chapters.length}`);
    for (const ch of chapters) console.log(`    - ${ch.title}`);
    for (const exp of c.expectChapters) {
      const hit = chapters.some(ch => String(ch.title).includes(exp));
      check(hit, `章节含「${exp}」`);
    }
    // 章节内容非空
    const totalLen = chapters.reduce((s, ch) => s + (ch.content || '').length, 0);
    check(totalLen > 20, `章节总内容 ${totalLen} 字符`);
  }

  console.log(`\n══════════════════════`);
  console.log(failures === 0 ? '✅ 全部通过' : `❌ ${failures} 项失败`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(e => { console.error('❌', e.message); process.exitCode = 1; });
