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
    if (u) {
      let userData = JSON.parse(u);
      // Merge permissions from localStorage
      const permsStr = localStorage.getItem('userPermissions');
      if (permsStr) {
        const permsData = JSON.parse(permsStr);
        userData.permissions = permsData.permissions || [];
        userData.isSuperAdmin = permsData.isSuperAdmin || false;
        userData.roleInfo = permsData.roles || [];
        setUser(userData);
        setLoading(false);
      } else {
        // 兜底：旧登录没有 userPermissions，从 API 获取
        setUser(userData);
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
              setUser({ ...userData });
            }
          }).catch(() => {});
        }
        setLoading(false);
      }
    } else { router.push('/login'); }
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
