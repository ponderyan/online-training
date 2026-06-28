'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function PracticePage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);

  useEffect(() => {
    api.subjects.list().then(setSubjects).catch(() => {});
    api.practice.stats().then(setStats).catch(() => {});
  }, []);

  const loadChapters = async (subjectId: number) => {
    if (expandedSubject === subjectId) {
      setExpandedSubject(null);
      return;
    }
    setExpandedSubject(subjectId);
    try {
      const data = await api.chapters.list(subjectId);
      setChapters(data);
    } catch { setChapters([]); }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="page-title mb-6">📝 练习模式</h1>
        <p className="page-subtitle mb-6">不计分 · 不限次 · 即时看解析</p>

        {/* 统计数据 */}
        {stats && (
          <div className="card p-4 mb-6 flex flex-wrap items-center gap-4 text-sm">
            <span>总练习：<strong>{stats.total}</strong> 题</span>
            <span style={{ color: 'var(--cyan)' }}>正确：<strong>{stats.correct}</strong></span>
            <span style={{ color: 'var(--verm)' }}>错误：<strong>{stats.wrong}</strong></span>
            <span>正确率：<strong>{stats.accuracy}%</strong></span>
          </div>
        )}

        {/* 章节练习 */}
        <div className="card p-5 mb-4">
          <h2 className="section-title mb-3">📖 章节练习</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-300)' }}>按科目→章节顺序刷题</p>
          <div className="space-y-1">
            {subjects.map((s: any) => (
              <div key={s.id}>
                <div
                  onClick={() => loadChapters(s.id)}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'var(--paper)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--fox-glow)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--paper)'}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{s.name}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {expandedSubject === s.id ? '收起 ▲' : '展开 ▼'}
                  </span>
                </div>
                {expandedSubject === s.id && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {chapters.length === 0 ? (
                      <p className="text-xs py-2 px-3" style={{ color: 'var(--ink-300)' }}>暂无章节</p>
                    ) : (
                      chapters.map((ch: any) => (
                        <div
                          key={ch.id}
                          onClick={() => router.push(`/practice/chapter?subjectId=${s.id}&chapterId=${ch.id}&subjectName=${encodeURIComponent(s.name)}&chapterName=${encodeURIComponent(ch.name)}`)}
                          className="p-2.5 rounded-lg cursor-pointer transition-colors text-sm"
                          style={{ background: 'var(--paper-dark)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--fox-glow)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--paper-dark)'}
                        >
                          {ch.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 随机练习 */}
        <div className="card p-5 mb-4">
          <h2 className="section-title mb-3">🔀 随机练习</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-300)' }}>按题型+难度随机抽题</p>
          <button onClick={() => router.push('/practice/random')}
            className="btn btn-fox">开始随机练习</button>
        </div>

        {/* 错题重练 */}
        <div className="card p-5 mb-4">
          <h2 className="section-title mb-3">❌ 错题重练</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-300)' }}>回顾做错的题目，针对性巩固</p>
          <button onClick={() => router.push('/practice/wrong')}
            className="btn btn-verm btn-outline">
            {stats?.wrong ? `查看错题（${stats.wrong} 道）` : '暂无错题'}
          </button>
        </div>

        {/* 收藏练习 */}
        <div className="card p-5 mb-4">
          <h2 className="section-title mb-3">📌 收藏练习</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-300)' }}>回顾收藏的题目，针对性巩固</p>
          <button onClick={() => router.push('/practice/favorite')}
            className="btn btn-fox btn-outline">查看收藏</button>
        </div>
      </div>
    </AppLayout>
  );
}
