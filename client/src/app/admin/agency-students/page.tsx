'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function AgencyStudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'students' | 'progress'>('students');

  // 学时申报
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [submitForm, setSubmitForm] = useState({ programId: '', hours: '', source: 'OFFLINE', note: '' });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const perms = JSON.parse(localStorage.getItem('userPermissions') || '{}');
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const merged = { ...u, ...perms };
      setUser(merged);

      // Load agency list
      const list = await api.enrollmentAgencies.list();
      const agencyList = list?.items || list || [];
      setAgencies(agencyList);
      if (agencyList.length > 0) {
        setSelectedAgencyId(agencyList[0].id);
        loadStudents(agencyList[0].id);
      }
    } catch {}
    setLoading(false);
  };

  const loadStudents = async (agencyId: number) => {
    setStudentsLoading(true);
    try {
      const data = await api.enrollmentAgencies.getStudents(agencyId);
      setStudents(data?.items || []);
    } catch {}
    setStudentsLoading(false);
  };

  const handleAgencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelectedAgencyId(id);
    loadStudents(id);
  };

  const selectedAgency = agencies.find(a => a.id === selectedAgencyId);

  const openSubmitModal = async (student: any) => {
    setSubmitTarget(student);
    setSubmitForm({ programId: '', hours: '', source: 'OFFLINE', note: '' });
    setEvidenceFile(null);
    setShowSubmitModal(true);
    try {
      const d = await api.programs.list({ pageSize: 200 } as any);
      setPrograms(d.items || []);
    } catch {}
  };

  const handleSubmitHours = async () => {
    const hours = parseFloat(submitForm.hours);
    if (!hours || hours <= 0 || !submitTarget) { alert('请输入有效的学时数'); return; }
    setSubmitting(true);
    try {
      let evidenceUrl: string | undefined;
      if (evidenceFile) {
        const uploadRes = await api.learningHours.uploadEvidence(evidenceFile);
        evidenceUrl = uploadRes.url;
      }
      await api.learningHours.submit({
        studentId: submitTarget.id,
        programId: submitForm.programId ? parseInt(submitForm.programId) : undefined,
        hours,
        source: submitForm.source,
        evidenceUrl,
        note: submitForm.note || undefined,
      });
      setShowSubmitModal(false);
      setSubmitTarget(null);
    } catch (e: any) { alert('提交失败：' + (e.message || '未知错误')); }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🏢 机构学员管理</h1>
        <p className="page-subtitle">管理招生机构名下的学员</p>
      </div>

      {/* Agency selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: 'var(--ink-400)' }}>选择机构</span>
        <select
          value={selectedAgencyId ?? ''}
          onChange={handleAgencyChange}
          className="input select text-xs"
          style={{ width: 260 }}
        >
          {agencies.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {selectedAgency && (
          <span className="text-[11px]" style={{ color: 'var(--ink-300)' }}>
            {selectedAgency.contactPerson && `${selectedAgency.contactPerson} / `}
            {selectedAgency.contactPhone}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div>
      ) : agencies.length === 0 ? (
        <div className="card text-center py-16" style={{ color: 'var(--ink-300)' }}>
          暂无招生机构数据，请先在「招生机构」页面添加机构
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setActiveTab('students')}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{ background: activeTab === 'students' ? 'var(--fox)' : 'var(--paper-dark)', color: activeTab === 'students' ? '#fff' : 'var(--ink-400)' }}>
              👥 我的学员
            </button>
            <button onClick={() => setActiveTab('progress')}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{ background: activeTab === 'progress' ? 'var(--fox)' : 'var(--paper-dark)', color: activeTab === 'progress' ? '#fff' : 'var(--ink-400)' }}>
              📊 学习进度
            </button>
          </div>

          {studentsLoading ? (
            <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div>
          ) : (
            <>
              {activeTab === 'students' && (
                <div className="card p-0 overflow-hidden">
                  <table className="list-table">
                    <thead><tr><th>姓名</th><th>用户名</th><th>手机号</th><th>邮箱</th><th>学号</th><th>操作</th></tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无学员</td></tr>
                      ) : students.map((s: any) => (
                        <tr key={s.id}>
                          <td className="font-medium">{s.displayName}</td>
                          <td className="text-xs">{s.username}</td>
                          <td className="text-xs">{s.phone || '—'}</td>
                          <td className="text-xs">{s.email || '—'}</td>
                          <td className="text-xs">{s.studentNumber || '—'}</td>
                          <td className="flex gap-1">
                            <button onClick={() => router.push(`/students/${s.id}`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>详情</button>
                            <button onClick={() => openSubmitModal(s)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e87a30' }}>申报学时</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'progress' && (
                <div className="card p-0 overflow-hidden">
                  <table className="list-table">
                    <thead><tr><th>姓名</th><th>学号</th><th>总学时</th><th>报名培训班</th><th>证书数</th></tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无数据</td></tr>
                      ) : students.map((s: any) => (
                        <tr key={s.id}>
                          <td className="font-medium">{s.displayName}</td>
                          <td className="text-xs">{s.studentNumber || '—'}</td>
                          <td>{s.totalHours || 0}</td>
                          <td className="text-xs">{s.enrollments || 0}</td>
                          <td className="text-xs">{s.certificates || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Submit Modal */}
      {showSubmitModal && submitTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSubmitModal(false); }}>
          <div className="modal-card max-w-md animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">✏️ 为 {submitTarget.displayName} 申报学时</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>培训班</label>
                <select value={submitForm.programId} onChange={e => setSubmitForm({...submitForm, programId: e.target.value})} className="input select text-xs">
                  <option value="">不关联培训班</option>
                  {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>学时数 *</label>
                  <input type="number" min="0.5" step="0.5" value={submitForm.hours} onChange={e => setSubmitForm({...submitForm, hours: e.target.value})}
                    className="input" placeholder="如 4" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>类型</label>
                  <select value={submitForm.source} onChange={e => setSubmitForm({...submitForm, source: e.target.value})} className="input select text-xs">
                    <option value="OFFLINE">线下培训</option>
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
                <textarea value={submitForm.note} onChange={e => setSubmitForm({...submitForm, note: e.target.value})}
                  className="input textarea text-xs" rows={2} placeholder="培训内容说明" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSubmitHours} disabled={submitting} className="btn btn-fox btn-sm">
                {submitting ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
