'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function EvaluatePage() {
  const params = useParams();
  const router = useRouter();
  const [program, setProgram] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [instructorRatings, setInstructorRatings] = useState<Record<number, number>>({});
  const [form, setForm] = useState({
    contentRating: 0, instructorRating: 0, organizationRating: 0,
    overallRating: 0, comment: '', isAnonymous: false,
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) return;
    const parsed = JSON.parse(u);
    setUser(parsed);

    Promise.all([
      api.trainingPrograms.get(Number(params.id)).catch(() => null),
      parsed.role === 'STUDENT' ? api.evaluations.my(parsed.id).catch(() => []) : [],
      api.schedules.getByProgram(Number(params.id)).catch(() => []),
    ]).then(([p, myEvals, schedules]) => {
      setProgram(p);
      const uniqueInsts = Array.isArray(schedules)
        ? schedules.filter((s: any) => s.instructor)
            .map((s: any) => s.instructor)
            .filter((inst: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === inst.id) === i)
        : [];
      setInstructors(uniqueInsts);
      if (myEvals && Array.isArray(myEvals)) {
        const found = (myEvals as any[]).find((e: any) => e.programId === Number(params.id));
        setExisting(found || null);
      }
    }).finally(() => setLoading(false));
  }, []);

  const canEvaluate = program && ['IN_PROGRESS', 'COMPLETED', 'REVIEWING', 'CERTIFYING'].includes(program.status);

  const handleSubmit = async () => {
    const ratingKeys = Object.keys(instructorRatings);
    const hasAllInstructorRatings = instructors.length > 0 && ratingKeys.length === instructors.length;
    const effectiveInstructorRating = instructors.length > 0 && hasAllInstructorRatings
      ? Math.round(ratingKeys.reduce((s, k) => s + (instructorRatings[Number(k)] || 0), 0) / ratingKeys.length)
      : form.instructorRating;

    if (form.contentRating === 0 || effectiveInstructorRating === 0 || form.overallRating === 0) {
      alert('请完成所有必填评分'); return;
    }
    if (instructors.length > 0 && !hasAllInstructorRatings) {
      alert('请为每位讲师评分'); return;
    }
    setSubmitting(true);
    try {
      await api.evaluations.create({
        programId: Number(params.id), studentId: user.id,
        contentRating: form.contentRating,
        instructorRating: effectiveInstructorRating,
        organizationRating: form.organizationRating || null,
        overallRating: form.overallRating, comment: form.comment || null,
        isAnonymous: form.isAnonymous,
        ...(hasAllInstructorRatings ? {
          instructorRatings: ratingKeys.map(k => ({ instructorId: Number(k), rating: instructorRatings[Number(k)] })),
        } : {}),
      });
      setSubmitted(true);
    } catch (e: any) { alert('提交失败：' + e.message); }
    setSubmitting(false);
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push(`/programs/${params.id}`)} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回培训班</button>

      {existing ? (
        <div className="card p-6 max-w-lg">
          <div className="text-center mb-4">
            <p className="text-4xl mb-2">✅</p>
            <p className="font-semibold">您已评价过该培训班</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>提交时间：{new Date(existing.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div>课程内容：{'★'.repeat(existing.contentRating)}</div>
            <div>讲师教学：{'★'.repeat(existing.instructorRating)}</div>
            {existing.organizationRating && <div>组织服务：{'★'.repeat(existing.organizationRating)}</div>}
            <div>总体评分：{'★'.repeat(existing.overallRating)}</div>
            {existing.comment && <div className="text-xs" style={{ color: 'var(--ink-300)' }}>评语：{existing.comment}</div>}
          </div>
        </div>
      ) : submitted ? (
        <div className="card p-6 max-w-lg text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-semibold text-sm mb-1">评价已提交</p>
          <p className="text-xs" style={{ color: 'var(--ink-300)' }}>感谢您的反馈！</p>
        </div>
      ) : !canEvaluate ? (
        <div className="card p-6 max-w-lg text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>该培训班暂未开课或已取消，无法评价</p>
        </div>
      ) : (
        <div className="card p-6 max-w-lg">
          <h1 className="page-title mb-1">评价培训班</h1>
          <p className="page-subtitle mb-6">{program?.name}</p>

          <div className="space-y-5">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ink-500)' }}>课程内容质量 *</label>
              <RatingInput value={form.contentRating} onChange={v => setForm({ ...form, contentRating: v })} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ink-500)' }}>讲师教学水平 *</label>
              {instructors.length === 0 ? (
                <RatingInput value={form.instructorRating} onChange={v => setForm({ ...form, instructorRating: v })} />
              ) : (
                <div className="space-y-2 pl-1">
                  {instructors.map((inst: any) => (
                    <div key={inst.id} className="flex items-center gap-3">
                      <span className="text-xs min-w-[80px]">{inst.realName}</span>
                      <RatingInput value={instructorRatings[inst.id] || 0}
                        onChange={v => setInstructorRatings(prev => ({ ...prev, [inst.id]: v }))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ink-500)' }}>组织服务（选填）</label>
              <RatingInput value={form.organizationRating} onChange={v => setForm({ ...form, organizationRating: v })} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ink-500)' }}>总体评分 *</label>
              <RatingInput value={form.overallRating} onChange={v => setForm({ ...form, overallRating: v })} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ink-500)' }}>评语（选填）</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className="input w-full" rows={4} placeholder="分享您的学习体验…" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="anonymous" checked={form.isAnonymous} onChange={e => setForm({ ...form, isAnonymous: e.target.checked })} />
              <label htmlFor="anonymous" className="text-sm">匿名评价</label>
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-fox">{submitting ? '提交中…' : '提交评价'}</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n === value ? 0 : n)}
          className="text-xl bg-transparent border-none cursor-pointer transition-colors"
          style={{ color: n <= value ? '#e87a30' : '#ddd' }}>
          ★
        </button>
      ))}
      <span className="text-xs ml-2" style={{ color: value > 0 ? 'var(--fox)' : 'var(--ink-300)' }}>
        {value > 0 ? `${value}/5` : '未评分'}
      </span>
    </div>
  );
}
