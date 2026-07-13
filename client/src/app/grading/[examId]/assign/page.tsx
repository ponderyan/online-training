'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function AssignPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const examId = parseInt(params.examId as string);

  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [paperQuestions, setPaperQuestions] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [graderId, setGraderId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignSummary, setAssignSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [e, stuRes, aRes, uRes] = await Promise.all([
        api.exams.get(examId),
        fetch(`/api/exams/${examId}/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/grading-assignments/${examId}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.students.list({ pageSize: '100', allRoles: 'true' }),
      ]);
      setExam(e);

      const allStudents = await stuRes.json();
      const submitted = allStudents?.filter((s: any) => s.status === 'SUBMITTED') || [];
      setStudents(submitted);

      // 主观题列表 — 从 exam.paper.questions 提取
      const subjectiveTypes = ['SHORT_ANSWER', 'CASE_STUDY'];
      const subjPqs = (e?.paper?.questions || []).filter((pq: any) => subjectiveTypes.includes(pq.question?.type));
      setPaperQuestions(subjPqs);

      const aData = await aRes.json();
      const aList = Array.isArray(aData) ? aData : aData?.assignments || [];
      setAssignments(aList);
      setAssignSummary(aData?.summary || null);

      setUsers(uRes.items || []);
    } catch (e: any) { console.error('加载数据失败:', e); toast.error('加载数据失败：' + (e.message || '未知错误')); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAssign = async () => {
    if (!graderId) { toast.warning('请选择阅卷员'); return; }
    if (selectedStudentIds.length === 0 && selectedQuestionIds.length === 0) {
      toast.warning('请至少选择学员或题型'); return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading-assignments/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          graderId: parseInt(graderId),
          sessionIds: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
          paperQuestionIds: selectedQuestionIds.length > 0 ? selectedQuestionIds : undefined,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || '分配失败，请稍后重试');
        return;
      }
      setGraderId('');
      setSelectedStudentIds([]);
      setSelectedQuestionIds([]);
      load();
    } catch (e: any) { toast.error('分配失败：' + e.message); }
  };

  const handleClearGrader = async (graderId: number) => {
    if (!confirm('确认清除该阅卷员的本场考试全部分派？')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-assignments/${examId}/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ graderId }),
      });
      load();
    } catch (e: any) { toast.error('清除失败：' + e.message); }
  };

  const handleRemove = async (assignmentId: number) => {
    if (!confirm('确认移除该指派？')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-assignments/${examId}/${assignmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <button onClick={() => router.push(`/grading/${examId}`)} className="text-xs bg-transparent border-none cursor-pointer mb-2" style={{ color: 'var(--fox)' }}>← 返回阅卷</button>
        <h1 className="page-title">📋 阅卷指派 · {exam?.title || ''}</h1>
        <p className="page-subtitle">多选学员 + 多选题型，组合分派给阅卷员</p>
      </div>

      <div className="flex gap-4 mb-6">
        {/* 左栏：学员列表 */}
        <div className="flex-1 card overflow-hidden">
          <div className="px-4 py-3 text-xs font-medium flex items-center justify-between" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
            <span>学员（{students.length}）</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={selectedStudentIds.length === students.length && students.length > 0}
                onChange={e => setSelectedStudentIds(e.target.checked ? students.map((s: any) => s.student?.id).filter(Boolean) : [])}
                className="accent-[var(--fox)]" />
              <span className="text-[10px]">全选</span>
            </label>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {students.map((s: any) => (
              <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#fef3e7] transition-colors">
                <input type="checkbox" checked={selectedStudentIds.includes(s.student?.id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, s.student?.id]);
                    else setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.student?.id));
                  }}
                  className="accent-[var(--fox)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--ink-600)' }}>{s.student?.displayName || '未知'}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-300)' }}>得分：{s.finalScore ?? s.totalScore ?? '-'}</div>
                </div>
              </label>
            ))}
            {students.length === 0 && <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无已提交学员</div>}
          </div>
        </div>

        {/* 中栏：题型列表 */}
        <div className="w-64 card overflow-hidden">
          <div className="px-4 py-3 text-xs font-medium flex items-center justify-between" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
            <span>主观题型（{paperQuestions.length}）</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={selectedQuestionIds.length === paperQuestions.length && paperQuestions.length > 0}
                onChange={e => setSelectedQuestionIds(e.target.checked ? paperQuestions.map((pq: any) => pq.id) : [])}
                className="accent-[var(--fox)]" />
              <span className="text-[10px]">全选</span>
            </label>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {paperQuestions.map((pq: any) => {
              const typeName = pq.question?.type === 'SHORT_ANSWER' ? '简答' : '案例';
              return (
                <label key={pq.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#fef3e7] transition-colors">
                  <input type="checkbox" checked={selectedQuestionIds.includes(pq.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, pq.id]);
                      else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== pq.id));
                    }}
                    className="accent-[var(--fox)]" />
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>{typeName}</span>
                  <span className="text-sm truncate flex-1" style={{ color: 'var(--ink-600)' }}>{pq.question?.content || `题目 #${pq.id}`}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>{pq.score}分</span>
                </label>
              );
            })}
            {paperQuestions.length === 0 && <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>本场无主观题</div>}
          </div>
        </div>

        {/* 右栏：操作区 */}
        <div className="w-56 space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--ink-500)' }}>分配操作</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>选择阅卷员</label>
                <select value={graderId} onChange={e => setGraderId(e.target.value)} className="input select w-full">
                  <option value="">— 请选择 —</option>
                  {users.filter((u: any) => u.role === 'LECTURER' || u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN').map((u: any) => (
                    <option key={u.id} value={u.id}>{u.displayName}（{u.role}）</option>
                  ))}
                </select>
              </div>
              <button onClick={handleAssign} disabled={!graderId}
                className="btn btn-fox btn-sm w-full">{`📋 分配（${selectedStudentIds.length}人 × ${selectedQuestionIds.length || '全部'}题）`}</button>
              <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                {selectedStudentIds.length === 0 && selectedQuestionIds.length === 0
                  ? '至少选择学员或题型'
                  : `将生成 ${Math.max(selectedStudentIds.length, 1) * Math.max(selectedQuestionIds.length, 1)} 条分派记录`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 已有分派表格 */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 text-xs font-medium flex items-center justify-between" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
          <span>已有分派（{assignments.length} 条）</span>
          {assignSummary && (
            <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
              {assignSummary.totalGraders} 位阅卷员 · {assignSummary.totalStudents} 名学员
            </span>
          )}
        </div>
        <table className="list-table">
          <thead>
            <tr>
              <th>阅卷人</th>
              <th>学员</th>
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
                <td style={{ color: 'var(--ink-400)' }}>{a.session?.student?.displayName || '全部学员'}</td>
                <td style={{ color: 'var(--ink-400)' }}>{a.paperQuestionId ? `题目 #${a.paperQuestionId}` : '全部主观题'}</td>
                <td>
                  <span className={`tag ${a.status === 'COMPLETED' ? 'tag-cyan' : a.status === 'IN_PROGRESS' ? 'tag-gold' : 'tag-ink'}`}>
                    {a.status === 'COMPLETED' ? '已完成' : a.status === 'IN_PROGRESS' ? '阅卷中' : '待阅卷'}
                  </span>
                </td>
                <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(a.assignedAt).toLocaleDateString('zh-CN')}</td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => handleRemove(a.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>移除</button>
                  </div>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无分派</td></tr>
            )}
          </tbody>
        </table>
        {assignments.length > 0 && (
          <div className="px-4 py-3 flex gap-2 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            {[...new Set(assignments.map((a: any) => a.graderId))].map(gid => {
              const grader = assignments.find((a: any) => a.graderId === gid)?.grader;
              const count = assignments.filter((a: any) => a.graderId === gid).length;
              return (
                <button key={gid} onClick={() => handleClearGrader(gid)}
                  className="text-[10px] px-2 py-1 rounded" style={{ border: '1px solid var(--ink-200)', color: 'var(--verm)' }}>
                  清除{grader?.displayName || `#${gid}`}（{count}条）
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
