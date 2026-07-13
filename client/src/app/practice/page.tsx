'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonBar } from '@/components/Skeleton';

export default function PracticePage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.subjects.list().catch(() => []),
      api.practice.stats().catch(() => null),
    ]).then(([s, st]) => {
      setSubjects(s);
      setStats(st);
    }).catch(e => setError(e.message || '加载失败')).finally(() => setLoading(false));
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

        {/* 统计数据 — 四格方块 */}
        {loading ? (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm">
                <SkeletonBar width="50%" height={26} />
                <div style={{ height: 6 }} />
                <SkeletonBar width="40%" height={11} />
              </div>
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="text-2xl font-bold text-[var(--ink-700)]">{stats.total}</div>
              <div className="text-xs text-[var(--ink-300)]">总练习</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="text-2xl font-bold text-[var(--cyan)]">{stats.correct}</div>
              <div className="text-xs text-[var(--ink-300)]">正确</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="text-2xl font-bold text-[var(--verm)]">{stats.wrong}</div>
              <div className="text-xs text-[var(--ink-300)]">错误</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="text-2xl font-bold text-[var(--fox)]">{stats.accuracy}%</div>
              <div className="text-xs text-[var(--ink-300)]">正确率</div>
            </div>
          </div>
        )}

        {/* 四个模式入口卡片 — 2×2 网格 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 章节练习 — 狐狸橙 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[var(--ink-100)] hover:shadow-md transition-shadow border-l-4 border-l-[var(--fox)]">
            <h2 className="text-base font-semibold text-[var(--ink-700)]">📖 章节练习</h2>
            <p className="text-xs text-[var(--ink-300)] mb-4">按科目→章节顺序刷题</p>

            {/* 科目折叠列表 */}
            <div className="space-y-1 mb-4">
              {loading ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="p-3 rounded-lg bg-[var(--paper)]">
                      <SkeletonBar width="60%" height={13} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <ErrorCard message="科目加载失败" size="small" onRetry={() => window.location.reload()} />
              ) : subjects.length === 0 ? (
                <EmptyState icon="📚" title="暂无科目" description="请联系管理员配置科目" size="small" />
              ) : (
                subjects.map((s: any) => (
                <div key={s.id}>
                  <div
                    onClick={() => loadChapters(s.id)}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[var(--fox-glow)] transition-colors bg-[var(--paper)]"
                  >
                    <span className="text-sm font-medium text-[var(--ink-700)]">{s.name}</span>
                    <span className="text-xs text-[var(--ink-300)]">
                      {expandedSubject === s.id ? '收起 ▲' : '展开 ▼'}
                    </span>
                  </div>
                  {expandedSubject === s.id && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {chapters.length === 0 ? (
                        <p className="text-xs py-2 px-3 text-[var(--ink-300)]">暂无章节</p>
                      ) : (
                        chapters.map((ch: any) => (
                          <div
                            key={ch.id}
                            onClick={() => router.push(`/practice/chapter?subjectId=${s.id}&chapterId=${ch.id}&subjectName=${encodeURIComponent(s.name)}&chapterName=${encodeURIComponent(ch.name)}`)}
                            className="ml-4 p-2.5 rounded-lg cursor-pointer hover:bg-[var(--fox-glow)] transition-colors text-sm bg-[var(--paper-dark)] text-[var(--ink-600)]"
                          >
                            {ch.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
              )}
            </div>

            <button onClick={() => subjects.length > 0 ? loadChapters(subjects[0].id) : router.push('/practice/random')}
              className="px-4 py-1.5 text-xs rounded-full bg-[var(--fox)] text-white hover:bg-[var(--fox-dark)]">
              开始章节练习
            </button>
          </div>

          {/* 随机练习 — 青色 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[var(--ink-100)] hover:shadow-md transition-shadow border-l-4 border-l-[var(--cyan)]">
            <h2 className="text-base font-semibold text-[var(--ink-700)]">🔀 随机练习</h2>
            <p className="text-xs text-[var(--ink-300)] mb-4">按题型+难度随机抽题</p>
            <button onClick={() => router.push('/practice/random')}
              className="px-4 py-1.5 text-xs rounded-full bg-[var(--cyan)] text-white">
              开始随机练习
            </button>
          </div>

          {/* 错题重练 — 朱红 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[var(--ink-100)] hover:shadow-md transition-shadow border-l-4 border-l-[var(--verm)]">
            <h2 className="text-base font-semibold text-[var(--ink-700)]">❌ 错题重练</h2>
            <p className="text-xs text-[var(--ink-300)] mb-4">回顾做错的题目，针对性巩固</p>
            <button onClick={() => router.push('/practice/wrong')}
              className={`px-4 py-1.5 text-xs rounded-full ${
                stats?.wrong
                  ? 'bg-[var(--verm)] text-white'
                  : 'bg-[var(--ink-100)] text-[var(--ink-300)] opacity-50 cursor-not-allowed'
              }`}>
              {stats?.wrong ? `查看错题（${stats.wrong} 道）` : '暂无错题'}
            </button>
          </div>

          {/* 收藏练习 — 金色 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[var(--ink-100)] hover:shadow-md transition-shadow border-l-4 border-l-[var(--gold)]">
            <h2 className="text-base font-semibold text-[var(--ink-700)]">📌 收藏练习</h2>
            <p className="text-xs text-[var(--ink-300)] mb-4">回顾收藏的题目，针对性巩固</p>
            <button onClick={() => router.push('/practice/favorite')}
              className="px-4 py-1.5 text-xs rounded-full bg-[var(--gold)] text-white">
              查看收藏
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
