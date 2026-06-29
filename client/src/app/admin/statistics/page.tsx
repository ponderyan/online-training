'use client';

import AppLayout from '@/components/app-layout';
import { useRouter } from 'next/navigation';

export default function StatisticsPage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="page-title">📊 数据中心</h1>
        <p className="page-subtitle">统计分析 · 数据报表</p>
      </div>

      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📈</div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-600)' }}>统计分析模块即将上线</h2>
        <p className="text-sm" style={{ color: 'var(--ink-300)' }}>
          功能开发中，敬请期待…
        </p>
        <p className="text-xs mt-4" style={{ color: 'var(--ink-200)' }}>
          小狐狸正在努力开发 🦊
        </p>
      </div>
    </AppLayout>
  );
}
