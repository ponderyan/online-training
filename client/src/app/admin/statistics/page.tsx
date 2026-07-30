'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 已合并到 /admin/dashboard，此路由做永久重定向 */
export default function StatisticsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px] text-sm text-[var(--ink-300)]">
      正在跳转…
    </div>
  );
}
