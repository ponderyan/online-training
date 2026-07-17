'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './sidebar';
import NotificationBell from './notification-bell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.replace('/login'); return; }

    const doRender = (userData: any) => {
      setUser(userData);
      setLoading(false);
    };

    let userData = JSON.parse(u);

    // 优先从 userPermissions 缓存读取
    const permsStr = localStorage.getItem('userPermissions');
    if (permsStr) {
      const permsData = JSON.parse(permsStr);
      if (permsData.permissions && permsData.permissions.length > 0) {
        userData.permissions = permsData.permissions;
        userData.isSuperAdmin = !!permsData.isSuperAdmin;
        userData.roleInfo = permsData.roles || [];
        doRender(userData);
        return;
      }
    }

    // 缓存不可用 → 从登录 user 对象获取（login 接口已返回 permissions）
    if (userData.permissions && userData.permissions.length > 0) {
      doRender(userData);
      return;
    }

    // 都没有 → 从 API 获取（异步加载完成再渲染）
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(permData => {
        if (permData && permData.permissions) {
          localStorage.setItem('userPermissions', JSON.stringify(permData));
          userData.permissions = permData.permissions || [];
          userData.isSuperAdmin = permData.isSuperAdmin || false;
          userData.roleInfo = permData.roles || [];
        }
        doRender(userData);
      }).catch(() => doRender(userData));
    } else {
      doRender(userData);
    }
  }, [router]);

  // 监听 401 鉴权失效事件（由 lib/api.ts 的 redirectToLogin 派发）
  useEffect(() => {
    const handler = () => router.replace('/login');
    window.addEventListener('auth:redirect-login', handler);
    return () => window.removeEventListener('auth:redirect-login', handler);
  }, [router]);

  if (loading) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top header bar */}
        <header className="flex items-center justify-end px-8 py-2.5" style={{
          background: 'white',
          borderBottom: '1px solid var(--ink-100)',
          minHeight: 48,
        }}>
          <NotificationBell user={user} />
        </header>
        {/* Main content */}
        <main className="main-content flex-1 overflow-y-auto min-h-0 p-6 md:p-8 xl:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
