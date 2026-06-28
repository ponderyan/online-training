'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/app-layout';
import PracticePlayer from '@/components/practice-player';
import { api } from '@/lib/api';

export default function FavoritePracticePage() {
  const [started, setStarted] = useState(false);
  const [favCount, setFavCount] = useState(0);

  useEffect(() => {
    api.practice.favorite.questions().then(r => setFavCount(r.total)).catch(() => {});
  }, []);

  if (!started) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-16 text-center">
          <h1 className="page-title mb-4">📌 收藏练习</h1>
          {favCount === 0 ? (
            <>
              <p className="mb-4" style={{ color: 'var(--ink-300)' }}>暂无收藏题目</p>
              <p className="text-xs mb-6" style={{ color: 'var(--ink-300)' }}>在练习中点击 ☆ 收藏题目</p>
              <button onClick={() => window.history.back()} className="btn btn-outline btn-sm">返回</button>
            </>
          ) : (
            <>
              <p className="mb-6" style={{ color: 'var(--ink-500)' }}>共 <strong>{favCount}</strong> 道收藏题待练习</p>
              <button onClick={() => setStarted(true)} className="btn btn-fox">开始练习</button>
            </>
          )}
        </div>
      </AppLayout>
    );
  }

  const loadQuestions = async () => {
    const data = await api.practice.favorite.questions();
    return data.items;
  };

  return <PracticePlayer title="收藏练习" loadQuestions={loadQuestions} />;
}
