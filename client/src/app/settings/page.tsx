'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 原「系统设置」页面已合并至「配置中心」。
 * 此路由保留仅为兼容旧链接，自动跳转。
 */
export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/system-config');
  }, [router]);

  return (
    <div className="text-[var(--neutral-400)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',  }}>
      正在跳转至配置中心…
    </div>
  );
}
