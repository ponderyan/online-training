'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { can } from '@/lib/auth';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonList } from '@/components/Skeleton';

const STATUS_OPTS = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'FINISHED', label: '已结束' },
  { value: 'CANCELLED', label: '已取消' },
];

const statusColors: Record<string, string> = {
  DRAFT: '#8b8174', PUBLISHED: '#00897b', IN_PROGRESS: '#e87a30',
  FINISHED: '#5a5348', CANCELLED: '#aaa',
};
const statusLabels: Record<string, string> = {
  DRAFT: '草稿', PUBLISHED: '已发布', IN_PROGRESS: '进行中',
  FINISHED: '已结束', CANCELLED: '已取消',
};

export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (keyword) params.keyword = keyword;
      if (filterStatus) params.status = filterStatus;
      const data = await api.exams.list(params as any);
      setExams(data.items || []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message || '加载考试列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📋 考试管理</h1>
          <p className="page-subtitle">共 {total} 场 · 创建和管理在线考试</p>
        </div>
        <button onClick={() => router.push('/exams/create')} className="btn btn-fox btn-sm">
          + 创建考试
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="🔍 搜索考试标题…" className="input" style={{ maxWidth: 320 }}
          onKeyDown={e => e.key === 'Enter' && load()} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(1); }}
          className="input select" style={{ maxWidth: 140 }}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonList count={5} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState icon="📋" title="还没有考试场次" description="创建第一场考试，开始管理在线考试">
            <button onClick={() => router.push('/exams/create')} className="btn btn-fox btn-sm">创建第一场考试</button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {exams.map(exam => (
              <div key={exam.id} onClick={() => router.push(`/exams/${exam.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-md"
                style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-700)' }}>{exam.title}</h3>
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
                      <span>试卷：{exam.paper?.name || '-'}</span>
                      <span>学员：{exam._count?.sessions ?? 0}人</span>
                      <span>时长：{exam.durationMinutes}分钟</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>
                      {exam.startTime ? new Date(exam.startTime).toLocaleString('zh-CN') : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(exam.status === 'IN_PROGRESS' || exam.status === 'PUBLISHED') && (
                      <span onClick={e => { e.stopPropagation(); router.push(`/proctoring/${exam.id}`); }}
                        className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: '#fef3e7', color: '#e53935' }}>
                        🎥 监考
                      </span>
                    )}
                    {exam.status === 'FINISHED' && (
                      <span onClick={e => { e.stopPropagation(); router.push(`/exams/${exam.id}/analysis`); }}
                        className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                        📊 分析
                      </span>
                    )}
                    <span onClick={e => { e.stopPropagation(); router.push(`/admin/exam-results/${exam.id}`); }}
                      className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                      📊 查看结果
                    </span>
                    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{
                      background: `${statusColors[exam.status]}18`,
                      color: statusColors[exam.status],
                    }}>{statusLabels[exam.status] || exam.status}</span>
                    {exam.orgId && (
                      <span className="tag tag-gold" style={{ fontSize: '10px', padding: '1px 5px', marginLeft: '4px' }}>
                        机构
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>‹ 上一页</button>
              <span className="text-xs" style={{ color: 'var(--ink-400)' }}>{page}/{totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>下一页 ›</button>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
