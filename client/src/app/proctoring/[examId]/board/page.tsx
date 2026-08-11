'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import SessionDetailModal from './session-detail-modal';
import { useProctoringBoard } from '@/lib/use-proctoring-ws';

/**
 * 监考大屏 · 座舱模式
 * 深色全屏驾驶舱：考试概况 + 实时统计 + 全员宫格 + 违规动态流
 * 数据通道：WebSocket 实时推送（/ws/proctoring），连接失败自动降级 10s 轮询
 * 点击考生卡片可下钻查看详情并执行快捷监考操作
 */

const EXAM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#8b98ab' },
  PUBLISHED: { label: '已发布', color: '#38bdf8' },
  IN_PROGRESS: { label: '进行中', color: '#34d399' },
  AWAITING_GRADING: { label: '待阅卷', color: '#fbbf24' },
  GRADING_IN_PROGRESS: { label: '阅卷中', color: '#fbbf24' },
  FINISHED: { label: '已结束', color: '#8b98ab' },
};

const fmt = (d: string | Date) => new Date(d).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtClock = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

function sessionVisual(s: any) {
  if (s.absent) return { badge: '缺考', color: '#f87171', bg: 'rgba(248,113,113,0.10)', dot: '#f87171' };
  if (s.status === 'SUBMITTED') return { badge: '已交卷', color: '#34d399', bg: 'rgba(52,211,153,0.08)', dot: '#34d399' };
  if (s.status === 'ACTIVE' && s.online) {
    const warn = s.suspicionLevel >= 3;
    return warn
      ? { badge: '高危作答', color: '#f87171', bg: 'rgba(248,113,113,0.14)', dot: '#f87171' }
      : s.suspicionLevel > 0
        ? { badge: '作答中·异常', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', dot: '#fbbf24' }
        : { badge: '作答中', color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', dot: '#38bdf8' };
  }
  if (s.status === 'ACTIVE') return { badge: '离线作答', color: '#fb923c', bg: 'rgba(251,146,60,0.10)', dot: '#fb923c' };
  return { badge: '未开考', color: '#8b98ab', bg: 'rgba(139,152,171,0.08)', dot: '#8b98ab' };
}

export default function ProctoringBoard() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.examId as string);
  const [clock, setClock] = useState(new Date());
  const [drillSessionId, setDrillSessionId] = useState<number | null>(null);
  const [quickWarn, setQuickWarn] = useState<{ sessionId: number; studentName: string; message: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ── toast 基建 + 新违规提醒（sessionId+time 比对；首帧只建基线不弹，避免初始刷屏）──
  const seenViolations = useRef<Set<string>>(new Set());
  const toastSeq = useRef(0);
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: 'warn' | 'ok' }[]>([]);
  const pushToast = useCallback((text: string, kind: 'warn' | 'ok' = 'ok') => {
    const id = ++toastSeq.current;
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  // ★ 数据通道（2026-08-12 hook 化）：WS 实时（/ws/proctoring），与监考面板页共用，失败自动降级 10s 轮询
  const { board, error, lastRefresh, wsMode, refresh } = useProctoringBoard(examId, {
    onFrame: (data: any) => {
      const list: any[] = data?.recentViolations || [];
      if (seenViolations.current.size > 0) {
        for (const v of list) {
          const key = `${v.sessionId}|${v.time}`;
          if (!seenViolations.current.has(key)) pushToast(`⚠️ ${v.studentName} ${v.action === 'tab_switch' ? '切屏' : v.action} +1`, 'warn');
        }
      }
      seenViolations.current = new Set(list.map((v: any) => `${v.sessionId}|${v.time}`));
    },
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  };

  const exam = board?.exam;
  const stats = board?.stats;
  const statusInfo = exam ? (EXAM_STATUS_LABELS[exam.status] || { label: exam.status, color: '#8b98ab' }) : null;
  // ★ 切屏违规人数（tabSwitchCount>0，与"异常/可疑度"统计区分）
  const tabViolators = board?.sessions?.filter((s: any) => s.tabSwitchCount > 0).length || 0;
  // ★ 宫格排序（2026-08-12）：可疑度降序 → 未交卷 → 已交卷，高危置顶
  const sortedSessions = useMemo(() => {
    const done = (s: any) => (s.status === 'SUBMITTED' || s.absent ? 1 : 0);
    return [...(board?.sessions || [])].sort((a: any, b: any) =>
      (b.suspicionLevel - a.suspicionLevel) || (done(a) - done(b)) || (a.sessionId - b.sessionId));
  }, [board]);
  const operatorName = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}')?.displayName || '管理员'; } catch { return '管理员'; }
  })();

  // 考试剩余/进行时长
  let timeLine = '';
  if (exam) {
    const nowMs = clock.getTime();
    const startMs = new Date(exam.startTime).getTime();
    const endMs = new Date(exam.endTime).getTime();
    if (nowMs < startMs) timeLine = `距开考 ${Math.ceil((startMs - nowMs) / 3600000)} 小时`;
    else if (nowMs <= endMs) timeLine = `窗口剩余 ${Math.floor((endMs - nowMs) / 3600000)}h ${Math.floor(((endMs - nowMs) % 3600000) / 60000)}m · ${new Date(endMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 强制收卷`;
    else timeLine = '考试窗口已截止';
  }

  const wsBadge = wsMode === 'live'
    ? { text: '● 实时推送', color: '#34d399' }
    : wsMode === 'polling'
      ? { text: '◌ 轮询模式', color: '#fbbf24' }
      : { text: '◌ 连接中…', color: '#64748b' };

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1120 0%, #101a30 60%, #0b1120 100%)', color: '#e2e8f0', fontFamily: 'inherit' }}>
      <style>{`@keyframes fox-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.45); } 50% { box-shadow: 0 0 0 7px rgba(248,113,113,0.03); } }`}</style>
      {/* ══ 顶栏 ══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
        <button onClick={() => router.push(`/proctoring/${examId}`)}
          style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
          ← 退出大屏
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🖥 {exam?.title || '监考大屏'}
            </h1>
            {statusInfo && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: `${statusInfo.color}22`, color: statusInfo.color, border: `1px solid ${statusInfo.color}55`, whiteSpace: 'nowrap' }}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {exam && <>📄 {exam.paperName} · {exam.questionCount} 题 / {exam.paperTotalScore} 分 · ⏱ 答题时长 {exam.durationMinutes} 分钟 · ⏰ 窗口 {fmt(exam.startTime)} ~ {fmt(exam.endTime)} · <span data-testid="board-timeline">{timeLine}</span></>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#f1f5f9' }}>{clock.toLocaleTimeString('zh-CN')}</div>
          <div style={{ fontSize: 10, color: '#64748b' }} data-testid="board-refresh-hint">
            <span style={{ color: wsBadge.color }}>{wsBadge.text}</span> · 更新于 {lastRefresh}
          </div>
        </div>
        <button onClick={toggleFullscreen}
          style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
          ⛶ 全屏
        </button>
      </div>

      {error && <div style={{ padding: '10px 24px', color: '#f87171', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, padding: '16px 24px', alignItems: 'stretch' }}>
        {/* ══ 主区 ══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 统计条 */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: '总考生', value: stats.totalStudents, color: '#f1f5f9' },
                { label: '🟢 在线作答', value: stats.onlineCount, color: '#38bdf8' },
                { label: '🔴 离线', value: stats.offlineCount, color: stats.offlineCount > 0 ? '#fb923c' : '#64748b' },
                { label: '⏳ 未开考', value: stats.notStartedCount, color: stats.notStartedCount > 0 ? '#fbbf24' : '#64748b' },
                { label: '✅ 已交卷', value: stats.submittedCount, color: '#34d399' },
                { label: '🚫 缺考', value: stats.absentCount, color: stats.absentCount > 0 ? '#f87171' : '#64748b' },
                { label: '⚠️ 异常', value: stats.abnormalCount, color: stats.abnormalCount > 0 ? '#fbbf24' : '#64748b' },
                { label: '🔄 切屏违规', value: tabViolators, color: tabViolators > 0 ? '#fb923c' : '#64748b' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 交卷进度条 */}
          {stats && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                <span>交卷进度</span>
                <span>{stats.submissionRate}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stats.submissionRate}%`, background: 'linear-gradient(90deg, #34d399, #38bdf8)', borderRadius: 999, transition: 'width 0.6s' }} />
              </div>
            </div>
          )}

          {/* 考生宫格（点击下钻） */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {sortedSessions.map((s: any) => {
              const v = sessionVisual(s);
              return (
                <div key={s.sessionId} onClick={() => setDrillSessionId(s.sessionId)} data-testid="session-card"
                  title="点击查看详情与监考操作"
                  style={{ background: v.bg, border: `1px solid ${v.color}${s.suspicionLevel >= 3 && s.status === 'ACTIVE' ? 'aa' : '44'}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s', animation: s.suspicionLevel >= 3 && s.status === 'ACTIVE' ? 'fox-pulse 1.6s ease-in-out infinite' : undefined }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${v.color}88`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = `${v.color}44`; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: v.dot, flexShrink: 0, boxShadow: s.status === 'ACTIVE' && s.online ? `0 0 6px ${v.dot}` : 'none' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studentName}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: v.color, background: `${v.color}1a`, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', border: `1px solid ${v.color}33` }}>{v.badge}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 5, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.organization || '—'}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {s.status === 'ACTIVE' && s.remainingTime != null && `⏱ ${fmtClock(s.remainingTime)}`}
                      {s.status === 'SUBMITTED' && !s.absent && s.totalScore != null && `💯 ${s.totalScore}`}
                    </span>
                  </div>
                  {(s.tabSwitchCount > 0 || s.suspicionLevel > 0) && (
                    <div style={{ fontSize: 10, marginTop: 4, display: 'flex', gap: 8, color: s.suspicionLevel >= 3 ? '#f87171' : '#fbbf24' }}>
                      {s.tabSwitchCount > 0 && <span data-testid="tab-switch-count">🔄 切屏 {s.tabSwitchCount}{exam?.tabSwitchLimit > 0 ? `/${exam.tabSwitchLimit}` : ''}</span>}
                      {s.suspicionLevel > 0 && <span>⚠️ 可疑度 {s.suspicionLevel}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {board && board.sessions?.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: 40 }}>暂无考生</div>
            )}
          </div>
        </div>

        {/* ══ 右侧：违规动态 ══ */}
        <div style={{ width: 260, flexShrink: 0, background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 10 }}>⚠️ 违规动态</div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {board?.recentViolations?.length > 0 ? board.recentViolations.map((v: any, i: number) => (
              <div key={i} onClick={() => setDrillSessionId(v.sessionId)} data-testid="violation-item" title="点击下钻该考生"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.studentName}</div>
                  <button data-testid="violation-warn-btn" title="一键警告该考生"
                    onClick={e => { e.stopPropagation(); setQuickWarn({ sessionId: v.sessionId, studentName: v.studentName, message: '系统检测到切屏行为，请遵守考试纪律，勿再切屏。' }); }}
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', borderRadius: 6, fontSize: 10, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ⚠️ 警告
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {v.action === 'tab_switch' ? '切屏' : v.action} · {v.time ? new Date(v.time).toLocaleTimeString('zh-CN') : '—'}
                </div>
              </div>
            )) : (
              <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>暂无违规记录 ✅</div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 新违规/操作反馈 toast ══ */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} data-testid="board-toast" style={{
            background: t.kind === 'warn' ? 'rgba(127,29,29,0.95)' : 'rgba(6,78,59,0.95)',
            border: `1px solid ${t.kind === 'warn' ? '#f87171' : '#34d399'}`, color: '#f1f5f9',
            borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* ══ 违规动态快捷警告弹窗（一句话输入，默认切屏提醒话术）══ */}
      {quickWarn && (
        <div onClick={() => setQuickWarn(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} data-testid="quick-warn-modal"
            style={{ width: 420, background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 10 }}>⚠️ 警告考生 · {quickWarn.studentName}</div>
            <textarea value={quickWarn.message} data-testid="quick-warn-input"
              onChange={e => setQuickWarn({ ...quickWarn, message: e.target.value })} rows={3}
              style={{ width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button data-testid="quick-warn-send" disabled={!quickWarn.message.trim()}
                onClick={async () => {
                  try {
                    await api.exams.proctoring.warn(examId, quickWarn.sessionId, { message: quickWarn.message.trim(), operatorName });
                    pushToast(`⚠️ 已向 ${quickWarn.studentName} 发送警告`);
                    setQuickWarn(null);
                    refresh();
                  } catch (e: any) { pushToast(`发送失败：${e.message || '未知错误'}`, 'warn'); }
                }}
                style={{ flex: 1, background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.5)', color: '#fbbf24', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                发送警告
              </button>
              <button onClick={() => setQuickWarn(null)}
                style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 考生下钻弹窗 ══ */}
      {drillSessionId != null && (
        <SessionDetailModal examId={examId} sessionId={drillSessionId}
          onClose={() => setDrillSessionId(null)}
          onChanged={refresh}
          onToast={pushToast} />
      )}
    </div>
  );
}
