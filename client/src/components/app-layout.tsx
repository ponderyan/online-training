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
    if (u) { setUser(JSON.parse(u)); setLoading(false); }
    else { router.replace('/login'); }
  }, [router]);

  if (loading) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center justify-end px-8 py-2.5" style={{
          background: 'white',
          borderBottom: '1px solid var(--ink-100)',
          minHeight: 48,
        }}>
          <NotificationBell user={user} />
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
