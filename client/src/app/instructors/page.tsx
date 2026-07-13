'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonTable } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

const LEVEL_NAMES: Record<string, string> = { JUNIOR: '初级', MIDDLE: '中级', SENIOR: '高级', EXPERT: '专家' };
const STATUS_NAMES: Record<string, string> = { ACTIVE: '正常', INACTIVE: '停用', SUSPENDED: '挂起' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: '#00897b', INACTIVE: '#8b8174', SUSPENDED: '#e87a30' };
const TYPE_NAMES: Record<string, string> = { INTERNAL: '内部讲师', EXTERNAL: '外聘讲师' };
const TYPE_COLORS: Record<string, string> = { INTERNAL: '#1565c0', EXTERNAL: '#e87a30' };

export default function InstructorsPage() {
  const router = useRouter();
  const toast = useToast();
  const [instructors, setInstructors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterWorkUnit, setFilterWorkUnit] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: '1', pageSize: '50' };
      if (keyword) params.keyword = keyword;
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (filterWorkUnit) params.workUnit = filterWorkUnit;
      const data = await api.instructors.list(params);
      setInstructors(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || '加载讲师列表失败');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定停用该讲师吗？')) return;
    try { await api.instructors.delete(id); toast.success('讲师已停用'); load(); } catch (e: any) { toast.error('操作失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">👨‍🏫 讲师管理</h1>
          <p className="page-subtitle">共 {total} 名讲师</p>
        </div>
        <button onClick={() => router.push('/instructors/new')} className="btn btn-fox btn-sm">➕ 新建讲师</button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="🔍 搜索讲师姓名…"
          className="input" style={{ maxWidth: 200 }} onKeyDown={e => e.key === 'Enter' && load()} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(); }} className="input select" style={{ maxWidth: 120 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); load(); }} className="input select" style={{ maxWidth: 130 }}>
          <option value="">全部类型</option>
          <option value="INTERNAL">内部讲师</option>
          <option value="EXTERNAL">外聘讲师</option>
        </select>
        <input value={filterWorkUnit} onChange={e => setFilterWorkUnit(e.target.value)} placeholder="工作单位…"
          className="input" style={{ maxWidth: 160 }} onKeyDown={e => e.key === 'Enter' && load()} />
        <button onClick={load} className="btn btn-ghost btn-xs">🔍 筛选</button>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonTable rows={6} cols={6} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : instructors.length === 0 ? (
        <div className="card"><EmptyState icon="👨‍🏫" title="暂无讲师" description="添加讲师后，可分派阅卷和授课" /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>姓名</th>
                <th>工作单位</th>
                <th>类型</th>
                <th>职称</th>
                <th>级别</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((inst: any) => (
                <tr key={inst.id}>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{inst.instructorNo || '—'}</td>
                  <td>
                    <span onClick={() => router.push(`/instructors/${inst.id}`)}
                      className="font-medium cursor-pointer hover:underline" style={{ color: 'var(--fox)' }}>
                      {inst.realName}
                    </span>
                  </td>
                  <td style={{ color: 'var(--ink-400)' }}>{inst.workUnit || '—'}</td>
                  <td>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${TYPE_COLORS[inst.type] || '#888'}18`, color: TYPE_COLORS[inst.type] || '#888' }}>
                      {TYPE_NAMES[inst.type] || inst.type}
                    </span>
                  </td>
                  <td>{inst.title || '—'}</td>
                  <td><span className="tag tag-cyan">{LEVEL_NAMES[inst.level] || inst.level}</span></td>
                  <td><span className="tag" style={{ background: `${STATUS_COLORS[inst.status] || '#888'}18`, color: STATUS_COLORS[inst.status] || '#888' }}>{STATUS_NAMES[inst.status] || inst.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => router.push(`/instructors/${inst.id}`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>查看</button>
                      <button onClick={() => router.push(`/instructors/${inst.id}/edit`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>编辑</button>
                      <button onClick={() => handleDelete(inst.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>停用</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
