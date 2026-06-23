'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_ICONS: Record<string, string> = {
  EXAM_PUBLISHED: '📢', EXAM_CONFIRMED: '🔒',
  APPEAL_SUBMITTED: '⚖️', APPEAL_RESOLVED: '⚖️',
  GRADING_ASSIGNED: '📝', CERT_ISSUED: '🏅',
  CERT_APPROVED: '✅', CERT_REJECTED: '❌', CERT_APPLICATION: '📋',
  SYSTEM_NOTICE: '🔔', ANNOUNCEMENT: '📢',
};
const TYPE_ROUTES: Record<string, string> = {
  EXAM_PUBLISHED: '/exam', EXAM_CONFIRMED: '/exam',
  APPEAL_SUBMITTED: '/grading', APPEAL_RESOLVED: '/exams/appeals',
  GRADING_ASSIGNED: '/grading', CERT_ISSUED: '/my-certificates',
  CERT_APPROVED: '/my-certificates', CERT_REJECTED: '/my-certificates',
  CERT_APPLICATION: '/certificates/applications',
  SYSTEM_NOTICE: '/notifications', ANNOUNCEMENT: '/notifications',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '30' };
      if (filter === 'unread') params.unreadOnly = 'true';
      const data = await api.notifications.list(params);
      setNotifications(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [page, filter]);

  const handleMarkRead = async (id: number) => {
    try { await api.notifications.markAsRead(id); load(); } catch {}
  };

  const handleMarkAllRead = async () => {
    try { await api.notifications.markAllAsRead(); load(); } catch {}
  };

  const handleClick = (n: any) => {
    if (!n.isRead) handleMarkRead(n.id);
    router.push(TYPE_ROUTES[n.type] || '/notifications');
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🔔 消息通知</h1>
          <p className="page-subtitle">共 {total} 条通知</p>
        </div>
        <button onClick={handleMarkAllRead} className="btn btn-outline btn-sm">全部标为已读</button>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: filter === f ? 'var(--fox)' : 'transparent', color: filter === f ? 'white' : 'var(--ink-400)', border: filter === f ? 'none' : '1px solid var(--ink-200)' }}>
            {f === 'all' ? '全部' : '未读'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🔔</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Announcements first */}
          {notifications.filter(n => n.type === 'ANNOUNCEMENT').map((n: any) => (
            <div key={n.id} className="rounded-xl p-4" style={{ background: '#fff8e1', border: '2px solid #ffc107' }}>
              <div className="flex items-start gap-3">
                <span className="text-xl">⭐</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: '#e65100' }}>{n.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#ffc107', color: '#333' }}>公告</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#795548' }}>{n.message}</p>
                  <span className="text-[10px] mt-1 inline-block" style={{ color: '#a1887f' }}>
                    {new Date(n.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {notifications.filter(n => n.type !== 'ANNOUNCEMENT').map((n: any) => (
            <div key={n.id} onClick={() => handleClick(n)}
              className="rounded-xl p-4 transition-all cursor-pointer"
              style={{ background: n.isRead ? 'white' : 'rgba(232,122,48,0.04)', border: `1px solid ${n.isRead ? 'var(--ink-100)' : 'rgba(232,122,48,0.15)'}` }}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{TYPE_ICONS[n.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: n.isRead ? 'var(--ink-500)' : 'var(--ink-700)' }}>{n.title}</span>
                    {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--fox)' }} />}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px]" style={{ color: 'var(--ink-200)' }}>
                      {new Date(n.createdAt).toLocaleString('zh-CN')}
                    </span>
                    {!n.isRead && (
                      <button onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                        className="text-[10px] bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                        标为已读
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && <button onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-xs">上一页</button>}
          <span className="text-xs px-3 py-1.5" style={{ color: 'var(--ink-400)' }}>第 {page} 页 / 共 {Math.ceil(total / 30)} 页</span>
          {page < Math.ceil(total / 30) && <button onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-xs">下一页</button>}
        </div>
      )}
    </AppLayout>
  );
}
