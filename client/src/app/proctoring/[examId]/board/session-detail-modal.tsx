'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

/**
 * 监考大屏 · 考生下钻弹窗
 * 点击宫格卡片打开：会话详情 + 违规时间线 + 监考操作留痕 + 快捷操作（警告/强制交卷/缺考/延时）
 */

const fmtTime = (d: string | Date | null) => d ? new Date(d).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const fmtClock = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

const ACTION_LABELS: Record<string, string> = {
  WARN: '⚠️ 警告', FORCE_SUBMIT: '🔒 强制交卷', MARK_ABSENT: '🚫 标记缺考', REVOKE_ABSENT: '↩️ 撤销缺考',
  EXTEND_TIME: '⏱ 延长时间', AUTO_REMINDER: '⏰ 系统提醒', tab_switch: '🔄 切屏',
};

interface Props {
  examId: number;
  sessionId: number;
  onClose: () => void;
  onChanged: () => void; // 操作成功后刷新大屏
}

export default function SessionDetailModal({ examId, sessionId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const [forceReason, setForceReason] = useState('');
  const [extendMin, setExtendMin] = useState(5);
  const [extendReason, setExtendReason] = useState('');

  const operatorName = (() => {
    if (typeof window === 'undefined') return '管理员';
    try { return JSON.parse(localStorage.getItem('user') || '{}')?.displayName || '管理员'; } catch { return '管理员'; }
  })();

  const load = useCallback(async () => {
    try {
      setDetail(await api.exams.proctoring.sessionDetail(examId, sessionId));
      setError('');
    } catch (e: any) { setError(e.message || '加载失败'); }
  }, [examId, sessionId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try { await fn(); onChanged(); await load(); }
    catch (e: any) { alert(e.message || '操作失败'); }
    finally { setBusy(''); }
  };

  const canWarn = detail && detail.status === 'ACTIVE';
  const canForce = detail && detail.status === 'ACTIVE';
  const canAbsent = detail && !detail.absent && ['ASSIGNED', 'PAUSED'].includes(detail.status);
  const canRevokeAbsent = detail && detail.absent;
  const canExtend = detail && detail.status === 'ACTIVE';

  const btn = (color: string) => ({
    background: `${color}1f`, border: `1px solid ${color}55`, color, borderRadius: 8,
    padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
  } as const);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} data-testid="session-detail-modal"
        style={{ width: 560, maxHeight: '86vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 14, padding: 20, color: '#e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🔍 考生详情 · {detail?.studentName || '加载中…'}</div>
          {detail?.absent && <span style={{ fontSize: 10, color: '#f87171', border: '1px solid #f8717155', borderRadius: 999, padding: '2px 8px' }}>缺考</span>}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {detail && (
          <>
            {/* 基本信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: '状态', value: detail.absent ? '缺考' : detail.status === 'ACTIVE' ? (detail.online ? '作答中·在线' : '作答中·离线') : detail.status === 'SUBMITTED' ? '已交卷' : '未开考', color: detail.absent ? '#f87171' : detail.status === 'ACTIVE' ? '#38bdf8' : detail.status === 'SUBMITTED' ? '#34d399' : '#8b98ab' },
                { label: '剩余时间', value: detail.remainingTime != null ? fmtClock(Math.max(0, detail.remainingTime)) : '—', color: '#fbbf24' },
                { label: '可疑度', value: String(detail.suspicionLevel ?? 0), color: (detail.suspicionLevel ?? 0) >= 3 ? '#f87171' : (detail.suspicionLevel ?? 0) > 0 ? '#fbbf24' : '#34d399' },
                { label: '切屏次数', value: String(detail.tabSwitchCount ?? 0), color: detail.tabSwitchCount > 0 ? '#fbbf24' : '#64748b' },
                { label: '开考时间', value: fmtTime(detail.startedAt), color: '#94a3b8' },
                { label: '交卷时间', value: fmtTime(detail.submittedAt), color: '#94a3b8' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.color, marginTop: 2 }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* 快捷操作 */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#38bdf8' }}>⚡ 快捷操作</div>
              {/* 警告 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={warnMsg} onChange={e => setWarnMsg(e.target.value)} placeholder="警告内容，将实时推送给考生…"
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
                <button disabled={!canWarn || !warnMsg.trim() || busy === 'warn'} data-testid="btn-warn"
                  onClick={() => runAction('warn', () => api.exams.proctoring.warn(examId, sessionId, { message: warnMsg.trim(), operatorName }))}
                  style={{ ...btn('#fbbf24'), opacity: canWarn && warnMsg.trim() ? 1 : 0.45 }}>
                  {busy === 'warn' ? '发送中…' : '⚠️ 警告'}
                </button>
              </div>
              {/* 强制交卷 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={forceReason} onChange={e => setForceReason(e.target.value)} placeholder="强制交卷原因（记入审计）…"
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
                <button disabled={!canForce || !forceReason.trim() || busy === 'force'} data-testid="btn-force-submit"
                  onClick={() => { if (confirm(`确认强制收卷「${detail.studentName}」？此操作不可撤销。`)) runAction('force', () => api.exams.proctoring.forceSubmit(examId, sessionId, { reason: forceReason.trim(), operatorName })); }}
                  style={{ ...btn('#f87171'), opacity: canForce && forceReason.trim() ? 1 : 0.45 }}>
                  {busy === 'force' ? '收卷中…' : '🔒 强制交卷'}
                </button>
              </div>
              {/* 延时 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <input value={extendReason} onChange={e => setExtendReason(e.target.value)} placeholder="延时原因…"
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
                <select value={extendMin} onChange={e => setExtendMin(Number(e.target.value))}
                  style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, color: '#e2e8f0', padding: '6px 8px', fontSize: 12 }}>
                  <option value={1}>+1分钟</option><option value={3}>+3分钟</option><option value={5}>+5分钟</option><option value={10}>+10分钟</option>
                </select>
                <button disabled={!canExtend || !extendReason.trim() || busy === 'extend'} data-testid="btn-extend"
                  onClick={() => runAction('extend', () => api.exams.proctoring.extendTime(examId, sessionId, { extraSeconds: extendMin * 60, reason: extendReason.trim(), operatorName }))}
                  style={{ ...btn('#38bdf8'), opacity: canExtend && extendReason.trim() ? 1 : 0.45 }}>
                  {busy === 'extend' ? '延时中…' : '⏱ 延时'}
                </button>
              </div>
              {/* 缺考 */}
              <div>
                {canAbsent && (
                  <button disabled={busy === 'absent'} data-testid="btn-absent"
                    onClick={() => { if (confirm(`确认将「${detail.studentName}」标记为缺考？`)) runAction('absent', () => api.exams.proctoring.toggleAbsent(examId, sessionId, { absent: true, operatorName })); }}
                    style={btn('#fb923c')}>🚫 标记缺考</button>
                )}
                {canRevokeAbsent && (
                  <button disabled={busy === 'absent'} data-testid="btn-revoke-absent"
                    onClick={() => { if (confirm(`确认撤销「${detail.studentName}」的缺考标记？学员可重新进入考试。`)) runAction('absent', () => api.exams.proctoring.toggleAbsent(examId, sessionId, { absent: false, operatorName })); }}
                    style={btn('#34d399')}>↩️ 撤销缺考</button>
                )}
                {!canAbsent && !canRevokeAbsent && <span style={{ fontSize: 11, color: '#64748b' }}>当前状态不支持缺考操作</span>}
              </div>
            </div>

            {/* 违规时间线 */}
            {detail.tabSwitchTimeline?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24', marginBottom: 6 }}>🔄 切屏记录（{detail.tabSwitchTimeline.length}）</div>
                <div style={{ maxHeight: 90, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...detail.tabSwitchTimeline].reverse().slice(0, 20).map((t: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: '#94a3b8' }}>· {new Date(t.time).toLocaleTimeString('zh-CN')} {t.action === 'tab_switch' ? '切屏' : t.action}</div>
                  ))}
                </div>
              </div>
            )}

            {/* 监考操作留痕 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>📋 监考操作留痕</div>
              {detail.proctorActions?.length > 0 ? (
                <div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[...detail.proctorActions].reverse().map((a: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: '#cbd5e1', background: 'rgba(148,163,184,0.08)', borderRadius: 6, padding: '5px 8px' }}>
                      <span style={{ color: '#38bdf8' }}>{ACTION_LABELS[a.action] || a.action}</span>
                      {a.message && <> · {a.message}</>}
                      <span style={{ color: '#64748b' }}> · {a.operatorName} · {new Date(a.timestamp).toLocaleString('zh-CN')}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 11, color: '#64748b' }}>暂无监考操作</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
