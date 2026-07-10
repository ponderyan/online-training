'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

export default function AdminLearningHoursPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/learning-hours-review');
  }, [router]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-4xl mb-4">🦊</p>
          <p style={{ color: 'var(--ink-300)' }}>跳转中学时审核页面…</p>
        </div>
      </div>
    </AppLayout>
  );
}
