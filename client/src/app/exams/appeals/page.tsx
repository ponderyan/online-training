'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function MyAppealsPage() {
  const router = useRouter();
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      const user = JSON.parse(u);
      if (user.role === 'STUDENT') {
        api.scoreAppeals.my(user.id).then(setAppeals).catch(() => {}).finally(() => setLoading(false));
      } else setLoading(false);
    } else setLoading(false);
  }, []);

  const STATUS_MAP: Record<string, { text: string; color: string }> = {
    PENDING: { text: '待审核', color: 'var(--gold)' },
    APPROVED: { text: '已批准', color: 'var(--sage)' },
    REJECTED: { text: '已驳回', color: 'var(--verm)' },
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">⚖️ 成绩申诉</h1>
        <p className="page-subtitle">我的申诉记录</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : appeals.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">⚖️</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无申诉记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appeals.map((a: any) => {
            const st = STATUS_MAP[a.status] || { text: a.status, color: 'var(--ink-300)' };
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>{a.exam?.title || '考试'}</h3>
                  <span className="tag text-[10px]" style={{ background: `${st.color}18`, color: st.color }}>{st.text}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
                  <span>原因：{a.reason}</span>
                  <span>原分：{a.oldScore ?? '—'}</span>
                  <span>时间：{new Date(a.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                {a.status === 'APPROVED' && a.newScore && (
                  <div className="mt-2 text-xs" style={{ color: 'var(--sage)' }}>✅ 调整后分数：{a.newScore}</div>
                )}
                {a.reviewNote && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--ink-300)' }}>审核意见：{a.reviewNote}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
