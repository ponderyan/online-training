'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const REASON_OPTIONS = [
  { value: 'SCORE_CALC', label: '分数计算有误' },
  { value: 'MISSING_ANSWER', label: '漏评题目' },
  { value: 'MISJUDGE', label: '判分不当' },
  { value: 'OTHER', label: '其他' },
];

export default function AppealPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string);
  const [user, setUser] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [existingAppeal, setExistingAppeal] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      setUser(parsed);
      if (parsed.role === 'STUDENT') {
        Promise.all([
          api.exams.get(examId).catch(() => null),
          api.scoreAppeals.my(parsed.id).catch(() => []),
        ]).then(([examData, myAppeals]) => {
          const session = examData?.sessions?.find((s: any) => s.studentId === parsed.id);
          setResult({ exam: examData, session });
          const appeal = (myAppeals || []).find((a: any) => a.examId === examId);
          setExistingAppeal(appeal || null);
        }).finally(() => setLoading(false));
      }
    }
    setLoading(false);
  }, []);

  const handleSubmit = async () => {
    if (!reason) { alert('请选择申诉原因'); return; }
    if (!description) { alert('请填写详细说明'); return; }
    setSubmitting(true);
    try {
      await api.scoreAppeals.create(examId, { reason, description, studentId: user.id });
      setSubmitted(true);
    } catch (e: any) { alert('提交失败：' + e.message); }
    setSubmitting(false);
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push('/exams/appeals')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回申诉列表</button>
      <h1 className="page-title">⚖️ 成绩申诉</h1>
      <p className="page-subtitle mb-6">{result?.exam?.title || '考试'}</p>

      {existingAppeal ? (
        <div className="card p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{existingAppeal.status === 'APPROVED' ? '✅' : existingAppeal.status === 'REJECTED' ? '❌' : '⏳'}</span>
            <div>
              <div className="font-semibold text-sm">
                {existingAppeal.status === 'PENDING' ? '申诉已提交，等待审核' : existingAppeal.status === 'APPROVED' ? '申诉已批准' : '申诉已驳回'}
              </div>
              <div className="text-xs" style={{ color: 'var(--ink-300)' }}>提交时间：{new Date(existingAppeal.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div><span style={{ color: 'var(--ink-400)' }}>原因：</span>{existingAppeal.reason}</div>
            <div><span style={{ color: 'var(--ink-400)' }}>说明：</span>{existingAppeal.description}</div>
            {existingAppeal.oldScore && <div><span style={{ color: 'var(--ink-400)' }}>原分数：</span>{existingAppeal.oldScore}</div>}
            {existingAppeal.newScore && <div><span style={{ color: 'var(--ink-400)' }}>调整后：</span><strong style={{ color: 'var(--sage)' }}>{existingAppeal.newScore}</strong></div>}
            {existingAppeal.reviewNote && <div><span style={{ color: 'var(--ink-400)' }}>审核意见：</span>{existingAppeal.reviewNote}</div>}
          </div>
        </div>
      ) : submitted ? (
        <div className="card p-6 max-w-lg text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-semibold text-sm mb-2">申诉已提交</p>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-300)' }}>等待管理员审核</p>
          <button onClick={() => router.push('/exams/appeals')} className="btn btn-fox btn-sm">查看申诉记录</button>
        </div>
      ) : (
        <div className="card p-6 max-w-lg">
          {result?.session ? (
            <>
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--paper-dark)' }}>
                <div className="text-sm">当前成绩：<strong>{result.session.totalScore ?? result.session.finalScore ?? '—'}</strong></div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>状态：{result.session.scoringStatus === 'PUBLISHED' ? '已发布' : result.session.scoringStatus}</div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>申诉原因 *</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} className="input select w-full">
                    <option value="">请选择…</option>
                    {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>详细说明 *</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} className="input w-full" rows={5} placeholder="请详细描述申诉理由，如有需要说明的评分问题、漏评题目等" />
                </div>
                <button onClick={handleSubmit} disabled={submitting || !reason || !description} className="btn btn-fox">{submitting ? '提交中…' : '提交申诉'}</button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-300)' }}>未找到该考试的记录</p>
          )}
        </div>
      )}
    </AppLayout>
  );
}
