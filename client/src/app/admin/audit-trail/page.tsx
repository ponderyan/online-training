'use client';

import { useEffect, useState } from 'react';
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

export default function AuditTrailPage() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Chain modal
  const [chainModal, setChainModal] = useState(false);
  const [chainData, setChainData] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: '1', pageSize: '50' };
      if (search) params.keyword = search;
      if (filterStatus) params.status = filterStatus;
      const data = await api.trainingPrograms.list(params);
      setPrograms(data.items || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [search, filterStatus]);

  const doSearch = () => { setSearch(searchInput); };

  const openChain = async (programId: number) => {
    setChainLoading(true);
    setChainModal(true);
    try {
      const data = await api.trainingPrograms.getAuditChain(programId);
      setChainData(data);
    } catch { setChainData(null); }
    setChainLoading(false);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🔍 全链审计</h1>
        <p className="page-subtitle">一站式查看培训班全链路：签到 → 备案 → 证书 → 追溯</p>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-5">
        <div className="flex gap-2">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="🔍 搜索培训班…" className="input" style={{ maxWidth: 240 }} />
          <button onClick={doSearch} className="btn btn-outline btn-sm">查询</button>
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}
          className="input select" style={{ maxWidth: 120 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : programs.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-4">🔍</p><p style={{ color: 'var(--ink-300)' }}>暂无培训班数据</p></div>
      ) : (
        <div className="grid gap-4">
          {programs.map(p => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base">{p.name}</span>
                    <span className="tag" style={{
                      background: `${STATUS_COLORS[p.status] || '#888'}18`,
                      color: STATUS_COLORS[p.status] || '#888',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                    }}>{STATUS_NAMES[p.status] || p.status}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                    课程：{p.courseName} · 时间：{p.startDate?.slice(0, 10)} ~ {p.endDate?.slice(0, 10)} · 报名：{p.enrolledCount || 0}人
                  </p>
                </div>
                <button onClick={() => openChain(p.id)} className="btn btn-outline btn-sm text-xs">🔍 查看完整追溯</button>
              </div>
              {/* Will load chain summary when opened */}
            </div>
          ))}
        </div>
      )}

      {/* Chain Modal */}
      {chainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setChainModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg">📋 全链追溯</h3>
              <button onClick={() => setChainModal(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>

            {chainLoading ? (
              <div className="py-16 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载追溯数据中… 🦊</div>
            ) : !chainData ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载失败</div>
            ) : (
              <div>
                {/* Program Summary */}
                {chainData.program && (
                  <div className="card p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{chainData.program.name}</span>
                      <span className="tag" style={{
                        background: `${STATUS_COLORS[chainData.program.status] || '#888'}18`,
                        color: STATUS_COLORS[chainData.program.status] || '#888',
                        fontSize: '10px',
                      }}>{STATUS_NAMES[chainData.program.status] || chainData.program.status}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                      {chainData.program.code} · {chainData.program.courseName}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div className="relative pl-8 mb-6">
                  <div className="absolute left-3.5 top-2 bottom-2 w-0.5" style={{ background: 'var(--ink-200)' }} />

                  {/* 1. Program created */}
                  {chainData.program && (
                    <div className="relative pb-6">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                        style={{ background: 'var(--paper)', borderColor: '#8b8174' }} />
                      <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                        {new Date(chainData.program.createdAt).toLocaleString('zh-CN')}
                      </div>
                      <div className="text-sm mt-0.5 font-medium">创建培训班</div>
                      <div className="text-xs" style={{ color: 'var(--ink-400)' }}>{chainData.program.name}</div>
                    </div>
                  )}

                  {/* 2. Attendance */}
                  {chainData.attendance && (
                    <div className="relative pb-6">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                        style={{ background: 'var(--paper)', borderColor: '#00897b' }} />
                      <div className="text-sm mt-0.5 font-medium">✅ 签到管理</div>
                      <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                        {chainData.evidences?.total || 0} 张签到表 · 平均出勤率 {chainData.attendance.avgRate}%
                        · {chainData.attendance.records.length} 名学员
                      </div>
                    </div>
                  )}

                  {/* 3. Filing */}
                  {chainData.filing ? (
                    <div className="relative pb-6">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                        style={{ background: 'var(--paper)', borderColor: chainData.filing.status === 'APPROVED' ? '#2e7d32' : '#e87a30' }} />
                      <div className="text-sm mt-0.5 font-medium">
                        🏢 备案
                        <span className="ml-2 tag" style={{
                          background: chainData.filing.status === 'APPROVED' ? '#2e7d3218' : '#e87a3018',
                          color: chainData.filing.status === 'APPROVED' ? '#2e7d32' : '#e87a30',
                          fontSize: '10px',
                        }}>
                          {chainData.filing.status === 'APPROVED' ? '已通过' : chainData.filing.status === 'PENDING' ? '待审核' : '已驳回'}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                        {chainData.filing.agencyName} · {chainData.filing.submittedAt ? new Date(chainData.filing.submittedAt).toLocaleString('zh-CN') : '—'}
                        {chainData.filing.reviewedAt && ` · 审核：${new Date(chainData.filing.reviewedAt).toLocaleString('zh-CN')}`}
                      </div>
                    </div>
                  ) : (
                    <div className="relative pb-6">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                        style={{ background: 'var(--paper)', borderColor: '#8b8174' }} />
                      <div className="text-sm mt-0.5 font-medium">🏢 备案</div>
                      <div className="text-xs" style={{ color: 'var(--ink-300)' }}>未提交</div>
                    </div>
                  )}

                  {/* 4. Certificates */}
                  {chainData.certificates && (
                    <div className="relative pb-6">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                        style={{ background: 'var(--paper)', borderColor: '#7b1fa2' }} />
                      <div className="text-sm mt-0.5 font-medium">🏅 证书</div>
                      <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                        已颁发 {chainData.certificates.issued} 张
                      </div>
                      {chainData.certificates.items?.length > 0 && (
                        <div className="mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
                          {chainData.certificates.items.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-2 mt-1">
                              <span>{c.studentName} — {c.certificateNo}</span>
                              {c.traces?.length > 0 && (
                                <span className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '9px' }}>
                                  {c.traces.length} 条追溯
                                </span>
                              )}
                              {c.status === 'REVOKED' && (
                                <span className="tag" style={{ background: '#e5393518', color: '#e53935', fontSize: '9px' }}>已撤销</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidence files list */}
                {chainData.evidences?.items?.length > 0 && (
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold mb-2">📎 证据文件清单</h4>
                    <div className="space-y-1">
                      {chainData.evidences.items.map((e: any) => (
                        <div key={e.id} className="text-xs flex items-center gap-2">
                          <span style={{ color: 'var(--ink-400)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</span>
                          <span style={{ color: 'var(--fox)' }}>{e.fileName}</span>
                          <span className="tag" style={{ background: '#8b817418', color: '#8b8174', fontSize: '9px' }}>
                            {e.evidenceType === 'ATTENDANCE_SHEET' ? '签到表' : e.evidenceType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
