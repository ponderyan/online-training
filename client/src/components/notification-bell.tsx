'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

const TYPE_ICONS: Record<string, string> = {
  EXAM_PUBLISHED: '📢',
  EXAM_CONFIRMED: '🔒',
  APPEAL_SUBMITTED: '⚖️',
  APPEAL_RESOLVED: '⚖️',
  GRADING_ASSIGNED: '📝',
  CERT_ISSUED: '🏅',
  CERT_APPROVED: '✅',
  CERT_REJECTED: '❌',
  CERT_APPLICATION: '📋',
};

const TYPE_ROUTES: Record<string, string> = {
  EXAM_PUBLISHED: '/exam',
  EXAM_CONFIRMED: '/exam',
  APPEAL_SUBMITTED: '/grading',
  APPEAL_RESOLVED: '/exams/appeals',
  GRADING_ASSIGNED: '/grading',
  CERT_ISSUED: '/my-certificates',
  CERT_APPROVED: '/my-certificates',
  CERT_REJECTED: '/my-certificates',
  CERT_APPLICATION: '/certificates/applications',
};

export default function NotificationBell({ user }: { user: any }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { count } = await api.notifications.unreadCount();
      setUnreadCount(count);
    } catch {}
  }, []);

  const openDropdown = useCallback(async () => {
    setOpen(prev => !prev);
    if (!open) {
      setLoading(true);
      try {
        const data = await api.notifications.list({ pageSize: '10' });
        setNotifications(data.items || []);
      } catch {}
      setLoading(false);
    }
  }, [open]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    intervalRef.current = setInterval(loadUnreadCount, 30000);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [loadUnreadCount, handleClickOutside]);

  const handleMarkRead = async (id: number) => {
    try { await api.notifications.markAsRead(id); loadUnreadCount(); } catch {}
  };

  const handleMarkAllRead = async () => {
    try { await api.notifications.markAllAsRead(); setUnreadCount(0); setNotifications(ns => ns.map(n => ({ ...n, isRead: true }))); } catch {}
  };

  const handleClickNotification = (n: any) => {
    if (!n.isRead) handleMarkRead(n.id);
    setOpen(false);
    const route = TYPE_ROUTES[n.type] || '/notifications';
    router.push(route);
  };

  return (
    <div ref={dropdownRef} className="relative" style={{ zIndex: 100 }}>
      <button onClick={openDropdown} className="relative bg-transparent border-none cursor-pointer text-lg px-2 py-1 rounded-lg transition-colors"
        style={{ color: open ? 'var(--fox)' : 'var(--ink-400)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,188,176,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: '#e53935', minWidth: 18, height: 18, fontSize: 10, lineHeight: '18px' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden shadow-xl"
          style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ink-100)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>消息通知</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                全部标为已读
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无通知</div>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} onClick={() => handleClickNotification(n)}
                  className="px-4 py-3 cursor-pointer transition-colors text-sm"
                  style={{ background: n.isRead ? 'white' : 'rgba(232,122,48,0.04)', borderBottom: '1px solid var(--ink-100)' }}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5 flex-shrink-0">{TYPE_ICONS[n.type] || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium" style={{ color: n.isRead ? 'var(--ink-500)' : 'var(--ink-700)' }}>
                        {n.title}
                        {!n.isRead && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fox)' }} />}
                      </div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-300)' }}>{n.message}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-200)' }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--ink-100)' }}>
            <button onClick={() => { setOpen(false); router.push('/notifications'); }}
              className="text-xs bg-transparent border-none cursor-pointer w-full" style={{ color: 'var(--fox)' }}>
              查看全部 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
