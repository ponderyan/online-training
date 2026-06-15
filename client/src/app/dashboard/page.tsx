'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const QUICK_ACTIONS = [
  { icon: '📝', title: '录入试题', desc: '手动录入 · 批量导入', path: '/questions', color: '#e87a30' },
  { icon: '✨', title: '智能组卷', desc: '配置参数 · 自动生成', path: '/generate', color: '#c9a03a' },
  { icon: '📥', title: '导出试卷', desc: 'Word · 答题卡 · PDF', path: '/papers', color: '#00897b' },
  { icon: '📖', title: '教材出题', desc: '上传PDF → AI生成', path: '/materials', color: '#5a5348' },
];

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ questions: 0, papers: 0, draftPapers: 0 });
  const [recentPapers, setRecentPapers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    api.questions.list({ pageSize: '1' }).then(r => setStats(s => ({ ...s, questions: r.total }))).catch(() => {});
    api.papers.list().then(r => {
      const items = r.items || [];
      setStats(s => ({ ...s, papers: r.total, draftPapers: items.filter((p: any) => p.status === 'DRAFT').length }));
      setRecentPapers(items.slice(0, 5));
    }).catch(() => {});
  }, []);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="page-title">🦊 工作台</h1>
        <p className="page-subtitle">
          {user ? `${user.displayName}，小狐狸已经准备好了` : '小狐狸已经准备好了'}
          ，今天咱们一起出卷吧 🐾
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { value: stats.questions, label: '题库总量', icon: '📚', sub: '累计入库' },
          { value: stats.papers, label: '试卷总数', icon: '📋', sub: '全部试卷' },
          { value: 0, label: '本月新增试题', icon: '📈', sub: '06月统计', accent: true },
          { value: stats.draftPapers, label: '待定稿试卷', icon: '✏️', sub: '需处理', alert: stats.draftPapers > 0 },
        ].map((s, i) => (
          <div key={i} className="stat-card group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-lg opacity-60 group-hover:opacity-100 transition-opacity">{s.icon}</span>
              {(s as any).alert && (
                <span className="w-2 h-2 rounded-full bg-[var(--fox)] animate-pulse flex-shrink-0" />
              )}
            </div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
            <div className="text-[10px] mt-1.5" style={{ color: (s as any).accent ? 'var(--fox)' : 'var(--ink-200)' }}>
              {(s as any).sub || ''}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">快捷操作</div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {QUICK_ACTIONS.map((a, i) => (
          <div key={i} onClick={() => router.push(a.path)}
            className="card p-5 cursor-pointer hover:-translate-y-0.5 transition-all group"
            style={{ borderTop: `3px solid ${a.color}20` }}
            onMouseEnter={e => e.currentTarget.style.borderTopColor = a.color}
            onMouseLeave={e => e.currentTarget.style.borderTopColor = `${a.color}20`}>
            <div className="text-2xl mb-3 opacity-70 group-hover:opacity-100 transition-opacity">{a.icon}</div>
            <div className="font-serif font-bold text-sm" style={{ color: 'var(--ink-800)' }}>{a.title}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{a.desc}</div>
          </div>
        ))}
      </div>

      <div className="section-title">最近编辑</div>
      <div className="card overflow-hidden">
        {recentPapers.length === 0 ? (
          <div className="card-body text-center py-12">
            <div className="text-4xl mb-4 opacity-50">🦊</div>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>
              小狐狸还没找到试卷呢
            </p>
            <button onClick={() => router.push('/generate')}
              className="btn btn-fox btn-sm">
              去创建第一份试卷
            </button>
          </div>
        ) : (
          <div>
            {recentPapers.map((p: any, i: number) => (
              <div key={i} onClick={() => router.push('/papers')}
                className="flex items-center gap-4 px-6 py-4 border-b border-[var(--ink-100)] last:border-b-0 hover:bg-[var(--fox-glow)] cursor-pointer transition-colors group">
                <span className="text-base opacity-30 group-hover:opacity-60 transition-opacity">📄</span>
                <span className="flex-1 text-sm font-medium min-w-0 truncate" style={{ color: 'var(--ink-700)' }}>
                  {p.name}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-300)' }}>
                  {new Date(p.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-400)' }}>
                  {p.subject?.code} · {p.totalScore}分
                </span>
                <span className={`tag flex-shrink-0 ${
                  p.status === 'OFFICIAL' ? 'tag-verm' :
                  p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                }`}>
                  {p.status === 'OFFICIAL' ? '正式' : p.status === 'FINALIZED' ? '已定稿' : '草稿'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
