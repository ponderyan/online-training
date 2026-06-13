'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ questions: 0, papers: 0, draftPapers: 0 });
  const [recentPapers, setRecentPapers] = useState<any[]>([]);

  useEffect(() => {
    api.questions.list({ pageSize: '1' }).then(r => setStats(s => ({ ...s, questions: r.total }))).catch(() => {});
    api.papers.list().then(r => {
      const items = r.items || [];
      setStats(s => ({ ...s, papers: r.total, draftPapers: items.filter((p: any) => p.status === 'DRAFT').length }));
      setRecentPapers(items.slice(0, 5));
    }).catch(() => {});
  }, []);

  return (
    <AppLayout>
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="page-title">工作台</h1>
        <p className="page-subtitle">效率始于结构，精准源自积累。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { value: stats.questions, label: '题库总量', seal: '总库' },
          { value: stats.papers, label: '试卷总数', seal: '累计' },
          { value: 0, label: '本月新增试题', seal: '06月' },
          { value: stats.draftPapers, label: '待定稿试卷', seal: '提醒', sealColor: '#d9364a' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
            <span className="stat-card-seal"
              style={(s as any).sealColor ? { borderColor: (s as any).sealColor, color: (s as any).sealColor } : {}}>
              {s.seal}
            </span>
          </div>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="section-title">快捷操作</div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: '✎', title: '录入试题', desc: '手动录入 · 批量导入', path: '/questions' },
          { icon: '⚙', title: '智能组卷', desc: '参数配置 · 自动生成', path: '/generate' },
          { icon: '↓', title: '导出试卷', desc: 'Word · PDF 输出', path: '/papers' },
        ].map((a, i) => (
          <div key={i} onClick={() => router.push(a.path)}
            className="card p-6 cursor-pointer hover:border-[#c9a03a] group">
            <div className="text-2xl mb-3 opacity-70 group-hover:opacity-100 transition-opacity">{a.icon}</div>
            <div className="font-serif font-bold text-base" style={{ color: 'var(--ink-800)' }}>{a.title}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--ink-400)' }}>{a.desc}</div>
          </div>
        ))}
      </div>

      {/* 最近编辑 */}
      <div className="section-title">最近编辑</div>
      <div className="card overflow-hidden">
        {recentPapers.length === 0 ? (
          <div className="card-body text-center" style={{ color: 'var(--ink-400)' }}>
            <p className="text-sm">暂无试卷</p>
            <button onClick={() => router.push('/generate')}
              className="btn btn-ghost btn-sm mt-3">
              去创建第一份试卷
            </button>
          </div>
        ) : (
          <div>
            {recentPapers.map((p: any, i: number) => (
              <div key={i} onClick={() => router.push('/papers')}
                className="flex items-center px-6 py-3.5 border-b border-[var(--ink-100)] last:border-b-0 hover:bg-[var(--gold-glow)] cursor-pointer transition-colors">
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{p.name}</span>
                <span className="text-xs mx-4" style={{ color: 'var(--ink-400)' }}>
                  {p.subject?.code} · {p.totalScore}分
                </span>
                <span className={`tag ${
                  p.status === 'OFFICIAL' ? 'tag-verm' :
                  p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                }`}>
                  {p.status === 'OFFICIAL' ? '正式考卷' : p.status === 'FINALIZED' ? '已定稿' : '草稿'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
