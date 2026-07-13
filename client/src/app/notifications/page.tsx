'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonList } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

const FOX = '#e87a30';
const INK_200 = '#bbb';
const INK_300 = '#999';
const INK_400 = '#777';
const INK_600 = '#444';
const INK_700 = '#333';

const TYPE_ICONS: Record<string, string> = {
  EXAM_PUBLISHED: '📢',
  EXAM_CONFIRMED: '🔒',
  EXAM_GRADED: '📝',
  APPEAL_SUBMITTED: '⚖️',
  APPEAL_RESOLVED: '⚖️',
  GRADING_ASSIGNED: '📝',
  CERT_ISSUED: '🏅',
  CERT_APPROVED: '✅',
  CERT_REJECTED: '❌',
  CERT_APPLICATION: '📋',
  LEARNING_HOUR_APPROVED: '✅',
  LEARNING_HOUR_REJECTED: '❌',
  SYSTEM_NOTICE: '🔔',
  ANNOUNCEMENT: '📢',
};

const TYPE_ROUTES: Record<string, string> = {
  EXAM_PUBLISHED: '/exam',
  EXAM_CONFIRMED: '/exam',
  EXAM_GRADED: '/exam',
  APPEAL_SUBMITTED: '/grading',
  APPEAL_RESOLVED: '/exams/appeals',
  GRADING_ASSIGNED: '/grading',
  CERT_ISSUED: '/my-certificates',
  CERT_APPROVED: '/my-certificates',
  CERT_REJECTED: '/my-certificates',
  CERT_APPLICATION: '/certificates/applications',
  LEARNING_HOUR_APPROVED: '/learning-hours',
  LEARNING_HOUR_REJECTED: '/learning-hours',
  SYSTEM_NOTICE: '/notifications',
  ANNOUNCEMENT: '/notifications',
};

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

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter === 'unread') params.set('unreadOnly', 'true');
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setNotifications(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || '加载通知列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, filter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      load();
    } catch (e: any) {
      toast.error('标记已读失败：' + (e.message || '未知错误'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      toast.success('已全部标为已读');
      load();
    } catch (e: any) {
      toast.error('操作失败：' + (e.message || '未知错误'));
    }
  };

  const handleClick = (n: any) => {
    if (!n.isRead) handleMarkRead(n.id);
    router.push(TYPE_ROUTES[n.type] || '/notifications');
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ color: INK_700 }}>🔔 消息通知</h1>
          <p className="page-subtitle" style={{ color: INK_400 }}>共 {total} 条通知</p>
        </div>
        {total > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: `1px solid ${FOX}`,
              background: 'transparent',
              color: FOX,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = FOX; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = FOX; }}
          >
            全部标已读
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: filter === f ? 'none' : `1px solid ${INK_200}`,
              background: filter === f ? FOX : 'transparent',
              color: filter === f ? 'white' : INK_400,
            }}
          >
            {f === 'all' ? '全部' : '未读'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonList count={5} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : notifications.length === 0 ? (
        <div className="card"><EmptyState icon="🔔" title="暂时没有新消息" description="新的通知会在这里提醒你" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n: any) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: n.isRead ? 'white' : 'rgba(232,122,48,0.04)',
                border: `1px solid ${n.isRead ? 'var(--ink-100, #e8e4e0)' : 'rgba(232,122,48,0.15)'}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICONS[n.type] || '📌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        color: n.isRead ? INK_400 : INK_700,
                      }}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: FOX,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: INK_300, lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: INK_200 }}>{timeAgo(n.createdAt)}</span>
                    {!n.isRead && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                        style={{
                          fontSize: 11,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: FOX,
                          padding: 0,
                        }}
                      >
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
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              border: `1px solid ${INK_200}`,
              background: 'white',
              color: page <= 1 ? INK_200 : INK_600,
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            上一页
          </button>

          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 1) return true;
                if (p === page - 2 || p === page + 2) return true;
                return false;
              })
              .map((p, idx, arr) => {
                const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                return (
                  <span key={p} style={{ display: 'flex', gap: 4 }}>
                    {showEllipsis && (
                      <span style={{ padding: '6px 4px', fontSize: 13, color: INK_300 }}>…</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 13,
                        cursor: 'pointer',
                        border: 'none',
                        background: page === p ? FOX : 'transparent',
                        color: page === p ? 'white' : INK_400,
                        fontWeight: page === p ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              border: `1px solid ${INK_200}`,
              background: 'white',
              color: page >= totalPages ? INK_200 : INK_600,
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            下一页
          </button>
        </div>
      )}
    </AppLayout>
  );
}
