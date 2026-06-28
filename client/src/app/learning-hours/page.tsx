'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function LearningHoursPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 申报模态框
  const [showModal, setShowModal] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [form, setForm] = useState({ programId: '', hours: '', source: 'OFFLINE', note: '' });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.learningHours.list(),
      api.learningHours.stats(),
    ]).then(([recordsData, statsData]) => {
      setRecords(recordsData.items || []);
      setStats(statsData);
    }).catch(() => {})
    .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openModal = async () => {
    setShowModal(true);
    setForm({ programId: '', hours: '', source: 'OFFLINE', note: '' });
    setEvidenceFile(null);
    try {
      const d = await api.programs.list({ pageSize: 200 } as any);
      setPrograms(d.items || []);
    } catch {}
  };

  const handleSubmit = async () => {
    const hours = parseFloat(form.hours);
    if (!hours || hours <= 0) { alert('请输入有效的学时数'); return; }
    setSubmitting(true);
    try {
      let evidenceUrl: string | undefined;
      if (evidenceFile) {
        const uploadRes = await api.learningHours.uploadEvidence(evidenceFile);
        evidenceUrl = uploadRes.url;
      }
      await api.learningHours.submit({
        programId: form.programId ? parseInt(form.programId) : undefined,
        hours,
        source: form.source,
        evidenceUrl,
        note: form.note || undefined,
      });
      setShowModal(false);
      load();
    } catch (e: any) { alert('提交失败：' + (e.message || '未知错误')); }
    setSubmitting(false);
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

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
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
          )}

          {/* Submit Button */}
          <div className="mb-4">
            <button onClick={openModal} className="btn btn-fox btn-sm">✏️ 申报学时</button>
          </div>

          {/* Program Stats */}
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

          {/* Record List */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>学习记录</div>
            {records.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无学习记录，完成视频学习或申报学时后自动记录</div>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>内容</th>
                    <th>培训班</th>
                    <th>学时</th>
                    <th>状态</th>
                    <th>时间</th>
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

      {/* Submit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-card max-w-md animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">✏️ 申报学时</h3>
              <button onClick={() => setShowModal(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>培训班</label>
                <select value={form.programId} onChange={e => setForm({...form, programId: e.target.value})} className="input select text-xs">
                  <option value="">不关联培训班</option>
                  {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>学时数 *</label>
                  <input type="number" min="0.5" step="0.5" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})}
                    className="input" placeholder="如 4" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>类型</label>
                  <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="input select text-xs">
                    <option value="OFFLINE">线下培训</option>
                    <option value="OFFLINE">其他</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>证明材料（可选）</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                  className="input text-xs" />
                {evidenceFile && <p className="text-xs mt-1" style={{ color: 'var(--fox)' }}>已选择：{evidenceFile.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>备注（可选）</label>
                <textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})}
                  className="input textarea text-xs" rows={2} placeholder="说明学时来源，如参加了什么培训" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn btn-fox btn-sm">
                {submitting ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
