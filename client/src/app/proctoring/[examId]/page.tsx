'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { useProctoringBoard } from '@/lib/use-proctoring-ws';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'ONLINE', label: '🟢 在线' },
  { key: 'OFFLINE', label: '🔴 离线' },
  { key: 'ABNORMAL', label: '⚠️ 异常' },
  { key: 'SUBMITTED', label: '✅ 已交卷' },
  { key: 'ABSENT', label: '🚫 缺考' },
];

const fmtWin = (d: string | Date) => new Date(d).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ProctoringDetail() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.examId as string);
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [clock, setClock] = useState(new Date());
  const [filter, setFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Modal states
  const [warnModal, setWarnModal] = useState<any>(null);
  const [warnMessage, setWarnMessage] = useState('');
  const [forceSubmitModal, setForceSubmitModal] = useState<any>(null);
  const [forceSubmitReason, setForceSubmitReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [extendTarget, setExtendTarget] = useState<number | null>(null);

  // ★ 数据通道（2026-08-12 升级）：WS 实时推送（与大屏共用 hook），失败自动降级 15s 轮询
  const { board, lastRefresh, wsMode, refresh } = useProctoringBoard(examId, { pollMs: 15000 });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const examInfo = board?.exam;
  const overview = board?.stats;

  // 客户端筛选（board 一次返回全员）
  const sessions = useMemo(() => {
    let items: any[] = board?.sessions || [];
    if (filter === 'ONLINE') items = items.filter(s => s.online && !s.absent && s.status !== 'SUBMITTED');
    else if (filter === 'OFFLINE') items = items.filter(s => !s.online && !s.absent && s.status !== 'SUBMITTED');
    else if (filter === 'ABNORMAL') items = items.filter(s => s.suspicionLevel > 0);
    else if (filter === 'SUBMITTED') items = items.filter(s => s.status === 'SUBMITTED');
    else if (filter === 'ABSENT') items = items.filter(s => s.absent);
    if (keyword) items = items.filter(s => (s.studentName || '').includes(keyword) || (s.organization || '').includes(keyword));
    return items;
  }, [board, filter, keyword]);

  // 考试窗口倒计时（与考生个人答题倒计时是两个概念）
  const windowLine = (() => {
    if (!examInfo) return '';
    const nowMs = clock.getTime();
    const startMs = new Date(examInfo.startTime).getTime();
    const endMs = new Date(examInfo.endTime).getTime();
    if (nowMs < startMs) {
      const mins = Math.ceil((startMs - nowMs) / 60000);
      return `⏳ 距开考 ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} 分钟`}`;
    }
    if (nowMs <= endMs) {
      const left = endMs - nowMs;
      const endClock = new Date(endMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      return `🟢 进行中 · 窗口剩余 ${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m · ${endClock} 强制收卷`;
    }
    return '⏹ 考试窗口已结束';
  })();

  // ★ 违规记录导出（2026-08-12）：window.open 无法带 header，走 query token（JWT 策略已支持多提取器）
  const exportViolations = () => {
    const token = localStorage.getItem('token') || '';
    window.open(`/api/exams/${examId}/proctoring/violations/export?token=${encodeURIComponent(token)}`, '_blank');
  };

  const openDetail = async (sessionId: number) => {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const [data, msgs] = await Promise.all([
        api.exams.proctoring.sessionDetail(examId, sessionId),
        api.exams.proctoring.messages(examId, sessionId).catch(() => []),
      ]);
      setSelectedSession(data);
      setSessionMessages(Array.isArray(msgs) ? msgs : []);
    } catch {}
    setDetailLoading(false);
  };

  const handleWarn = async () => {
    if (!warnMessage) return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.warn(examId, warnModal.sessionId, {
        message: warnMessage,
        operatorName: user?.displayName || '管理员',
      });
      setWarnModal(null); setWarnMessage('');
      openDetail(warnModal.sessionId);
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const handleForceSubmit = async () => {
    if (confirmText !== '确认交卷') return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.forceSubmit(examId, forceSubmitModal.sessionId, {
        reason: forceSubmitReason || '监考员强制交卷',
        operatorName: user?.displayName || '管理员',
      });
      setForceSubmitModal(null); setForceSubmitReason(''); setConfirmText('');
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const handleExtendTime = async (reason: string) => {
    if (!extendTarget) return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.extendTime(examId, extendTarget, {
        extraSeconds: 600,
        reason: reason || '监考员手动延长',
        operatorName: user?.displayName || '管理员',
      });
      setExtendTarget(null);
      openDetail(extendTarget);
    } catch (e: any) { toast.error(e.message); setExtendTarget(null); }
    setActionLoading(false);
  };

  const handleMarkAbsent = async () => {
    if (!selectedSession) return;
    if (!window.confirm(`确认将 ${selectedSession.studentName} 标记为缺考？将记 0 分。`)) return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.toggleAbsent(examId, selectedSession.sessionId, {
        absent: true,
        operatorName: user?.displayName || '管理员',
      });
      toast.success('已标记缺考');
      openDetail(selectedSession.sessionId);
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const handleRevokeAbsent = async () => {
    if (!selectedSession) return;
    if (!window.confirm(`确认撤销 ${selectedSession.studentName} 的缺考标记？撤销后该学员可重新进入考试。`)) return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.toggleAbsent(examId, selectedSession.sessionId, {
        absent: false,
        operatorName: user?.displayName || '管理员',
      });
      toast.success('已撤销缺考标记');
      openDetail(selectedSession.sessionId);
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const getBgColor = (s: any) => {
    if (s.status === 'SUBMITTED') return 'white';
    if (s.suspicionLevel >= 3) return 'var(--error-pale)';
    if (s.suspicionLevel >= 1) return 'var(--warning-pale)';
    return 'white';
  };

  if (loading) return <AppLayout><div className="text-[var(--ink-300)] text-center py-16">加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push('/proctoring')} className="text-xs bg-transparent border-none cursor-pointer mb-4 text-[var(--fox)]" >← 返回监考列表</button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">📋 {examInfo?.title || '监考面板'}</h1>
        <div className="flex items-center gap-3">
          <button onClick={exportViolations} data-testid="btn-export-violations"
            className="btn btn-outline btn-sm" title="导出本场考试违规与监考操作记录（CSV）">
            📥 导出违规记录
          </button>
          <button onClick={() => router.push(`/proctoring/${examId}/board`)}
            className="btn btn-fox btn-sm" title="座舱模式：全屏大屏监考">
            🖥 大屏监考
          </button>
          <div className="text-[var(--ink-300)] text-[10px]">
            <span style={{ color: wsMode === 'live' ? 'var(--sage)' : wsMode === 'polling' ? 'var(--fox)' : 'var(--ink-300)' }}>
              {wsMode === 'live' ? '● 实时推送' : wsMode === 'polling' ? '◌ 轮询模式' : '◌ 连接中…'}
            </span>
            {' '}· 刷新于 {lastRefresh}
          </div>
        </div>
      </div>

      {/* ★ 考试信息条（2026-08-12）：试卷/时长/窗口/时间模式一目了然 */}
      {examInfo && (
        <div className="card px-4 py-3 mb-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-[var(--ink-400)]">
          <span>📄 {examInfo.paperName} · {examInfo.questionCount} 题 / {examInfo.paperTotalScore} 分</span>
          <span data-testid="panel-duration">⏱ 答题时长 {examInfo.durationMinutes} 分钟</span>
          <span data-testid="panel-window">📅 {fmtWin(examInfo.startTime)} ~ {fmtWin(examInfo.endTime)}（结束时间为硬截止）</span>
          <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
            {examInfo.timeMode === 'FIXED' ? '🔒 统一开考' : '🚪 随到随考'}
          </span>
          <span>🔄 切屏上限 {examInfo.tabSwitchLimit > 0 ? `${examInfo.tabSwitchLimit} 次` : '未限制'}</span>
          <span className="ml-auto font-medium text-[var(--ink-600)]" data-testid="panel-window-line">{windowLine}</span>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        {[
          { label: '总考生', value: overview?.totalStudents || 0, color: 'var(--ink-600)' },
          { label: '🟢 在线', value: overview?.onlineCount || 0, color: 'var(--sage)' },
          { label: '🔴 离线', value: overview?.offlineCount || 0, color: overview?.offlineCount > 0 ? 'var(--error)' : 'var(--neutral-400)' },
          { label: '⚠️ 异常', value: overview?.abnormalCount || 0, color: (overview?.abnormalCount || 0) > 0 ? 'var(--fox)' : 'var(--neutral-400)' },
          { label: '✅ 已交卷', value: overview?.submittedCount || 0, color: 'var(--neutral-400)' },
          { label: '🚫 缺考', value: overview?.absentCount || 0, color: (overview?.absentCount || 0) > 0 ? 'var(--verm)' : 'var(--neutral-400)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[var(--ink-400)] text-[10px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: filter === f.key ? 'var(--fox)' : 'transparent', color: filter === f.key ? 'white' : 'var(--ink-400)', border: filter === f.key ? 'none' : '1px solid var(--ink-200)' }}>
            {f.label}
          </button>
        ))}
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="🔍 搜索学员姓名…" className="input text-xs ml-auto" style={{ maxWidth: 200, height: 32 }} />
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="card p-12 text-center"><p className="text-[var(--ink-300)]">暂无数据</p></div>
        ) : sessions.map(s => (
          <div key={s.sessionId} onClick={() => openDetail(s.sessionId)}
            className="rounded-xl p-4 transition-all cursor-pointer flex items-center gap-4"
            style={{ background: getBgColor(s), border: `1px solid ${s.suspicionLevel >= 3 ? 'var(--error-light)' : 'var(--ink-100)'}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 bg-[rgba(232,122,48,0.1)] text-[var(--fox)]"
              >
              {s.studentName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[var(--ink-700)] font-medium text-sm">{s.studentName}</span>
                {s.online && <span className="bg-[var(--sage)] w-2 h-2 rounded-full" title="在线" />}
                {!s.online && s.status !== 'SUBMITTED' && <span className="bg-[var(--error)] w-2 h-2 rounded-full" title="离线" />}
                {s.absent
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--warning-pale)', color: 'var(--verm)' }}>🚫 缺考</span>
                  : s.status === 'SUBMITTED' && <span className="text-[var(--ink-300)] text-[10px]">✅ 已交卷</span>}
              </div>
              <div className="text-[var(--ink-300)] text-[10px] mt-0.5">
                {s.organization || '—'} · {s.remainingTime != null ? `⏱ ${Math.floor(s.remainingTime / 60)}:${String(s.remainingTime % 60).padStart(2, '0')}` : '—'}
              </div>
            </div>
            <div className="text-[var(--ink-400)] flex items-center gap-3 text-xs">
              {s.tabSwitchCount > 0 && <span style={{ color: s.tabSwitchCount > 3 ? 'var(--error)' : 'var(--fox)' }}>🔄 {s.tabSwitchCount}次</span>}
              {s.suspicionLevel > 0 && <span className="font-medium" style={{ color: s.suspicionLevel >= 3 ? 'var(--error)' : 'var(--fox)' }}>⚠️ {s.suspicionLevel}</span>}
            </div>
            <span className="text-[var(--fox)] text-xs">查看 →</span>
          </div>
        ))}
      </div>

      {/* Session Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={() => setShowDetail(false)}>
          <div className="bg-[var(--paper-bright)] w-[500px] h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[var(--ink-700)] font-semibold text-base">考生详情</h2>
              <button onClick={() => setShowDetail(false)} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
            </div>

            {detailLoading ? (
              <div className="text-[var(--ink-300)] text-center py-16">加载中…</div>
            ) : selectedSession ? (
              <div className="space-y-5">
                {/* Info card */}
                <div className="bg-[var(--paper-dark)] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold bg-[rgba(232,122,48,0.1)] text-[var(--fox)]" >
                      {selectedSession.studentName?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{selectedSession.studentName}</div>
                      <div className="text-[var(--ink-300)] text-xs">{selectedSession.organization || '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[var(--ink-400)]">状态：</span>{selectedSession.absent ? '🚫 缺考' : selectedSession.status}</div>
                    <div><span className="text-[var(--ink-400)]">在线：</span>{selectedSession.online ? '🟢 在线' : '🔴 离线'}</div>
                    <div><span className="text-[var(--ink-400)]">切屏：</span>{selectedSession.tabSwitchCount} 次</div>
                    <div><span className="text-[var(--ink-400)]">可疑度：</span>{selectedSession.suspicionLevel}</div>
                    {selectedSession.remainingTime != null && (
                      <div><span className="text-[var(--ink-400)]">剩余时间：</span>{Math.floor(selectedSession.remainingTime / 60)}:{(selectedSession.remainingTime % 60).toString().padStart(2, '0')}</div>
                    )}
                  </div>
                </div>

                {/* Tab switch timeline */}
                <div>
                  <h3 className="text-[var(--ink-600)] text-xs font-semibold mb-2">切屏时间线</h3>
                  {selectedSession.tabSwitchTimeline?.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedSession.tabSwitchTimeline.map((t: any, i: number) => (
                        <div key={i} className="text-xs px-3 py-1.5 rounded bg-[var(--error-pale)] text-[var(--error)]" >
                          {new Date(t.time).toLocaleString('zh-CN')} — {t.action}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[var(--ink-300)] text-xs">无切屏记录</p>
                  )}
                </div>

                {/* Proctor actions */}
                <div>
                  <h3 className="text-[var(--ink-600)] text-xs font-semibold mb-2">监考员操作记录</h3>
                  {selectedSession.proctorActions?.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedSession.proctorActions.map((a: any, i: number) => (
                        <div key={i} className="bg-[var(--neutral-100)] text-xs px-3 py-1.5 rounded">
                          <span className="font-medium">{a.action}</span> — {a.message}
                          <div className="text-[var(--ink-300)] text-[10px]">{new Date(a.timestamp).toLocaleString('zh-CN')} · {a.operatorName}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[var(--ink-300)] text-xs">无操作记录</p>
                  )}
                </div>

                {/* 消息记录 */}
                <div>
                  <h3 className="text-[var(--ink-600)] text-xs font-semibold mb-2">消息记录</h3>
                  {sessionMessages.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {sessionMessages.map((m: any) => (
                        <div key={m.id} className="text-xs px-3 py-1.5 rounded" style={{
                          background: m.messageType === 'WARN' ? 'var(--error-pale)' : 'var(--info-pale)',
                        }}>
                          <span className="font-medium">{m.messageType === 'WARN' ? '⚠️ 警告' : 'ℹ️ 消息'}</span> — {m.content}
                          <div className="text-[var(--ink-300)] flex items-center gap-2 text-[10px]">
                            <span>{m.senderName} · {new Date(m.sentAt).toLocaleString('zh-CN')}</span>
                            <span style={{ color: m.readAt ? 'var(--cyan)' : 'var(--fox)', fontWeight: m.readAt ? 400 : 600 }}>
                              {m.readAt ? '🟢 已读' : '🔴 未读'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[var(--ink-300)] text-xs">暂无消息</p>
                  )}
                </div>

                {/* Action buttons */}
                {selectedSession.absent && (
                  <div className="space-y-2 pt-2">
                    <button onClick={handleRevokeAbsent}
                      className="btn w-full text-sm py-2 text-[var(--sage)]" style={{ border: '1px solid var(--sage)' }}>
                      ↩️ 撤销缺考标记
                    </button>
                  </div>
                )}
                {!selectedSession.absent && (selectedSession.status === 'ASSIGNED' || selectedSession.status === 'PAUSED') && (
                  <div className="space-y-2 pt-2">
                    <button onClick={handleMarkAbsent}
                      className="btn w-full text-sm py-2 text-[var(--verm)]" style={{ border: '1px solid var(--verm)' }}>
                      🚫 标记缺考
                    </button>
                  </div>
                )}
                {selectedSession.status !== 'SUBMITTED' && (
                  <div className="space-y-2 pt-2">
                    <button onClick={() => setWarnModal({ sessionId: selectedSession.sessionId })}
                      className="btn w-full text-sm py-2 text-[var(--fox)]" style={{ border: '1px solid var(--fox)',  }}>
                      ⚠️ 发送警告
                    </button>
                    <button onClick={() => setExtendTarget(selectedSession.sessionId)}
                      className="btn w-full text-sm py-2 text-[var(--cyan)]" style={{ border: '1px solid var(--cyan)',  }}>
                      ⏱ 延长10分钟
                    </button>
                    <button onClick={() => setForceSubmitModal({ sessionId: selectedSession.sessionId })}
                      className="btn w-full text-sm py-2 text-[var(--error)]" style={{ border: '1px solid #e53935',  }}>
                      🛑 强制交卷
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[var(--ink-300)]">加载失败</p>
            )}
          </div>
        </div>
      )}

      {/* Warn Modal */}
      {warnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWarnModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-4">⚠️ 发送警告</h3>
            <textarea value={warnMessage} onChange={e => setWarnMessage(e.target.value)}
              className="input w-full mb-4" rows={3} placeholder="警告内容，如：请注意，系统检测到切屏行为" />
            <div className="flex gap-2">
              <button onClick={handleWarn} disabled={actionLoading || !warnMessage} className="btn btn-fox btn-sm flex-1">
                {actionLoading ? '发送中…' : '发送'}
              </button>
              <button onClick={() => setWarnModal(null)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Force Submit Modal */}
      {/* 延长考试时间 Modal */}
      <ReasonConfirmModal
        open={extendTarget !== null}
        title="⏱ 延长考试时间"
        message="确认为该考生延长 10 分钟考试时间？"
        required
        presetReasons={['考生网络异常', '考生设备故障', '监考员判断需要延长']}
        confirmText="确认延长"
        onConfirm={handleExtendTime}
        onCancel={() => setExtendTarget(null)}
      />

      {forceSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setForceSubmitModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-[var(--error)] font-semibold text-sm mb-2">🛑 强制交卷</h3>
            <p className="text-[var(--ink-400)] text-xs mb-4">此操作将强制提交该考生的试卷，不可撤销。</p>
            <input value={forceSubmitReason} onChange={e => setForceSubmitReason(e.target.value)}
              className="input w-full mb-3" placeholder="强制交卷原因" />
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="input w-full mb-4" placeholder='输入"确认交卷"以确认' />
            <div className="flex gap-2">
              <button onClick={handleForceSubmit} disabled={actionLoading || confirmText !== '确认交卷'} className="btn btn-sm flex-1 text-white" style={{ background: confirmText === '确认交卷' ? 'var(--error)' : 'var(--neutral-200)' }}>
                {actionLoading ? '处理中…' : '确认强制交卷'}
              </button>
              <button onClick={() => setForceSubmitModal(null)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
