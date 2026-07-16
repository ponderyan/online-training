'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';

const ROLE_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'SUPER_ADMIN', label: '超级管理员' },
  { value: 'ORG_ADMIN', label: '机构管理员' },
  { value: 'EXAM_OFFICER', label: '考务员' },
  { value: 'LECTURER', label: '讲师' },
  { value: 'PROCTOR', label: '监考员' },
  { value: 'AGENCY_ADMIN', label: '招生机构管理员' },
  { value: 'AUDITOR', label: '审计员' },
  { value: 'STUDENT', label: '学员' },
];

const MSG_TYPE_LABELS: Record<string, string> = {
  SYSTEM_NOTICE: '系统通知', ANNOUNCEMENT: '平台公告',
  EXAM_STARTING: '考试开始提醒', PROGRAM_ENROLLED: '培训班报名成功',
  PROGRAM_STATUS: '培训班状态变更', ACCOUNT_CREATED: '账号创建通知',
  CERT_EXPIRING: '证书到期提醒', EXAM_PUBLISHED: '考试发布',
  EXAM_GRADED: '成绩发布', CERT_ISSUED: '证书发放',
  LEARNING_HOUR_APPROVED: '学时审批通过', LEARNING_HOUR_REJECTED: '学时审批驳回',
};

const CHANNEL_ICONS: Record<string, Record<string, string>> = {
  in_app: { SENT: '📨✓', PENDING: '📨⋯', FAILED: '📨✗', DISABLED: '📨—' },
  email:  { SENT: '✉️✓', PENDING: '✉️⋯', FAILED: '✉️✗', DISABLED: '✉️—' },
  sms:    { SENT: '💬✓', PENDING: '💬⋯', FAILED: '💬✗', DISABLED: '💬—' },
};

const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
};

export default function AdminMessagesPage() {
  const toast = useToast();
  const [view, setView] = useState<'inbox' | 'compose' | 'history'>('inbox');

  // ── Inbox ──
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const res = await fetch('/api/notifications?pageSize=50', { headers: getHeaders() });
      const data = await res.json();
      setNotifications(data.items || []);
    } catch {}
    setLoadingInbox(false);
  }, []);

  useEffect(() => { if (view === 'inbox') loadInbox(); }, [view]); // eslint-disable-line

  // ── Sent History ──
  const [sentHistory, setSentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadSentHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/notifications/sent-history?pageSize=50', { headers: getHeaders() });
      const data = await res.json();
      setSentHistory(data.items || []);
    } catch {}
    setLoadingHistory(false);
  }, []);

  useEffect(() => { if (view === 'history') loadSentHistory(); }, [view]); // eslint-disable-line

  const toggleExpand = (key: string) => {
    setExpandedId(prev => prev === key ? null : key);
  };

  // ── Compose ──
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [msgType, setMsgType] = useState('SYSTEM_NOTICE');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendChannels, setSendChannels] = useState({ inApp: true, email: false, sms: false });

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/notifications/candidates?${params.toString()}`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCandidates(await res.json());
    } catch { toast.error('加载用户列表失败'); }
    setLoading(false);
  }, [roleFilter, searchText]); // eslint-disable-line

  useEffect(() => { loadCandidates(); }, [roleFilter]);
  useEffect(() => { const t = setTimeout(() => loadCandidates(), 500); return () => clearTimeout(t); }, [searchText]); // eslint-disable-line

  const toggleSelect = (id: number) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll = () => {
    if (selectedIds.length === candidates.length) setSelectedIds([]);
    else setSelectedIds(candidates.map(c => c.id));
  };

  const handleSend = async () => {
    if (!title || !message || selectedIds.length === 0) { toast.warning('请填写标题、内容并选择收件人'); return; }
    if (!sendChannels.inApp && !sendChannels.email && !sendChannels.sms) { toast.warning('请选择至少一个发送渠道'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          userIds: selectedIds, title, message, type: msgType,
          sendInApp: sendChannels.inApp, sendEmail: sendChannels.email, sendSms: sendChannels.sms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const parts = [];
        if (sendChannels.inApp) parts.push('站内信');
        if (sendChannels.email) parts.push('邮件');
        if (sendChannels.sms) parts.push('短信');
        const sent = data.sentCount ?? 0;
        const failed = data.failedCount ?? 0;
        if (failed === 0) {
          toast.success(`已通过 ${parts.join('+')} 发送给 ${sent} 位用户`);
        } else if (sent > 0) {
          toast.warning(`已通过 ${parts.join('+')} 发送 ${sent} 位，失败 ${failed} 位`);
        } else {
          toast.error('发送失败，请检查');
        }
        setTitle(''); setMessage(''); setSelectedIds([]);
      } else { toast.error(data.error || '发送失败'); }
    } catch { toast.error('发送失败'); }
    setSending(false);
  };

  const tabs = [
    { key: 'inbox' as const, label: '📨 收件箱' },
    { key: 'compose' as const, label: '✏️ 发送消息' },
    { key: 'history' as const, label: '📋 发送记录' },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📢 消息中心</h1>
        <p className="page-subtitle">收件箱 · 发送消息 · 发送记录</p>
      </div>

      {/* Tab */}
      <div className="flex gap-1 mb-6 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: view === t.key ? 'var(--paper)' : 'transparent', color: view === t.key ? 'var(--fox)' : 'var(--ink-400)', boxShadow: view === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ 收件箱 ═══ */}
      {view === 'inbox' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 text-xs font-medium flex items-center justify-between" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
            <span>收件箱</span>
            <button onClick={loadInbox} className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>刷新</button>
          </div>
          {loadingInbox ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>📨 暂无通知</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
              {notifications.map((n: any) => (
                <div key={n.id} className="px-4 py-3" style={{ background: n.isRead ? 'transparent' : 'var(--fox-glow)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                        {MSG_TYPE_LABELS[n.type] || n.type}
                      </span>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fox)' }} />}
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{new Date(n.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--ink-700)' }}>{n.title}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-500)' }}>{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 发送消息 ═══ */}
      {view === 'compose' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>🎯 选择收件人</h3>
            <div className="flex gap-2 mb-3">
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input select text-xs" style={{ width: 130 }}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="搜索…" className="input text-xs flex-1" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>{loading ? '加载中…' : `共 ${candidates.length} 人`}</span>
              <button onClick={selectAll} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                {selectedIds.length === candidates.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {candidates.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 p-2 rounded cursor-pointer text-xs hover:bg-[var(--fox-glow)]"
                  style={{ background: selectedIds.includes(u.id) ? 'var(--fox-glow)' : 'transparent' }}>
                  <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelect(u.id)} className="accent-[var(--fox)] w-3.5 h-3.5" />
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>{u.displayName?.[0] || '?'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.displayName}</div>
                    <div style={{ color: 'var(--ink-300)' }}>{u.phone || '—'}</div>
                  </div>
                </label>
              ))}
              {candidates.length === 0 && !loading && <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无用户</p>}
            </div>
            {selectedIds.length > 0 && (
              <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'var(--fox-glow)' }}>
                已选 <strong style={{ color: 'var(--fox)' }}>{selectedIds.length}</strong> 人
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>✏️ 编写消息</h3>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>消息类型</label>
              <select value={msgType} onChange={e => setMsgType(e.target.value)} className="input select">
                {Object.entries(MSG_TYPE_LABELS).filter(([k]) => !['EXAM_PUBLISHED','EXAM_GRADED','CERT_ISSUED','LEARNING_HOUR_APPROVED','LEARNING_HOUR_REJECTED'].includes(k)).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="消息标题" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>内容</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className="input textarea" rows={6} placeholder="消息正文…" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-500)' }}>发送渠道</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={sendChannels.inApp} onChange={e => setSendChannels(p => ({ ...p, inApp: e.target.checked }))} className="accent-[var(--fox)]" /> 📨 站内信
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={sendChannels.email} onChange={e => setSendChannels(p => ({ ...p, email: e.target.checked }))} className="accent-[var(--fox)]" /> ✉️ 邮件
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={sendChannels.sms} onChange={e => setSendChannels(p => ({ ...p, sms: e.target.checked }))} className="accent-[var(--fox)]" /> 💬 短信
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                将发送给 <strong style={{ color: 'var(--fox)' }}>{selectedIds.length}</strong> 位用户
              </span>
              <button onClick={handleSend} disabled={sending || selectedIds.length === 0 || (!sendChannels.inApp && !sendChannels.email && !sendChannels.sms)}
                className="btn btn-fox btn-sm">{sending ? '发送中…' : '📤 发送'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 发送记录 ═══ */}
      {view === 'history' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 text-xs font-medium flex items-center justify-between" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
            <span>发送记录</span>
            <button onClick={loadSentHistory} className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>刷新</button>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
          ) : sentHistory.length === 0 ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>📋 暂无发送记录</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
              {sentHistory.map((batch: any) => {
                const key = batch.batchId || `single-${batch.notifications?.[0]?.id}`;
                const ch = batch.channels || {};
                // 各通道聚合状态：✓N 成功 / ✗N 失败 / ⋯N 进行中
                const channelSummary = (chName: 'in_app' | 'email' | 'sms') => {
                  const s = ch[chName];
                  if (!s) return null;
                  const total = batch.recipientCount || 0;
                  if (total > 0 && s.sent === 0 && s.failed === 0 && s.pending === 0 && s.disabled === 0) return null;
                  const parts: string[] = [];
                  if (s.sent) parts.push(`✓${s.sent}`);
                  if (s.failed) parts.push(`✗${s.failed}`);
                  if (s.pending) parts.push(`⋯${s.pending}`);
                  if (s.disabled) parts.push(`—${s.disabled}`);
                  return parts.length ? parts.join(' ') : '—';
                };
                const recipientNames = (batch.recipients || []).map((r: any) => r.displayName);
                const moreCount = batch.recipientCount - recipientNames.length;
                return (
                  <div key={key}>
                    <div className="px-4 py-3 cursor-pointer hover:bg-[var(--fox-glow)] transition-colors" onClick={() => toggleExpand(key)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                          {MSG_TYPE_LABELS[batch.type] || batch.type}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>{new Date(batch.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--ink-700)' }}>{batch.title}</div>
                      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--ink-400)' }}>
                        <span>收件人 <strong style={{ color: 'var(--fox)' }}>{batch.recipientCount}</strong> 人</span>
                        {recipientNames.length > 0 && (
                          <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                            {recipientNames.join('、')}{moreCount > 0 ? ` 等 ${batch.recipientCount} 人` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-2 ml-auto">
                          {(['in_app', 'email', 'sms'] as const).map(c => {
                            const sum = channelSummary(c);
                            if (!sum) return null;
                            return <span key={c} title={`${c}: ${sum}`}>{CHANNEL_ICONS[c]?.SENT?.slice(0, 2)}{sum}</span>;
                          })}
                        </span>
                      </div>
                    </div>
                    {expandedId === key && (
                      <div className="px-4 pb-3 pt-0 text-xs space-y-1" style={{ color: 'var(--ink-400)' }}>
                        <div className="pl-4 pb-1 text-[10px]" style={{ color: 'var(--ink-300)' }}>消息内容：{batch.message?.substring(0, 100)}</div>
                        {(batch.notifications || []).map((n: any) => {
                          const nMap: Record<string, any> = {};
                          (n.channels || []).forEach((c: any) => { nMap[c.channel] = c; });
                          return (
                            <div key={n.id} className="flex items-center gap-2 pl-4 py-0.5">
                              <span className="inline-block w-5 h-5 rounded text-center text-[9px] leading-5 flex-shrink-0" style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>{n.displayName?.[0] || '?'}</span>
                              <span className="font-medium w-20 truncate">{n.displayName}</span>
                              {(['in_app', 'email', 'sms'] as const).map(c => {
                                const s = nMap[c]?.status || 'DISABLED';
                                const err = nMap[c]?.errorMessage;
                                return (
                                  <span key={c} className="flex items-center gap-1" title={err || `${c}: ${s}`}>
                                    {CHANNEL_ICONS[c]?.[s] || '—'}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
