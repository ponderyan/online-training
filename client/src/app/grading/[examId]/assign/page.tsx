'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function AssignPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.examId as string);
  const [exam, setExam] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [graderId, setGraderId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([
        api.exams.get(examId),
        fetch(`/api/grading-assignments/${examId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
      ]);
      setExam(e);
      setAssignments(Array.isArray(a) ? a : []);
      // Load available users
      const u = await api.students.list({ pageSize: '100', allRoles: 'true' });
      setUsers(u.items || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!graderId) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-assignments/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ graderId: parseInt(graderId) }),
      });
      setGraderId('');
      load();
    } catch (e: any) { alert('添加失败：' + e.message); }
  };

  const handleRemove = async (assignmentId: number) => {
    if (!confirm('确认移除该指派？')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-assignments/${examId}/${assignmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e: any) { alert('删除失败：' + e.message); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <button onClick={() => router.push(`/grading/${examId}`)} className="text-xs bg-transparent border-none cursor-pointer mb-2" style={{ color: 'var(--fox)' }}>← 返回阅卷</button>
        <h1 className="page-title">📋 阅卷指派 · {exam?.title || ''}</h1>
        <p className="page-subtitle">管理阅卷人及其负责的题目</p>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink-700)' }}>添加阅卷人</h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>选择用户</label>
            <select value={graderId} onChange={e => setGraderId(e.target.value)} className="input select">
              <option value="">— 请选择 —</option>
              {users.filter((u: any) => u.role === 'LECTURER' || u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN').map((u: any) => (
                <option key={u.id} value={u.id}>{u.displayName}（{u.role}）</option>
              ))}
            </select>
          </div>
          <button onClick={handleAdd} disabled={!graderId} className="btn btn-fox btn-sm">添加</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="list-table">
          <thead>
            <tr>
              <th>阅卷人</th>
              <th>指派的题</th>
              <th>状态</th>
              <th>指派时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a: any) => (
              <tr key={a.id}>
                <td className="font-medium">{a.grader?.displayName || '—'}</td>
                <td style={{ color: 'var(--ink-400)' }}>{a.paperQuestionId ? `题目 #${a.paperQuestionId}` : '全部主观题'}</td>
                <td>
                  <span className={`tag ${a.status === 'COMPLETED' ? 'tag-cyan' : a.status === 'IN_PROGRESS' ? 'tag-gold' : 'tag-ink'}`}>
                    {a.status === 'COMPLETED' ? '已完成' : a.status === 'IN_PROGRESS' ? '阅卷中' : '待阅卷'}
                  </span>
                </td>
                <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(a.assignedAt).toLocaleDateString('zh-CN')}</td>
                <td><button onClick={() => handleRemove(a.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>移除</button></td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无指派</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
