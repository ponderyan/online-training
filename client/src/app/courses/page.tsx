'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_NAMES: Record<string, string> = { ACTIVE: '启用', INACTIVE: '停用' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: '#00897b', INACTIVE: '#8b8174' };
const TYPE_NAMES: Record<string, string> = { STANDARD: '标准课', CUSTOM: '定制课' };
const TYPE_COLORS: Record<string, string> = { STANDARD: '#00897b', CUSTOM: '#1565c0' };

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = async (p: number = page) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (keyword) params.keyword = keyword;
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      const data = await api.courses.list(params);
      setCourses(data.items || []);
      setTotal(data.total || 0);
      setPage((data as any).page || 1);
      setTotalPages((data as any).totalPages || 1);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    const timer = setTimeout(() => { load(1); }, 400);
    return () => clearTimeout(timer);
  }, [keyword, filterStatus, filterType]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定停用该课程吗？')) return;
    try { await api.courses.delete(id); load(); } catch (e: any) { alert('操作失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">📚 课程管理</h1>
          <p className="page-subtitle">
            共 {total} 门课程{totalPages > 1 && <span className="ml-2 text-xs opacity-50">第 {page}/{totalPages} 页</span>}
          </p>
        </div>
        <button onClick={() => router.push('/courses/new')} className="btn btn-fox btn-sm">➕ 新建课程</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="🔍 搜索课程名称…" className="input" style={{ maxWidth: 320 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input select" style={{ maxWidth: 110 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="input select" style={{ maxWidth: 110 }}>
          <option value="">全部类型</option>
          {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : courses.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>
          <p className="text-4xl mb-4">📚</p>
          <p>暂无课程</p>
          <button onClick={() => router.push('/courses/new')} className="btn btn-fox btn-sm mt-4">创建第一门课程</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="list-table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>类型</th>
                  <th>编号</th>
                  <th>学时</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th style={{ width: 110 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c: any) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <button onClick={() => router.push(`/courses/${c.id}`)}
                        className="bg-transparent border-none cursor-pointer font-medium text-left transition-all"
                        style={{ color: 'var(--fox)' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        title="点击查看课程详情">
                        {c.name}
                      </button>
                    </td>
                    <td>
                      <span className="tag" style={{
                        background: `${TYPE_COLORS[c.type] || '#888'}18`,
                        color: TYPE_COLORS[c.type] || '#888', fontSize: '11px',
                      }}>
                        {TYPE_NAMES[c.type] || c.type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-400)' }} className="font-mono text-xs">{c.code || '—'}</td>
                    <td>{c.hours ? `${c.hours} 学时` : '—'}</td>
                    <td className="max-w-[240px] truncate text-xs" style={{ color: 'var(--ink-400)' }}>
                      {c.description || '—'}
                    </td>
                    <td>
                      <span className="tag" style={{
                        background: `${STATUS_COLORS[c.status] || '#888'}18`,
                        color: STATUS_COLORS[c.status] || '#888',
                      }}>
                        {STATUS_NAMES[c.status] || c.status}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/courses/${c.id}/edit`)}
                          className="text-xs bg-transparent border-none cursor-pointer"
                          style={{ color: 'var(--fox)' }}>编辑</button>
                        <button onClick={() => handleDelete(c.id)}
                          className="text-xs bg-transparent border-none cursor-pointer"
                          style={{ color: '#e53935' }}>停用</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => load(page - 1)} disabled={page <= 1}
            className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>‹ 上一页</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="mx-1 text-xs" style={{ color: 'var(--ink-300)' }}>…</span>}
                <button onClick={() => load(p)}
                  className={`btn btn-xs ${p === page ? 'btn-fox' : 'btn-ghost'}`}>{p}</button>
              </span>
            ))}
          <button onClick={() => load(page + 1)} disabled={page >= totalPages}
            className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>下一页 ›</button>
        </div>
      )}
    </AppLayout>
  );
}
