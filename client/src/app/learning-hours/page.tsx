'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function LearningHoursPage() {
  const toast = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 学时证明
  const [certificates, setCertificates] = useState<any[]>([]);
  const [applyModal, setApplyModal] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setError(null);
    Promise.all([
      api.learningHours.list(),
      api.learningHours.stats(),
      api.learningHourCertificates.my().catch(() => []),
    ]).then(([recordsData, statsData, certs]) => {
      setRecords(recordsData.items || []);
      setStats(statsData);
      setCertificates(certs || []);
    }).catch(e => setError(e.message || '加载学时数据失败'))
    .finally(() => setLoading(false));
  }, []);

  const openApplyModal = async () => {
    setApplyModal(true);
    setSelectedProgramId(null);
    setPreview(null);
    // 从 stats 直接提取有学时的培训班，无需单独调 program API
    const availablePrograms = (stats?.programStats || []).map((ps: any) => ({
      id: ps.programId,
      name: ps.programName,
      hours: ps.hours,
    }));
    setPrograms(availablePrograms);
  };

  const handleProgramSelect = async (programId: number | null) => {
    setSelectedProgramId(programId);
    if (!programId) { setPreview(null); return; }
    try {
      const p = await api.learningHourCertificates.preview(programId);
      setPreview(p);
    } catch { setPreview(null); }
  };

  const handleApply = async () => {
    if (!selectedProgramId) return;
    setApplying(true);
    try {
      await api.learningHourCertificates.apply(selectedProgramId);
      setApplyModal(false);
      setSelectedProgramId(null);
      setPreview(null);
      const certs = await api.learningHourCertificates.my().catch(() => []);
      setCertificates(certs || []);
      toast.success('学时证明申请已提交');
    } catch (e: any) {
      toast.error('申请失败：' + e.message);
    }
    setApplying(false);
  };

  const sourceLabel = (source: string) => {
    if (source === 'VIDEO') return { icon: '📺', text: '视频', color: '#00897b', bg: '#00897b18' };
    return { icon: '✏️', text: '申报', color: '#e87a30', bg: '#e87a3018' };
  };

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="text-xs" style={{ color: '#2e7d32' }}>✅ 已审核</span>;
    if (status === 'REJECTED') return <span className="text-xs" style={{ color: '#ef4444' }}>❌ 已驳回</span>;
    return <span className="text-xs" style={{ color: '#e87a30' }}>⏳ 待审核</span>;
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📊 我的学时</h1>
        <p className="page-subtitle">查看学习记录和学时统计</p>
      </div>

      {/* 学时证明 */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📜</span>
          <div>
            <div className="text-sm font-semibold">学时证明</div>
            <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
              {certificates.length > 0 ? `已有 ${certificates.length} 份证明` : '尚未申请'}
            </div>
          </div>
        </div>
        <button onClick={openApplyModal} className="btn btn-fox btn-sm">📜 申请学时证明</button>
      </div>

      {loading ? (
        <SkeletonCardGrid count={4} />
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => window.location.reload()} /></div>
      ) : (
        <>
          {stats && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{stats.totalHours}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>总学时（小时）</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: '#00897b' }}>{stats.completedVideos}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>已完成视频</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: '#1565c0' }}>{stats.programStats?.length || 0}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>关联培训班</div>
                </div>
              </div>
              {stats.typeStats?.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {stats.typeStats.map((ts: any) => (
                    <div key={ts.typeCode} className="card p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{ts.hours}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{ts.typeName}（小时）</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {stats?.programStats?.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>培训班汇总</div>
              <table className="list-table">
                <thead><tr><th>培训班</th><th>学时</th></tr></thead>
                <tbody>
                  {stats.programStats.map((ps: any) => (
                    <tr key={ps.programId}>
                      <td className="font-medium">{ps.programName}</td>
                      <td>{ps.hours} 小时</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 学时证明列表 */}
          {certificates.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>学时证明</div>
              <table className="list-table">
                <thead><tr><th>证明编号</th><th>培训班</th><th>总学时</th><th>状态</th><th>申请时间</th><th>操作</th></tr></thead>
                <tbody>
                  {certificates.map((c: any) => {
                    const statusStyle = c.approvalStatus === 'APPROVED' || c.approvalStatus === 'AUTO_APPROVED' ? { color: '#2e7d32', bg: '#2e7d3218' }
                      : c.approvalStatus === 'REJECTED' ? { color: '#ef4444', bg: '#ef444418' }
                      : { color: '#e87a30', bg: '#e87a3018' };
                    return (
                      <tr key={c.id}>
                        <td className="font-mono text-xs">{c.certificateNo || '—'}</td>
                        <td className="text-xs">{c.programName || '—'}</td>
                        <td className="text-sm font-medium">{c.totalHours} 小时</td>
                        <td>
                          <span className="tag" style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: '10px' }}>
                            {c.approvalStatus === 'APPROVED' || c.approvalStatus === 'AUTO_APPROVED' ? '✅ 已通过'
                              : c.approvalStatus === 'REJECTED' ? '❌ 已驳回'
                              : '⏳ 审批中'}
                          </span>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                          {c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('zh-CN') : '—'}
                        </td>
                        <td>
                          {(c.approvalStatus === 'APPROVED' || c.approvalStatus === 'AUTO_APPROVED') && (
                            <button onClick={() => {
                              const token = localStorage.getItem('token');
                              fetch(`/api/learning-hour-certificates/${c.id}/pdf`, {
                                headers: { Authorization: `Bearer ${token}` },
                              }).then(r => r.blob()).then(blob => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url;
                                a.download = `learning-hour-certificate-${c.id}.pdf`;
                                a.click(); URL.revokeObjectURL(url);
                              }).catch(() => toast.error('下载失败'));
                            }}
                              className="text-xs bg-transparent border-none cursor-pointer"
                              style={{ color: 'var(--fox)' }}>📥 下载</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>学习记录</div>
            {records.length === 0 ? (
              <EmptyState icon="🕐" title="暂无学习记录" description="观看视频或申报学时后，记录会出现在这里" size="small" />
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>来源</th><th>内容</th><th>培训班</th><th>学时类型</th><th>学时</th><th>状态</th><th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => {
                    const sl = sourceLabel(r.source);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="tag" style={{ background: sl.bg, color: sl.color, fontSize: '11px' }}>
                            {sl.icon} {sl.text}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--ink-600)' }}>
                          {r.source === 'VIDEO' ? (r.videoName || '视频学习') : (r.note || '人工申报')}
                        </td>
                        <td className="text-xs">{r.program?.name || '—'}</td>
                        <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{r.type?.name || '—'}</td>
                        <td>{r.hours} 小时</td>
                        <td>{statusBadge(r.status)}</td>
                        <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                          {new Date(r.recordedAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* 申请学时证明弹窗 */}
      {applyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setApplyModal(false); }}>
          <div className="rounded-2xl w-full max-w-md p-6" style={{ background: 'white' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">📜 申请学时证明</h3>

            <div className="mb-4">
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--ink-400)' }}>选择培训班</label>
              <select
                value={selectedProgramId || ''}
                onChange={e => handleProgramSelect(e.target.value ? parseInt(e.target.value) : null)}
                className="input select w-full text-sm">
                <option value="">请选择培训班…</option>
                {programs.map((p: any) => {
                  const alreadyHasCert = certificates.some(c => c.programId === p.id && !c.isRevoked);
                  return (
                    <option key={p.id} value={p.id} disabled={alreadyHasCert}>
                      {p.name} ({p.hours}h){alreadyHasCert ? ' — 已申请' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {preview && (
              <div className="card p-4 mb-4 space-y-2" style={{ background: '#faf8f5' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--ink-400)' }}>培训班</span>
                  <span className="font-medium">{preview.programName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--ink-400)' }}>累计学时</span>
                  <span className="font-medium" style={{ color: 'var(--fox)' }}>{preview.totalHours} 小时</span>
                </div>
                {preview.hoursDetail?.length > 0 && (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--ink-200)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--ink-400)' }}>学时明细</div>
                    {preview.hoursDetail.map((d: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span>{d.typeName || d.source}</span>
                        <span>{d.hours} 小时</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setApplyModal(false)} className="btn btn-outline btn-sm flex-1">取消</button>
              <button onClick={handleApply} disabled={!selectedProgramId || applying}
                className="btn btn-fox btn-sm flex-1">
                {applying ? '申请中…' : '确认申请'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
