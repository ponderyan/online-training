'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

// 申诉 Tab：统计卡 + 申诉列表 + 审核弹窗（mount 自加载）
export default function AppealsTab({ examId }: { examId: number }) {
  const toast = useToast();
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealReviewing, setAppealReviewing] = useState<number | null>(null);
  const [appealNewScore, setAppealNewScore] = useState('');
  const [appealReviewNote, setAppealReviewNote] = useState('');

  useEffect(() => { loadAppeals(); }, [examId]);

  const loadAppeals = async () => {
    try {
      const res = await fetch(`/api/exams/${examId}/appeals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) setAppeals(await res.json());
    } catch (e: any) { console.error('加载申诉失败:', e); toast.error('加载申诉失败：' + (e.message || '未知错误')); }
  };

  const handleReviewAppeal = async (appealId: number, status: string) => {
    try {
      const res = await fetch(`/api/exams/appeals/${appealId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status, newScore: status === 'APPROVED' ? parseFloat(appealNewScore) : null, reviewNote: appealReviewNote }),
      });
      if (res.ok) { setAppealReviewing(null); setAppealNewScore(''); setAppealReviewNote(''); loadAppeals(); }
      else { const d = await res.json(); toast.error(d.message || '操作失败'); }
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {(() => {
          const total = appeals.length;
          const pending = appeals.filter((a: any) => a.status === 'PENDING').length;
          const done = total - pending;
          return [
            { value: total, label: '总申诉', color: 'var(--ink-600)' },
            { value: pending, label: '待处理', color: pending > 0 ? 'var(--fox)' : 'var(--sage)' },
            { value: done, label: '已处理', color: 'var(--sage)' },
          ].map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[var(--ink-400)] text-xs mt-1">{s.label}</div>
            </div>
          ));
        })()}
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="list-table">
          <thead><tr><th>学员</th><th>原因</th><th>说明</th><th>原分</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {appeals.map((a: any) => (
              <tr key={a.id}>
                <td className="font-medium">{a.student?.displayName || '—'}</td>
                <td><span className="tag tag-cyan text-[10px]">{a.reason}</span></td>
                <td className="text-[var(--ink-400)] text-xs max-w-[200px] truncate">{a.description}</td>
                <td>{a.oldScore ?? '—'}</td>
                <td><span className={`tag ${a.status === 'PENDING' ? 'tag-gold' : a.status === 'APPROVED' ? 'tag-cyan' : 'tag-ink'}`}>{a.status === 'PENDING' ? '待处理' : a.status === 'APPROVED' ? '已批准' : '已驳回'}</span></td>
                <td>
                  {a.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <button onClick={() => { setAppealReviewing(appealReviewing === a.id ? null : a.id); setAppealNewScore(''); setAppealReviewNote(''); }} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]" >审核</button>
                    </div>
                  ) : (
                    <span className="text-[var(--ink-300)] text-xs">{a.reviewNote || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
            {appeals.length === 0 && <tr><td colSpan={6} className="text-[var(--ink-300)] text-center py-8 text-xs">暂无申诉记录</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      {appealReviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAppealReviewing(null)}>
          <div className="rounded-xl p-6 w-full max-w-md bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">审核申诉</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <button onClick={() => { handleReviewAppeal(appealReviewing, 'APPROVED'); }} className="btn btn-fox btn-sm flex-1">✅ 批准</button>
                <button onClick={() => { handleReviewAppeal(appealReviewing, 'REJECTED'); }} className="btn btn-sm flex-1" style={{ border: '1px solid var(--ink-200)' }}>❌ 驳回</button>
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">新分数（批准时必填）</label>
                <input type="number" value={appealNewScore} onChange={e => setAppealNewScore(e.target.value)} className="input w-full" placeholder="调整后分数" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">审核意见</label>
                <textarea value={appealReviewNote} onChange={e => setAppealReviewNote(e.target.value)} className="input w-full" rows={3} placeholder="审核意见" />
              </div>
              <button onClick={() => setAppealReviewing(null)} className="btn btn-outline btn-sm w-full">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
