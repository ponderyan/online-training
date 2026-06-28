'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/app-layout';
import PracticePlayer from '@/components/practice-player';
import { api } from '@/lib/api';

export default function WrongReviewPage() {
  const [started, setStarted] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    api.practice.records({ onlyWrong: true }).then(r => setWrongCount(r.total)).catch(() => {});
  }, []);

  if (!started) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-16 text-center">
          <h1 className="page-title mb-4">❌ 错题重练</h1>
          {wrongCount === 0 ? (
            <>
              <p className="mb-4" style={{ color: 'var(--ink-300)' }}>暂无错题，继续保持！</p>
              <button onClick={() => window.history.back()} className="btn btn-outline btn-sm">返回</button>
            </>
          ) : (
            <>
              <p className="mb-6" style={{ color: 'var(--ink-500)' }}>共 <strong>{wrongCount}</strong> 道错题待复习</p>
              <button onClick={() => setStarted(true)} className="btn btn-verm">开始重练</button>
            </>
          )}
        </div>
      </AppLayout>
    );
  }

  const loadQuestions = async () => {
    const data = await api.practice.records({ onlyWrong: true });
    return data.items.map((r: any) => r.question);
  };

  return <PracticePlayer title="错题重练" loadQuestions={loadQuestions} />;
}
