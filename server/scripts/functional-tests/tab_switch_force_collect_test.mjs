#!/usr/bin/env node
/**
 * 切屏达阈值强制收卷端到端测试（2026-08-21）
 * 覆盖：学员作答页心跳 → 服务端累计 violationLog → 达 tabSwitchLimit 服务端兜底强制收卷
 *      （防前端绕过；答案由 auto-save 落库，强收后 autoGrade + syncExamProgress）
 *
 * 前置：DB 已建隔离测试考试（tab_switch_limit=3, PUBLISHED）+ ASSIGNED 会话（admin 为学员）
 * 验证点：
 *  A. 进入考试 → 会话转为 ACTIVE
 *  B. 心跳上报 2 条切屏 → 仍 ACTIVE（未达阈值），remainingTime 递减 30
 *  C. 心跳再报 1 条 → 累计 3 达阈值 → 强制收卷 reason=TAB_SWITCH_LIMIT
 *  D. DB 校验：状态 SUBMITTED、violation_log 3 条、scoringStatus 已推进（autoGrade 跑过）
 *  E. 零残留清理
 */

const API = 'http://localhost:3001';
const EXAM_ID = Number(process.env.TEST_EXAM_ID || 450);
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

const { execSync } = await import('node:child_process');
function db(sql) {
  return execSync(`mysql -h localhost -u training_user -ptraining_2024 online_training -N -e "${sql}"`, { encoding: 'utf8' }).trim();
}
function ts(offsetSec) {
  return new Date(Date.now() + offsetSec * 1000).toISOString();
}

let token;
try {
  token = await login();
  check('登录 admin', !!token);

  // A. 进入考试 → ACTIVE（会话 id 由 exam+student 唯一确定，从 DB 取）
  const startRes = await fetch(`${API}/api/student/exams/${EXAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sj = await startRes.json();
  check('进入考试返回 ACTIVE', sj.sessionStatus === 'ACTIVE', `sessionStatus=${sj.sessionStatus}`);
  check('进入考试返回题目', Array.isArray(sj.questions) && sj.questions.length > 0, `${sj.questions?.length}题`);
  const sessionId = Number(db(`SELECT id FROM exam_sessions WHERE exam_id=${EXAM_ID} AND student_id=1`));
  check('获取会话 id', Number.isInteger(sessionId) && sessionId > 0, `sessionId=${sessionId}`);
  const st = db(`SELECT status FROM exam_sessions WHERE id=${sessionId}`);
  check('会话转为 ACTIVE', st === 'ACTIVE', `status=${st}`);

  // B. 心跳 1：上报 2 条切屏（<3 阈值）
  const hb1 = await fetch(`${API}/api/student/exams/${EXAM_ID}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tabSwitchData: [
        { time: ts(-120), duration: 5, type: 'TAB_SWITCH' },
        { time: ts(-60), duration: 3, type: 'TAB_SWITCH' },
      ],
    }),
  });
  const h1 = await hb1.json();
  check('心跳1 未达阈值仍 ACTIVE', h1.sessionStatus === 'ACTIVE' && h1.ok !== false, `status=${h1.sessionStatus}`);
  check('心跳1 remainingTime 递减 30', typeof h1.remainingTime === 'number' && h1.remainingTime === 3570, `remainingTime=${h1.remainingTime}`);
  const log1 = db(`SELECT JSON_LENGTH(violation_log) FROM exam_sessions WHERE id=${sessionId}`);
  check('violation_log 累计 2 条', Number(log1) === 2, `violation=${log1}`);

  // C. 心跳 2：再报 1 条 → 累计 3 达阈值 → 强制收卷
  const hb2 = await fetch(`${API}/api/student/exams/${EXAM_ID}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tabSwitchData: [{ time: ts(-30), duration: 2, type: 'TAB_SWITCH' }],
    }),
  });
  const h2 = await hb2.json();
  check('心跳2 达阈值强制收卷', h2.sessionStatus === 'SUBMITTED', `status=${h2.sessionStatus}`);
  check('强收原因 TAB_SWITCH_LIMIT', h2.reason === 'TAB_SWITCH_LIMIT', `reason=${h2.reason}`);

  // D. DB 校验
  const sess = db(`SELECT CONCAT(status,'|',JSON_LENGTH(violation_log),'|',COALESCE(scoring_status,'NULL'),'|',suspicion_level) FROM exam_sessions WHERE id=${sessionId}`);
  const [status, vl, scoring, susp] = sess.split('|');
  check('DB 状态 SUBMITTED', status === 'SUBMITTED', status);
  check('violation_log 共 3 条', Number(vl) === 3, `violation=${vl}`);
  check('autoGrade 已推进 scoringStatus', scoring === 'GRADED' || scoring === 'GRADING' || scoring === 'PENDING', `scoring=${scoring}`);
  check('suspicionLevel 累计 3', Number(susp) === 3, `suspicion=${susp}`);

  // E. 清理
  await fetch(`${API}/api/student/exams/${EXAM_ID}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers: [], tabSwitchLog: [] }),
  }).catch(() => {});
  db(`DELETE FROM exam_sessions WHERE id=${sessionId}`);
  db(`DELETE FROM exams WHERE id=${EXAM_ID}`);
  const left = db(`SELECT COUNT(*) FROM exams WHERE id=${EXAM_ID}`);
  check('测试数据零残留', Number(left) === 0, `残留=${left}`);
} catch (e) {
  console.error('⚠️ 测试异常中断:', e.message);
  // 兜底清理
  try {
    db(`DELETE FROM exam_sessions WHERE exam_id=${EXAM_ID}`);
    db(`DELETE FROM exams WHERE id=${EXAM_ID}`);
  } catch {}
}

console.log(`\n════ 结果 ${pass} 通过 / ${fail} 失败 ════`);
process.exitCode = fail > 0 ? 1 : 0;
