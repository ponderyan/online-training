'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'ONLINE', label: '🟢 在线' },
  { key: 'OFFLINE', label: '🔴 离线' },
  { key: 'ABNORMAL', label: '⚠️ 异常' },
  { key: 'SUBMITTED', label: '✅ 已交卷' },
];

export default function ProctoringDetail() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.examId as string);
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Modal states
  const [warnModal, setWarnModal] = useState<any>(null);
  const [warnMessage, setWarnMessage] = useState('');
  const [forceSubmitModal, setForceSubmitModal] = useState<any>(null);
  const [forceSubmitReason, setForceSubmitReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadOverview = useCallback(async () => {
    try { setOverview(await api.exams.proctoring.overview(examId)); } catch {}
  }, [examId]);

  const loadSessions = useCallback(async () => {
    try {
      const params: Record<string, string> = { pageSize: '200' };
      if (filter) params.status = filter;
      const data = await api.exams.proctoring.sessions(examId, params);
      const filtered = keyword
        ? data.items.filter(s => s.studentName.includes(keyword) || s.organization.includes(keyword))
        : data.items;
      setSessions(filtered);
      setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    } catch {}
  }, [examId, filter, keyword]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    loadOverview();
    loadSessions();
    setLoading(false);
    intervalRef.current = setInterval(() => {
      loadOverview();
      loadSessions();
    }, 15000);
    return () => clearInterval(intervalRef.current);
  }, [loadOverview, loadSessions]);

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
      loadSessions(); loadOverview();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const handleExtendTime = async (sessionId: number) => {
    if (!confirm('确认为该考生延长 10 分钟？')) return;
    setActionLoading(true);
    try {
      await api.exams.proctoring.extendTime(examId, sessionId, {
        extraSeconds: 600,
        reason: '监考员手动延长',
        operatorName: user?.displayName || '管理员',
      });
      openDetail(sessionId);
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const getBgColor = (s: any) => {
    if (s.status === 'SUBMITTED') return 'white';
    if (s.suspicionLevel >= 3) return '#fff0ee';
    if (s.suspicionLevel >= 1) return '#fffde7';
    return 'white';
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push('/proctoring')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回监考列表</button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">🎥 监考面板</h1>
        <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>刷新于 {lastRefresh} · 自动每15秒更新</div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: '总考生', value: overview?.totalStudents || 0, color: 'var(--ink-600)' },
          { label: '🟢 在线', value: overview?.onlineCount || 0, color: '#2e7d32' },
          { label: '🔴 离线', value: overview?.offlineCount || 0, color: overview?.offlineCount > 0 ? '#e53935' : '#888' },
          { label: '⚠️ 异常', value: overview?.abnormalCount || 0, color: (overview?.abnormalCount || 0) > 0 ? '#e87a30' : '#888' },
          { label: '✅ 已交卷', value: overview?.submittedCount || 0, color: '#888' },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
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
          <div className="card p-12 text-center"><p style={{ color: 'var(--ink-300)' }}>暂无数据</p></div>
        ) : sessions.map(s => (
          <div key={s.sessionId} onClick={() => openDetail(s.sessionId)}
            className="rounded-xl p-4 transition-all cursor-pointer flex items-center gap-4"
            style={{ background: getBgColor(s), border: `1px solid ${s.suspicionLevel >= 3 ? '#ef9a9a' : 'var(--ink-100)'}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'rgba(232,122,48,0.1)', color: 'var(--fox)' }}>
              {s.studentName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm" style={{ color: 'var(--ink-700)' }}>{s.studentName}</span>
                {s.online && <span className="w-2 h-2 rounded-full" style={{ background: '#2e7d32' }} title="在线" />}
                {!s.online && s.status !== 'SUBMITTED' && <span className="w-2 h-2 rounded-full" style={{ background: '#e53935' }} title="离线" />}
                {s.status === 'SUBMITTED' && <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>✅ 已交卷</span>}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>
                {s.organization || '—'} · {s.remainingTime != null ? `⏱ ${Math.floor(s.remainingTime / 60)}:${String(s.remainingTime % 60).padStart(2, '0')}` : '—'}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ink-400)' }}>
              {s.tabSwitchCount > 0 && <span style={{ color: s.tabSwitchCount > 3 ? '#e53935' : 'var(--fox)' }}>🔄 {s.tabSwitchCount}次</span>}
              {s.suspicionLevel > 0 && <span className="font-medium" style={{ color: s.suspicionLevel >= 3 ? '#e53935' : 'var(--fox)' }}>⚠️ {s.suspicionLevel}</span>}
            </div>
            <span className="text-xs" style={{ color: 'var(--fox)' }}>查看 →</span>
          </div>
        ))}
      </div>

      {/* Session Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={() => setShowDetail(false)}>
          <div className="w-[500px] h-full overflow-y-auto p-6" style={{ background: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-base" style={{ color: 'var(--ink-700)' }}>考生详情</h2>
              <button onClick={() => setShowDetail(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>

            {detailLoading ? (
              <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div>
            ) : selectedSession ? (
              <div className="space-y-5">
                {/* Info card */}
                <div className="rounded-xl p-4" style={{ background: 'var(--paper-dark)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ background: 'rgba(232,122,48,0.1)', color: 'var(--fox)' }}>
                      {selectedSession.studentName?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{selectedSession.studentName}</div>
                      <div className="text-xs" style={{ color: 'var(--ink-300)' }}>{selectedSession.organization || '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span style={{ color: 'var(--ink-400)' }}>状态：</span>{selectedSession.status}</div>
                    <div><span style={{ color: 'var(--ink-400)' }}>在线：</span>{selectedSession.online ? '🟢 在线' : '🔴 离线'}</div>
                    <div><span style={{ color: 'var(--ink-400)' }}>切屏：</span>{selectedSession.tabSwitchCount} 次</div>
                    <div><span style={{ color: 'var(--ink-400)' }}>可疑度：</span>{selectedSession.suspicionLevel}</div>
                    {selectedSession.remainingTime != null && (
                      <div><span style={{ color: 'var(--ink-400)' }}>剩余时间：</span>{Math.floor(selectedSession.remainingTime / 60)}:{(selectedSession.remainingTime % 60).toString().padStart(2, '0')}</div>
                    )}
                  </div>
                </div>

                {/* Tab switch timeline */}
                <div>
                  <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-600)' }}>切屏时间线</h3>
                  {selectedSession.tabSwitchTimeline?.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedSession.tabSwitchTimeline.map((t: any, i: number) => (
                        <div key={i} className="text-xs px-3 py-1.5 rounded" style={{ background: '#fff5f5', color: '#c62828' }}>
                          {new Date(t.time).toLocaleString('zh-CN')} — {t.action}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--ink-300)' }}>无切屏记录</p>
                  )}
                </div>

                {/* Proctor actions */}
                <div>
                  <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-600)' }}>监考员操作记录</h3>
                  {selectedSession.proctorActions?.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedSession.proctorActions.map((a: any, i: number) => (
                        <div key={i} className="text-xs px-3 py-1.5 rounded" style={{ background: '#f0f0f0' }}>
                          <span className="font-medium">{a.action}</span> — {a.message}
                          <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{new Date(a.timestamp).toLocaleString('zh-CN')} · {a.operatorName}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--ink-300)' }}>无操作记录</p>
                  )}
                </div>

                {/* 消息记录 */}
                <div>
                  <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-600)' }}>消息记录</h3>
                  {sessionMessages.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {sessionMessages.map((m: any) => (
                        <div key={m.id} className="text-xs px-3 py-1.5 rounded" style={{
                          background: m.messageType === 'WARN' ? '#fef2f2' : '#f0f7fa',
                        }}>
                          <span className="font-medium">{m.messageType === 'WARN' ? '⚠️ 警告' : 'ℹ️ 消息'}</span> — {m.content}
                          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ink-300)' }}>
                            <span>{m.senderName} · {new Date(m.sentAt).toLocaleString('zh-CN')}</span>
                            <span style={{ color: m.readAt ? 'var(--cyan)' : 'var(--fox)', fontWeight: m.readAt ? 400 : 600 }}>
                              {m.readAt ? '🟢 已读' : '🔴 未读'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无消息</p>
                  )}
                </div>

                {/* Action buttons */}
                {selectedSession.status !== 'SUBMITTED' && (
                  <div className="space-y-2 pt-2">
                    <button onClick={() => setWarnModal({ sessionId: selectedSession.sessionId })}
                      className="btn w-full text-sm py-2" style={{ border: '1px solid var(--fox)', color: 'var(--fox)' }}>
                      ⚠️ 发送警告
                    </button>
                    <button onClick={() => handleExtendTime(selectedSession.sessionId)}
                      className="btn w-full text-sm py-2" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>
                      ⏱ 延长10分钟
                    </button>
                    <button onClick={() => setForceSubmitModal({ sessionId: selectedSession.sessionId })}
                      className="btn w-full text-sm py-2" style={{ border: '1px solid #e53935', color: '#e53935' }}>
                      🛑 强制交卷
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--ink-300)' }}>加载失败</p>
            )}
          </div>
        </div>
      )}

      {/* Warn Modal */}
      {warnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWarnModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
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
      {forceSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setForceSubmitModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: '#e53935' }}>🛑 强制交卷</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>此操作将强制提交该考生的试卷，不可撤销。</p>
            <input value={forceSubmitReason} onChange={e => setForceSubmitReason(e.target.value)}
              className="input w-full mb-3" placeholder="强制交卷原因" />
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="input w-full mb-4" placeholder='输入"确认交卷"以确认' />
            <div className="flex gap-2">
              <button onClick={handleForceSubmit} disabled={actionLoading || confirmText !== '确认交卷'} className="btn btn-sm flex-1 text-white" style={{ background: confirmText === '确认交卷' ? '#e53935' : '#ccc' }}>
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
