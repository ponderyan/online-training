'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = Number(params.id);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('exams');
  const [exams, setExams] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/students/${studentId}/profile`, { headers }).then(r => r.json()),
      fetch(`/api/students/${studentId}/exam-history?page=1&pageSize=50`, { headers }).then(r => r.json()),
      fetch(`/api/students/${studentId}/certificates`, { headers }).then(r => r.json()),
      fetch(`/api/students/${studentId}/fee-records`, { headers }).then(r => r.json()),
    ]).then(([p, e, c, f]) => {
      setProfile(p);
      setExams(e.items || []);
      setCertificates(Array.isArray(c) ? c : []);
      setFeeRecords(Array.isArray(f) ? f : []);
    }).catch(() => router.push('/students')).finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!profile) return null;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('zh-CN') : '—';

  return (
    <AppLayout>
      {/* Back button */}
      <div className="mb-4">
        <button onClick={() => router.push('/students')}
          className="text-xs bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--fox)' }}>← 返回学员列表</button>
      </div>

      {/* Profile card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
            {profile.displayName?.[0] || '🦊'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-bold text-lg">{profile.displayName}</h2>
              <span className="tag" style={{
                background: profile.role === 'STUDENT' ? 'transparent' : 'var(--fox-pale)',
                color: profile.role === 'STUDENT' ? 'var(--ink-400)' : 'var(--fox)',
                border: '1px solid ' + (profile.role === 'STUDENT' ? 'var(--ink-200)' : 'var(--fox)'),
              }}>
                {profile.role === 'STUDENT' ? '学员' : profile.role}
              </span>
              <span className={`tag ${profile.isActive ? 'tag-cyan' : 'tag-verm'}`}>
                {profile.isActive ? '正常' : '已停用'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--ink-400)' }}>
              <span>学号：{profile.studentNumber || '—'}</span>
              <span>用户名：{profile.username}</span>
              <span>手机：{profile.phone || '—'}</span>
              <span>邮箱：{profile.email || '—'}</span>
              <span>单位：{profile.organization || '—'}</span>
              <span>职务：{profile.title || '—'}</span>
              <span>性别：{profile.gender === 'M' ? '男' : profile.gender === 'F' ? '女' : '—'}</span>
              <span>来源：{profile.source || '—'}</span>
              <span>缴费：<span style={{ color: profile.feeStatus === 'PAID' ? 'var(--cyan)' : profile.feeStatus === 'UNPAID' ? 'var(--verm)' : 'var(--gold)' }}>
                {profile.feeStatus === 'PAID' ? '已缴' : profile.feeStatus === 'UNPAID' ? '未缴' : profile.feeStatus === 'PARTIAL' ? '部分' : '已退款'}
              </span></span>
              <span>班级：{profile.group?.name || '—'}</span>
              <span>注册：{fmtDate(profile.enrolledAt)}</span>
              <span>结业：{fmtDate(profile.graduatedAt)}</span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-4 flex-shrink-0">
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'var(--paper)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--fox)' }}>{profile.stats?.examCount || 0}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>考试</div>
            </div>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'var(--paper)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--cyan)' }}>{profile.stats?.passedCount || 0}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>通过</div>
            </div>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'var(--paper)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{profile.stats?.certCount || 0}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>证书</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {[
          { key: 'exams', label: '📚 考试记录' },
          { key: 'certificates', label: '🏅 证书' },
          { key: 'fees', label: '💰 缴费' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{
              background: activeTab === tab.key ? 'var(--paper)' : 'transparent',
              color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-400)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exam history tab */}
      {activeTab === 'exams' && (
        <div className="card p-0 overflow-hidden">
          {exams.length === 0 ? (
            <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无考试记录</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
                  <th className="text-left px-4 py-3 font-medium">考试</th>
                  <th className="text-left px-4 py-3 font-medium">得分</th>
                  <th className="text-left px-4 py-3 font-medium">结果</th>
                  <th className="text-left px-4 py-3 font-medium">提交时间</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                {exams.map((e: any) => (
                  <tr key={e.id} style={{ color: 'var(--ink-600)' }}>
                    <td className="px-4 py-3">{e.exam?.title || '—'}</td>
                    <td className="px-4 py-3">{e.finalScore ?? e.totalScore ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`tag ${e.isPassed ? 'tag-cyan' : 'tag-verm'}`}>
                        {e.isPassed ? '通过' : '未通过'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Certificates tab */}
      {activeTab === 'certificates' && (
        <div className="card p-0 overflow-hidden">
          {certificates.length === 0 ? (
            <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无证书</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
                  <th className="text-left px-4 py-3 font-medium">编号</th>
                  <th className="text-left px-4 py-3 font-medium">考试</th>
                  <th className="text-left px-4 py-3 font-medium">发证日期</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                {certificates.map((c: any) => (
                  <tr key={c.id} style={{ color: 'var(--ink-600)' }}>
                    <td className="px-4 py-3 font-mono text-xs">{c.certificateNo}</td>
                    <td className="px-4 py-3 text-xs">{c.courseName}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(c.issueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`tag ${c.isRevoked ? 'tag-verm' : 'tag-cyan'}`}>
                        {c.isRevoked ? '已撤销' : '有效'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Fee records tab */}
      {activeTab === 'fees' && (
        <div className="card p-0 overflow-hidden">
          {feeRecords.length === 0 ? (
            <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无缴费记录</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
                  <th className="text-left px-4 py-3 font-medium">类型</th>
                  <th className="text-left px-4 py-3 font-medium">金额</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">支付方式</th>
                  <th className="text-left px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                {feeRecords.map((f: any) => (
                  <tr key={f.id} style={{ color: 'var(--ink-600)' }}>
                    <td className="px-4 py-3 text-xs">{f.type === 'TRAINING_FEE' ? '培训费' : f.type === 'EXAM_FEE' ? '考试费' : '证书费'}</td>
                    <td className="px-4 py-3">{f.amount}元</td>
                    <td className="px-4 py-3">
                      <span className={`tag ${f.status === 'PAID' ? 'tag-cyan' : f.status === 'UNPAID' ? 'tag-verm' : 'tag-gold'}`}>
                        {f.status === 'PAID' ? '已缴' : f.status === 'UNPAID' ? '未缴' : f.status === 'REFUNDED' ? '已退款' : '部分'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{f.method || '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.paidAt ? new Date(f.paidAt).toLocaleString('zh-CN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppLayout>
  );
}
