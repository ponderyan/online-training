'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonList } from '@/components/Skeleton';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { ClipboardList, Plus, Search, FolderOpen, Calendar, MapPin, Users, User } from 'lucide-react';

const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  PREPARING: 'var(--ink-300)', ENROLLING: 'var(--info)', IN_PROGRESS: 'var(--fox)',
  REVIEWING: 'var(--fox)', CERTIFYING: 'var(--purple)', COMPLETED: 'var(--sage)', CANCELLED: 'var(--neutral-300)',
};
const STATUS_ORDER: string[] = ['PREPARING', 'ENROLLING', 'IN_PROGRESS', 'REVIEWING', 'CERTIFYING', 'COMPLETED', 'CANCELLED'];

const PAGE_SIZE = 20;

function formatDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function FeeTag({ label, amount }: { label: string; amount: number | null | undefined }) {
  if (amount === null || amount === undefined || amount === 0) return null;
  return (
    <span className="text-[var(--ink-400)] text-xs">
      {label}¥{amount.toLocaleString()}
    </span>
  );
}

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword);
  const [filterStatus, setFilterStatus] = useState('');

  const load = async (p?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p || page), pageSize: String(PAGE_SIZE) };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (filterStatus) params.status = filterStatus;
      const data = await api.trainingPrograms.list(params);
      setPrograms(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (p) setPage(p);
    } catch (e: any) {
      setError(e.message || '加载培训班列表失败');
    }
    setLoading(false);
  };
  useEffect(() => { load(1); }, []);

  // Stats by status
  const stats = (() => {
    const counts: Record<string, number> = {};
    for (const p of programs) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  })();

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2"><ClipboardList size={22} className="text-[var(--fox)]" /> 培训班管理</h1>
          <p className="page-subtitle">共 {total} 个培训班 · 培训班级 · 招生报名 · 考试关联</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => router.push('/programs/new')}>新建培训班</Button>
      </div>

      {/* 状态统计条 */}
      {!loading && programs.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {STATUS_ORDER.filter(s => stats[s]).map(s => (
            <span key={s} className="text-xs font-medium px-3 py-1 rounded-full" style={{
              background: `color-mix(in srgb, ${STATUS_COLORS[s] || 'var(--neutral-400)'} 10%, transparent)`, color: STATUS_COLORS[s] || 'var(--neutral-400)',
            }}>
              {STATUS_NAMES[s]} {stats[s]}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索培训班名称…"
          className="input" style={{ maxWidth: 320 }}
          onKeyDown={e => { if (e.key === 'Enter') load(1); }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(1); }}
          className="input select" style={{ maxWidth: 140 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonList count={5} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : programs.length === 0 ? (
        <div className="card">
          <EmptyState icon="" title="暂无培训班" description="创建第一个培训班，开始招生和排课">
            <Button size="sm" icon={<Plus size={14} />} onClick={() => router.push('/programs/new')}>创建第一个培训班</Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {programs.map((p: any) => (
              <div key={p.id} onClick={() => router.push(`/programs/${p.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-md bg-[var(--paper-bright)] border border-[var(--ink-100)]">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[var(--ink-300)] text-xs font-mono">{p.code}</span>
                      <h3 className="font-semibold" style={{ color: 'var(--ink-700)', fontSize: 15 }}>{p.name}</h3>
                      {p.headTeacher && (
                        <span className="text-[var(--fox)] text-xs">
                          <User size={12} className="inline mr-0.5" />{p.headTeacher}
                        </span>
                      )}
                    </div>
                    {/* 信息行 1: 科目 · 日期 · 地点 */}
                    <div className="text-[var(--ink-400)] flex gap-4 text-xs flex-wrap mb-1.5">
                      <span><FolderOpen size={12} className="inline mr-0.5" />{p.subject?.code || p.subjectId || '—'}</span>
                      {p.startDate && (
                        <span><Calendar size={12} className="inline mr-0.5" />{formatDate(p.startDate)} ~ {formatDate(p.endDate)}</span>
                      )}
                      {p.location && <span><MapPin size={12} className="inline mr-0.5" />{p.location}</span>}
                    </div>
                    {/* 信息行 2: 学员 · 费用 */}
                    <div className="text-[var(--ink-400)] flex gap-4 text-xs flex-wrap">
                      <span><Users size={12} className="inline mr-0.5" />{p.enrolledCount || 0}/{p.maxStudents || '不限'}人</span>
                      <FeeTag label="培训费" amount={p.tuitionFee} />
                      <FeeTag label="考试费" amount={p.examFee} />
                      <FeeTag label="证书费" amount={p.certFee} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full ml-3" style={{
                    background: `color-mix(in srgb, ${STATUS_COLORS[p.status] || 'var(--neutral-400)'} 10%, transparent)`,
                    color: STATUS_COLORS[p.status] || 'var(--neutral-400)',
                  }}>{STATUS_NAMES[p.status] || p.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          <Pagination page={page} totalPages={totalPages} total={total} onChange={(p) => load(p)} />
        </>
      )}
    </AppLayout>
  );
}
