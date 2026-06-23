'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function Grading() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.exams.list({ pageSize: '100' } as any);
      const filtered = (data.items || []).filter((e: any) => e.status !== 'DRAFT' && e.status !== 'CANCELLED');
      filtered.sort((a: any, b: any) => (b.submittedCount || 0) - (a.submittedCount || 0));
      setExams(keyword ? filtered.filter((e: any) => e.title?.includes(keyword)) : filtered);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totalGrading = exams.filter(e => e.status === 'FINISHED' || e.status === 'IN_PROGRESS').length;
  const totalPublished = exams.filter(e => e.submittedCount > 0 && e.status === 'FINISHED').length;
  const totalPending = exams.reduce((s, e) => s + ((e._count?.sessions || 0) - (e.submittedCount || 0)), 0);
  const overall = exams.length > 0 ? Math.round(totalPublished / Math.max(totalGrading, 1) * 100) : 0;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📊 阅卷中心</h1>
        <p className="page-subtitle">主观题阅卷 · 成绩发布 · 教考分离</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { value: totalGrading, label: '待阅卷场次', icon: '📝', color: 'var(--fox)' },
          { value: totalPublished, label: '已发布成绩', icon: '✅', color: 'var(--cyan)' },
          { value: totalPending, label: '待提交学员', icon: '👤', color: 'var(--gold)' },
          { value: `${overall}%`, label: '整体进度', icon: '📈', color: 'var(--sage)' },
        ].map((s, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="🔍 搜索考试标题…" className="input mb-4" style={{ maxWidth: 320 }} onKeyDown={e => e.key === 'Enter' && load()} />

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : exams.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>📊 暂无待阅卷考试</div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const total = exam._count?.sessions || 0;
            const submitted = exam.submittedCount || 0;
            const progress = total > 0 ? Math.round(submitted / total * 100) : 0;
            return (
              <div key={exam.id} className="rounded-xl p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ background: 'white', border: '1px solid var(--ink-100)' }}
                onClick={() => router.push(`/grading/${exam.id}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
                    <p className="text-xs mb-2" style={{ color: 'var(--ink-400)' }}>
                      📄 {exam.paper?.name || '-'} · 👥 {total}人 · 已提交 {submitted}人
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--cyan)' : 'var(--fox)' }} />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: progress === 100 ? 'var(--cyan)' : 'var(--fox)' }}>{progress}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: '#fef3e7', color: '#e87a30' }}>进入阅卷 →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
