'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  PREPARING: '#8b8174', ENROLLING: '#00897b', IN_PROGRESS: '#e87a30',
  REVIEWING: '#e87a30', CERTIFYING: '#7b1fa2', COMPLETED: '#2e7d32', CANCELLED: '#aaa',
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
    <span className="text-xs" style={{ color: 'var(--ink-400)' }}>
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
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async (p?: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p || page), pageSize: String(PAGE_SIZE) };
      if (keyword) params.keyword = keyword;
      if (filterStatus) params.status = filterStatus;
      const data = await api.trainingPrograms.list(params);
      setPrograms(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (p) setPage(p);
    } catch {}
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
          <h1 className="page-title">📋 培训班管理</h1>
          <p className="page-subtitle">共 {total} 个培训班 · 培训班级 · 招生报名 · 考试关联</p>
        </div>
        <button onClick={() => router.push('/programs/new')} className="btn btn-fox btn-sm">➕ 新建培训班</button>
      </div>

      {/* 状态统计条 */}
      {!loading && programs.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {STATUS_ORDER.filter(s => stats[s]).map(s => (
            <span key={s} className="text-xs font-medium px-3 py-1 rounded-full" style={{
              background: `${STATUS_COLORS[s] || '#888'}18`, color: STATUS_COLORS[s] || '#888',
            }}>
              {STATUS_NAMES[s]} {stats[s]}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="🔍 搜索培训班名称…"
          className="input" style={{ maxWidth: 320 }}
          onKeyDown={e => { if (e.key === 'Enter') load(1); }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(1); }}
          className="input select" style={{ maxWidth: 140 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : programs.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>
          <p className="text-4xl mb-4">📋</p>
          <p>暂无培训班</p>
          <button onClick={() => router.push('/programs/new')} className="btn btn-fox btn-sm mt-4">创建第一个培训班</button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {programs.map((p: any) => (
              <div key={p.id} onClick={() => router.push(`/programs/${p.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer hover:shadow-md"
                style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{p.code}</span>
                      <h3 className="font-semibold" style={{ color: 'var(--ink-700)', fontSize: 15 }}>{p.name}</h3>
                      {p.headTeacher && (
                        <span className="text-xs" style={{ color: 'var(--fox)' }}>
                          👤 {p.headTeacher}
                        </span>
                      )}
                    </div>
                    {/* 信息行 1: 科目 · 日期 · 地点 */}
                    <div className="flex gap-4 text-xs flex-wrap mb-1.5" style={{ color: 'var(--ink-400)' }}>
                      <span>📂 {p.subject?.code || p.subjectId || '—'}</span>
                      {p.startDate && (
                        <span>📅 {formatDate(p.startDate)} ~ {formatDate(p.endDate)}</span>
                      )}
                      {p.location && <span>📍 {p.location}</span>}
                    </div>
                    {/* 信息行 2: 学员 · 费用 */}
                    <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--ink-400)' }}>
                      <span>👥 {p.enrolledCount || 0}/{p.maxStudents || '不限'}人</span>
                      <FeeTag label="培训费" amount={p.tuitionFee} />
                      <FeeTag label="考试费" amount={p.examFee} />
                      <FeeTag label="证书费" amount={p.certFee} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full ml-3" style={{
                    background: `${STATUS_COLORS[p.status] || '#888'}18`,
                    color: STATUS_COLORS[p.status] || '#888',
                  }}>{STATUS_NAMES[p.status] || p.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => load(page - 1)}
                className="btn btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>
                ◀ 上一页
              </button>
              <span className="text-sm" style={{ color: 'var(--ink-400)' }}>
                第 {page}/{totalPages} 页 · 共 {total} 条
              </span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)}
                className="btn btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>
                下一页 ▶
              </button>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
