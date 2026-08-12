'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待审批', color: 'var(--warning)' },
  APPROVED: { text: '已批准', color: 'var(--cyan)' },
  REJECTED: { text: '已驳回', color: 'var(--verm)' },
};

export default function CertificateApplications() {
  const router = useRouter();
  const toast = useToast();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const load = () => {
    setLoading(true);
    api.certificateApplications.list({ status: statusFilter || '', page: '1', limit: '50' })
      .then(r => setApps(r.items || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter]);

  const handleApprove = async (id: number) => {
    if (!confirm('确认批准此申请？')) return;
    try { await api.certificateApplications.approve(id, user.id || 1); load(); }
    catch (e: any) { toast.error('操作失败：' + e.message); }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确认批量批准 ${selectedIds.length} 个申请？`)) return;
    try { await api.certificateApplications.batchApprove(selectedIds, user.id || 1); setSelectedIds([]); load(); }
    catch (e: any) { toast.error('操作失败：' + e.message); }
  };

  const handleReject = async () => {
    if (!rejectReason || !rejectId) return;
    try { await api.certificateApplications.reject(rejectId, rejectReason, user.id || 1); setRejectId(null); setRejectReason(''); load(); }
    catch (e: any) { toast.error('操作失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">证书申请审批</h1>
          <p className="page-subtitle">审核通过后自动生成证书</p>
        </div>
        {selectedIds.length > 0 && (
          <button onClick={handleBatchApprove} className="btn btn-fox btn-sm">
            ✅ 批量批准（{selectedIds.length}）
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[['PENDING', '待审批'], ['APPROVED', '已批准'], ['REJECTED', '已驳回'], ['', '全部']].map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setSelectedIds([]); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: statusFilter === v ? 'var(--fox)' : 'var(--paper-dark)',
              color: statusFilter === v ? '#fff' : 'var(--ink-400)',
            }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载… 🦊</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto">
            <table className="list-table">
            <thead>
              <tr>
                {statusFilter === 'PENDING' && <th style={{ width: 40 }}></th>}
                <th>学员</th><th>培训项目</th><th>考试</th><th>成绩</th><th>违规</th><th>状态</th><th>申请时间</th>
                {statusFilter === 'PENDING' && <th style={{ width: 150 }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {apps.map((a: any) => (
                <tr key={a.id}>
                  {statusFilter === 'PENDING' && (
                    <td><input type="checkbox" checked={selectedIds.includes(a.id)}
                      onChange={e => { if (e.target.checked) setSelectedIds([...selectedIds, a.id]); else setSelectedIds(selectedIds.filter(id => id !== a.id)); }}
                      className="accent-[var(--fox)]" /></td>
                  )}
                  <td className="font-medium">
                    {a.student?.displayName || '—'}
                    {a.student?.organization && <div className="text-[10px] text-[var(--ink-300)] font-normal">{a.student.organization}</div>}
                  </td>
                  <td className="text-[var(--ink-400)] text-xs">{a.examSession?.exam?.program?.name || a.examSession?.exam?.program?.courseName || '—'}</td>
                  <td className="text-[var(--ink-400)] text-xs">{a.examSession?.exam?.title || '—'}</td>
                  <td className="text-xs">
                    {a.examSession?.finalScore != null ? (
                      <span className="font-medium" style={{ color: a.examSession.isPassed ? 'var(--sage)' : 'var(--verm)' }}>
                        {a.examSession.finalScore}<span className="text-[var(--ink-300)] font-normal">/{a.examSession.totalScore ?? '—'}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--ink-300)]">成绩未发布</span>
                    )}
                  </td>
                  <td className="text-xs">
                    {a.examSession && a.examSession.suspicionLevel > 0 ? (
                      <span className="tag" style={{ background: 'rgba(251,191,36,0.12)', color: (a.examSession.suspicionLevel ?? 0) >= 3 ? 'var(--verm)' : 'var(--warning)', border: '1px solid currentColor' }}>
                        🔄 切屏 {a.examSession.suspicionLevel}
                      </span>
                    ) : (
                      <span className="text-[var(--ink-300)]">无</span>
                    )}
                  </td>
                  <td>
                    <span className="tag" style={{ background: STATUS_LABEL[a.status]?.color + '18', color: STATUS_LABEL[a.status]?.color, border: '1px solid ' + (STATUS_LABEL[a.status]?.color + '30') }}>
                      {STATUS_LABEL[a.status]?.text || a.status}
                    </span>
                  </td>
                  <td className="text-[var(--ink-300)] text-xs">{a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('zh-CN') : '—'}</td>
                  {statusFilter === 'PENDING' && (
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setDetailId(a.id)} className="btn btn-ghost btn-xs text-[var(--fox)]">详情</button>
                        <button onClick={() => handleApprove(a.id)} className="btn btn-ghost btn-xs text-[var(--cyan)]">批准</button>
                        <button onClick={() => setRejectId(a.id)} className="btn btn-ghost btn-xs text-[var(--verm)]">驳回</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={statusFilter === 'PENDING' ? 9 : 7} className="text-[var(--ink-300)] text-center py-8 text-xs">暂无申请</td></tr>
              )}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      )}

      {detailId != null && (() => {
        const d = apps.find(a => a.id === detailId);
        if (!d) return null;
        const sess = d.examSession;
        const exam = sess?.exam;
        const program = exam?.program;
        const violationList = Array.isArray(sess?.violationLog) ? sess.violationLog : [];
        return (
          <div className="modal-overlay" onClick={() => setDetailId(null)}>
            <div className="modal-card max-w-[520px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="font-serif font-bold text-sm">证书申请详情</h3>
                <button onClick={() => setDetailId(null)} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]">✕</button>
              </div>
              <div className="modal-body space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                <section>
                  <h4 className="font-semibold text-[var(--fox)] mb-2">👤 学员</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-[var(--ink-300)] block mb-1">姓名</span><span className="font-medium">{d.student?.displayName || '—'}</span></div>
                    <div><span className="text-[var(--ink-300)] block mb-1">机构</span><span>{d.student?.organization || '—'}</span></div>
                  </div>
                </section>
                <section>
                  <h4 className="font-semibold text-[var(--fox)] mb-2">🎓 培训与考试</h4>
                  <div className="space-y-2">
                    <div><span className="text-[var(--ink-300)] block mb-1">培训项目</span><span className="font-medium">{program?.name || program?.courseName || '—'}</span></div>
                    <div><span className="text-[var(--ink-300)] block mb-1">考试名称</span><span>{exam?.title || '—'}</span></div>
                    <div><span className="text-[var(--ink-300)] block mb-1">及格线</span><span className="font-medium">{exam?.passingScore != null ? exam.passingScore + ' 分' : '—'}</span></div>
                  </div>
                </section>
                <section>
                  <h4 className="font-semibold text-[var(--fox)] mb-2">📊 成绩</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[var(--ink-300)] block mb-1">最终成绩</span>
                      <span className="font-medium" style={{ color: sess?.isPassed ? 'var(--sage)' : sess?.finalScore != null ? 'var(--verm)' : 'var(--ink-400)' }}>
                        {sess?.finalScore != null ? `${sess.finalScore}/${sess.totalScore ?? '—'}` : '成绩未发布'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--ink-300)] block mb-1">是否达标</span>
                      {sess?.isPassed ? (
                        <span className="tag" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--sage)', border: '1px solid currentColor' }}>✅ 通过</span>
                      ) : (
                        <span className="tag" style={{ background: 'rgba(225,29,72,0.10)', color: 'var(--verm)', border: '1px solid currentColor' }}>未通过</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[var(--ink-300)]">成绩状态：{sess?.scoringStatus || '—'}</div>
                </section>
                <section>
                  <h4 className="font-semibold text-[var(--fox)] mb-2">🔄 违规记录</h4>
                  {(sess?.suspicionLevel ?? 0) > 0 ? (
                    <div>
                      <span className="tag" style={{ background: 'rgba(251,191,36,0.12)', color: (sess.suspicionLevel ?? 0) >= 3 ? 'var(--verm)' : 'var(--warning)', border: '1px solid currentColor' }}>
                        🔄 切屏 {sess.suspicionLevel} 次
                      </span>
                      {violationList.length > 0 && (
                        <div className="mt-2 space-y-1 text-[var(--ink-300)]">
                          {violationList.slice(-5).reverse().map((v: any, i: number) => {
                            const t = v?.timestamp || v?.time;
                            return (
                              <div key={i} className="flex justify-between">
                                <span>{v?.action === 'tab_switch' ? '切屏离开页面' : (v?.action || '违规')}</span>
                                <span>{t ? new Date(t).toLocaleTimeString('zh-CN') : '—'}</span>
                              </div>
                            );
                          })}
                          {violationList.length > 5 && <div className="text-[var(--ink-400)]">… 共 {violationList.length} 条</div>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[var(--ink-300)]">无违规记录</span>
                  )}
                </section>
                <section>
                  <h4 className="font-semibold text-[var(--fox)] mb-2">📝 申请信息</h4>
                  <div className="space-y-2">
                    <div><span className="text-[var(--ink-300)] block mb-1">申请备注</span><span className="text-[var(--ink-400)]">{d.applyNote || '—'}</span></div>
                    <div><span className="text-[var(--ink-300)] block mb-1">申请时间</span><span className="text-[var(--ink-400)]">{d.appliedAt ? new Date(d.appliedAt).toLocaleString('zh-CN') : '—'}</span></div>
                  </div>
                </section>
              </div>
              <div className="modal-footer">
                <button onClick={() => setDetailId(null)} className="btn btn-ghost btn-sm">关闭</button>
                {d.status === 'PENDING' && (
                  <>
                    <button onClick={() => { setDetailId(null); handleApprove(d.id); }} className="btn btn-sm bg-[var(--fox)]" style={{ color: 'white' }}>✅ 批准并发证</button>
                    <button onClick={() => { setDetailId(null); setRejectId(d.id); }} className="btn btn-sm bg-[var(--verm)]" style={{ color: 'white' }}>驳回</button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {rejectId && (
        <div className="modal-overlay" onClick={() => setRejectId(null)}>
          <div className="modal-card max-w-[400px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">驳回证书申请</h3>
              <button onClick={() => setRejectId(null)} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
            </div>
            <div className="modal-body space-y-3">
              <label className="text-[var(--ink-400)] block text-xs">驳回原因 *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="如：成绩未达标、缺少必要材料" className="input textarea" rows={3} />
            </div>
            <div className="modal-footer">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleReject} disabled={!rejectReason}
                className="btn btn-sm bg-[var(--verm)]" style={{  color: 'white', opacity: !rejectReason ? 0.5 : 1 }}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
