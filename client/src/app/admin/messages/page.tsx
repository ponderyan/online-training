'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';

export default function AdminMessagesPage() {
  const [tab, setTab] = useState<'send' | 'sent'>('send');

  // Send form
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [msgType, setMsgType] = useState('SYSTEM_NOTICE');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadCandidates = async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/notifications/candidates?${params.toString()}`, { headers });
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { loadCandidates(); }, [roleFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map((c: any) => c.id));
    }
  };

  const handleSend = async () => {
    if (!title || !message || selectedIds.length === 0) { alert('请填写标题、内容并选择收件人'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST', headers,
        body: JSON.stringify({ userIds: selectedIds, title, message, type: msgType }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 已发送给 ${data.sentCount} 位用户`);
        setTitle(''); setMessage(''); setSelectedIds([]);
      } else { alert('发送失败：' + (data.error || '未知错误')); }
    } catch { alert('发送失败'); }
    setSending(false);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📢 消息中心</h1>
        <p className="page-subtitle">管理通知与公告</p>
      </div>

      <div className="flex gap-3 mb-6 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        {[
          { key: 'send', label: '📤 发送消息' },
          { key: 'sent', label: '📋 已发送记录' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="px-4 py-2 text-sm font-medium border-none bg-transparent cursor-pointer transition-all"
            style={{
              color: tab === t.key ? 'var(--fox)' : 'var(--ink-400)',
              borderBottom: tab === t.key ? '2px solid var(--fox)' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'send' ? (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Recipient selection */}
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>🎯 选择收件人</h3>

            <div className="flex gap-2 mb-3">
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input select text-xs" style={{ width: 120 }}>
                <option value="">全部角色</option>
                <option value="STUDENT">学员</option>
                <option value="LECTURER">讲师</option>
                <option value="ORG_ADMIN">管理员</option>
              </select>
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="搜索姓名/用户名…" className="input text-xs flex-1" />
              <button onClick={loadCandidates} className="btn btn-ghost btn-xs">搜索</button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>共 {candidates.length} 人</span>
              <button onClick={selectAll} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                {selectedIds.length === candidates.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {candidates.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 p-2 rounded cursor-pointer text-xs hover:bg-gray-50"
                  style={{ background: selectedIds.includes(u.id) ? 'var(--fox-glow)' : 'transparent' }}>
                  <input type="checkbox" checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelect(u.id)} className="accent-[#e87a30] w-3.5 h-3.5" />
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                    style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                    {u.displayName?.[0] || '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.displayName}</div>
                    <div style={{ color: 'var(--ink-300)' }}>{u.phone || '—'}</div>
                  </div>
                </label>
              ))}
              {candidates.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无用户</p>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'var(--fox-glow)' }}>
                已选 <strong style={{ color: 'var(--fox)' }}>{selectedIds.length}</strong> 人
              </div>
            )}
          </div>

          {/* Right: Message composition */}
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>✏️ 编写消息</h3>

            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>消息类型</label>
              <select value={msgType} onChange={e => setMsgType(e.target.value)} className="input select">
                <option value="SYSTEM_NOTICE">🔸 系统通知</option>
                <option value="ANNOUNCEMENT">⭐ 平台公告（首页置顶）</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="消息标题" />
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>内容</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                className="input textarea" rows={8} placeholder="消息正文…" />
            </div>

            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                将发送给 <strong style={{ color: 'var(--fox)' }}>{selectedIds.length}</strong> 位用户
              </span>
              <button onClick={handleSend} disabled={sending || selectedIds.length === 0}
                className="btn btn-fox btn-sm">
                {sending ? '发送中…' : '📤 立即发送'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Sent records tab */
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>📋 发送记录</h3>
          <p className="text-xs text-center py-8" style={{ color: 'var(--ink-300)' }}>
            发送记录功能将在后续版本中补充
          </p>
        </div>
      )}
    </AppLayout>
  );
}
