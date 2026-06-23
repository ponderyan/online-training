'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function CreateExam() {
  const router = useRouter();
  const [papers, setPapers] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [paperId, setPaperId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [programId, setProgramId] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [propositionById, setPropositionById] = useState('');
  const [lecturers, setLecturers] = useState<any[]>([]);

  useEffect(() => {
    api.papers.list(1).then(r => setPapers(r.items || [])).catch(() => {});
    api.trainingPrograms.list({ page: '1', pageSize: '100' }).then(r => setPrograms(r.items || [])).catch(() => {});
    api.students.list({ pageSize: '100', allRoles: 'true' }).then(r => setLecturers(r.items?.filter((u: any) => u.role === 'LECTURER' || u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN') || [])).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title || !paperId || !startTime) { setError('请填写必填项'); return; }
    setLoading(true); setError('');
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const exam = await api.exams.create({
        title, paperId: parseInt(paperId), createdBy: user.id || 1,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        durationMinutes, shuffleQuestions,
        programId: programId ? parseInt(programId) : undefined,
        passingScore: passingScore ? parseFloat(passingScore) : undefined,
      });
      router.push(`/exams/${exam.id}`);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">📋 创建考试场次</h1>
        <p className="page-subtitle mb-6">选择一个试卷，设置考试时间和规则</p>
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试名称 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>选择试卷 *</label>
              <select value={paperId} onChange={e => setPaperId(e.target.value)} className="input select">
                <option value="">— 请选择 —</option>
                {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>关联培训班</label>
              <select value={programId} onChange={e => setProgramId(e.target.value)} className="input select">
                <option value="">— 不关联 —</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>开考时间 *</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>结束时间</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>时长（分钟）</label>
              <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="input" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>合格线（分）</label>
              <input type="number" value={passingScore} onChange={e => setPassingScore(e.target.value)} className="input" placeholder="默认60%" min={0} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>命题人</label>
              <select value={propositionById} onChange={e => setPropositionById(e.target.value)} className="input select">
                <option value="">— 未指定 —</option>
                {lecturers.map((l: any) => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="shuffle" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} className="accent-[#e87a30]" />
            <label htmlFor="shuffle" className="text-xs" style={{ color: 'var(--ink-500)' }}>题目乱序</label>
          </div>
          {error && <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>⚠ {error}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={loading} className="btn btn-fox btn-sm">{loading ? '创建中…' : '创建考试'}</button>
            <button onClick={() => router.push('/exams')} className="btn btn-outline btn-sm">取消</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
