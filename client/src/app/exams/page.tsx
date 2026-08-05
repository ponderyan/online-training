'use client';

import { EXAM_STATUS_OPTIONS, EXAM_STATUS_COLORS, EXAM_STATUS_LABELS, EXAM_MODE_OPTIONS } from '@/lib/exam-constants';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { can } from '@/lib/auth';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonList } from '@/components/Skeleton';
import { useDebounce } from '@/hooks/use-debounce';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, Search, MonitorPlay, BarChart3, Pencil } from 'lucide-react';






export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');

  const load = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (filterStatus) params.status = filterStatus;
      if (filterMode) params.examMode = filterMode;
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

  // ★ 筛选条件变化时重新加载（修复 onChange 直接调 load 导致的闭包过期问题）
  // 首次挂载时也会执行一次，完成初始加载
  useEffect(() => { load(1); }, [debouncedKeyword, filterStatus, filterMode]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2"><ClipboardList size={22} className="text-[var(--fox)]" /> 考试管理</h1>
          <p className="page-subtitle">共 {total} 场 · 创建和管理在线考试</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => router.push('/exams/create')}>创建考试</Button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative" style={{ maxWidth: 320 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-300)] pointer-events-none" />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索考试标题…" className="input pl-8" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input select" style={{ maxWidth: 140 }}>
          {EXAM_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
          className="input select" style={{ maxWidth: 130 }}>
          {EXAM_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonList count={5} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState icon="📋" title="还没有考试场次" description="创建第一场考试，开始管理在线考试">
            <Button size="sm" onClick={() => router.push('/exams/create')}>创建第一场考试</Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {exams.map(exam => (
              <Card key={exam.id} hover padding="md" className="cursor-pointer"
                onClick={() => router.push(`/exams/${exam.id}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1 text-[var(--ink-700)]">{exam.title}</h3>
                    <div className="flex gap-4 text-xs text-[var(--ink-400)]">
                      <span>试卷：{exam.paper?.name || '-'}</span>
                      <span>学员：{exam._count?.sessions ?? 0}人</span>
                      <span>时长：{exam.durationMinutes}分钟</span>
                    </div>
                    <div className="text-xs mt-1 text-[var(--ink-300)]">
                      {exam.startTime ? new Date(exam.startTime).toLocaleString('zh-CN') : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(exam.status === 'IN_PROGRESS' || exam.status === 'PUBLISHED') && (
                      <span onClick={e => { e.stopPropagation(); router.push(`/proctoring/${exam.id}`); }}
                        className="text-[10px] px-2 py-1 rounded cursor-pointer bg-[var(--error-pale)] text-[var(--error)] inline-flex items-center gap-1">
                        <MonitorPlay size={10} /> 监考
                      </span>
                    )}
                    {exam.status === 'FINISHED' && (
                      <span onClick={e => { e.stopPropagation(); router.push(`/exams/${exam.id}/analysis`); }}
                        className="text-[10px] px-2 py-1 rounded cursor-pointer bg-[var(--fox-pale)] text-[var(--fox)] inline-flex items-center gap-1">
                        <BarChart3 size={10} /> 分析
                      </span>
                    )}
                    <span onClick={e => { e.stopPropagation(); router.push(`/admin/exam-results/${exam.id}`); }}
                      className="text-[10px] px-2 py-1 rounded cursor-pointer bg-[var(--fox-pale)] text-[var(--fox)] inline-flex items-center gap-1">
                      <BarChart3 size={10} /> 查看结果
                    </span>
                    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{
                      background: `${EXAM_STATUS_COLORS[exam.status]}18`,
                      color: EXAM_STATUS_COLORS[exam.status],
                    }}>{EXAM_STATUS_LABELS[exam.status] || exam.status}</span>
                    {exam.orgId && (
                      <span className="tag tag-gold" style={{ fontSize: '10px', padding: '1px 5px', marginLeft: '4px' }}>
                        机构
                      </span>
                    )}
                    {exam.examMode === 'OFFLINE' && (
                      <span className="tag" style={{ fontSize: '10px', padding: '1px 5px', marginLeft: '4px', background: 'var(--amber-glow, #fef3c7)', color: 'var(--amber, #d97706)' }}>
                        ✍️ 线下
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>‹ 上一页</button>
              <span className="text-xs text-[var(--ink-400)]">{page}/{totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>下一页 ›</button>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
