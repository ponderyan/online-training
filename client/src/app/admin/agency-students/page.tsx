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
                          <td><button onClick={() => router.push(`/students/${s.id}`)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>详情</button></td>
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
    </AppLayout>
  );
}
