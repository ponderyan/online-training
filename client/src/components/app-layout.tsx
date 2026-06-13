'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { setUser(JSON.parse(u)); setLoading(false); }
    else { router.push('/login'); }
  }, [router]);

  if (loading) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto max-h-screen p-8 xl:p-10">
        {children}
      </main>
    </div>
  );
}
