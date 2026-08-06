'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

export default function OldVideoManagementPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/courses/${params.id}`);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppLayout>
      <div className="text-center py-16">
        <p className="text-[var(--ink-400)] text-sm mb-2">
          📹 视频管理已迁移到「视频课程管理」
        </p>
        <p className="text-[var(--ink-300)] text-xs">
          3秒后自动返回课程详情页…
        </p>
      </div>
    </AppLayout>
  );
}
