'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function GradingDetail() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.examId as string);
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustScore, setAdjustScore] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [blind, setBlind] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewModal, setReviewModal] = useState<{ answerId: number; sessionId: number; score: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'grading' | 'appeals' | 'progress'>('grading');

  // Progress data
  const [progress, setProgress] = useState<any>(null);
  const [statusSummary, setStatusSummary] = useState<any>(null);

  // Appeals data
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealReviewing, setAppealReviewing] = useState<number | null>(null);
  const [appealNewScore, setAppealNewScore] = useState('');
  const [appealReviewNote, setAppealReviewNote] = useState('');

  useEffect(() => {
    Promise.all([
      api.exams.get(examId),
      api.exams.students(examId),
    ]).then(([e, s]) => {
      setExam(e);
      setStudents(s?.filter((st: any) => st.status === 'SUBMITTED') || []);
    }).finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    if (activeTab === 'progress') loadProgress();
    if (activeTab === 'appeals') loadAppeals();
  }, [activeTab]);

  const loadProgress = async () => {
    try {
      const [p, ss] = await Promise.all([
        fetch(`/api/exams/${examId}/grading-progress`).then(r => r.json()),
        fetch(`/api/exams/${examId}/sessions/status-summary`).then(r => r.json()),
      ]);
      setProgress(p);
      setStatusSummary(ss);
    } catch {}
  };

  const loadAppeals = async () => {
    try {
      const res = await fetch(`/api/exams/${examId}/appeals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) setAppeals(await res.json());
    } catch {}
  };

  const handleReviewAppeal = async (appealId: number, status: string) => {
    try {
      const res = await fetch(`/api/exams/appeals/${appealId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status, newScore: status === 'APPROVED' ? parseFloat(appealNewScore) : null, reviewNote: appealReviewNote }),
      });
      if (res.ok) { setAppealReviewing(null); setAppealNewScore(''); setAppealReviewNote(''); loadAppeals(); }
      else { const d = await res.json(); alert(d.message || '操作失败'); }
    } catch (e: any) { alert(e.message); }
  };

  const loadStudentAnswers = async (studentId: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/grading/${examId}/${studentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setSelectedStudent(studentId);
    setAnswers(data.answers || []);
  };

  const gradeAnswer = async (answerId: number, score: number, note?: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/grading/${examId}/${selectedStudent}/${answerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score, graderNote: note || '' }),
    });
    loadStudentAnswers(selectedStudent);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading/${examId}/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) { alert('发布失败：' + data.error); return; }
      const passCount = students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= (exam?.passScore || 60)).length;
      const failCount = students.length - passCount;
      alert(`✅ 发布成功！共 ${passCount} 名学员获得证书，${failCount} 名未达及格线`);
      setShowPublishConfirm(false);
      const d = await api.exams.students(examId);
      setStudents(d?.filter((st: any) => st.status === 'SUBMITTED') || []);
    } catch (e: any) { alert('发布失败：' + e.message); }
    setPublishing(false);
  };

  const handleConfirm = async () => {
    if (!confirm('确认所有成绩？锁存后需解锁才能修改。')) return;
    setConfirming(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading/${examId}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      alert('✅ 成绩已确认锁存');
      const d = await api.exams.students(examId);
      setStudents(d?.filter((st: any) => st.status === 'SUBMITTED') || []);
    } catch (e: any) { alert('操作失败：' + e.message); }
    setConfirming(false);
  };

  const loadReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading-reviews/${examId}`, { headers: { Authorization: `Bearer ${token}` } });
      setReviews(await res.json() || []);
    } catch {}
  };

  const handleRequestReview = async () => {
    if (!reviewModal || !reviewReason) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-reviews/${examId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answerId: reviewModal.answerId, sessionId: reviewModal.sessionId, reason: reviewReason, originalScore: reviewModal.score }),
      });
      setReviewModal(null); setReviewReason(''); loadReviews();
    } catch (e: any) { alert('操作失败：' + e.message); }
  };

  const handleResolveReview = async (reviewId: number, action: string, reviewedScore?: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading-reviews/${examId}/${reviewId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, reviewedScore }),
      });
      loadReviews();
    } catch (e: any) { alert('操作失败：' + e.message); }
  };

  const handleAdjust = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/grading/${examId}/${selectedStudent}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adjustedScore: parseInt(adjustScore), reason: adjustReason, operatorId: user.id || 1, operatorName: user.displayName || '管理员' }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setAdjustOpen(false);
    loadStudentAnswers(selectedStudent);
  };

  const scoringStatusLabel = (status: string | null | undefined, pc: number): { text: string; color: string } => {
    if (status === 'CONFIRMED') return { text: '已确认', color: 'var(--sage)' };
    if (status === 'PUBLISHED') return { text: '已发布', color: 'var(--sage)' };
    if (status === 'ADJUSTED') return { text: '已调整·待重发', color: 'var(--fox)' };
    if (status === 'GRADED') return { text: '待发布', color: 'var(--gold)' };
    if (pc > 0 && status === 'GRADING') return { text: `待阅卷 ${pc}题`, color: 'var(--fox)' };
    if (status === 'PENDING' && pc === 0) return { text: '已自动判分', color: 'var(--sage)' };
    return { text: '待处理', color: 'var(--ink-300)' };
  };

  const getStudentLabel = (s: any, idx: number) => blind ? `考生 #${idx + 1}` : s.student?.displayName || '未知';

  if (loading) return <AppLayout><p style={{ color: 'var(--ink-300)' }}>加载中…</p></AppLayout>;

  const typeNames: Record<string, string> = {
    SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
    FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
  };

  const cs = students.find(s => s.student?.id === selectedStudent);
  const allPub = students.length > 0 && students.every((s: any) => s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED');
  const allConf = students.length > 0 && students.every((s: any) => s.scoringStatus === 'CONFIRMED');

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push('/grading')} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>← 返回</button>
            <h1 className="page-title">📊 阅卷 · {exam?.title || ''}</h1>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: blind ? 'var(--fox)' : 'var(--ink-300)' }}>
              <input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} className="accent-[var(--fox)]" /> 🎭 盲批
            </label>
          </div>
          <p className="page-subtitle">
            共 {students.length} 人已提交 · 已批改 {students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length} / 待批改 {students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length}
            {allConf ? ' · 🔒 已确认' : allPub ? ' · ✅ 已全部发布' : ` · ${students.filter((s: any) => s.scoringStatus === 'PUBLISHED').length} 已发布`}
          </p>
        </div>
        <div className="flex gap-2">
          {allPub && !allConf && <button onClick={handleConfirm} disabled={confirming} className="btn btn-fox btn-sm">{confirming ? "确认中…" : "🔒 确认成绩"}</button>}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {[
          { key: 'grading', label: '📝 阅卷', icon: '' },
          { key: 'progress', label: '📈 进度', icon: '' },
          { key: 'appeals', label: '⚖️ 申诉', icon: '' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: activeTab === tab.key ? 'var(--paper)' : 'transparent', color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-400)', boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {progress ? [
              { value: progress.total, label: '总交卷', color: 'var(--ink-600)' },
              { value: progress.graded, label: '已判', color: 'var(--sage)' },
              { value: progress.remaining, label: '待判', color: progress.remaining > 0 ? 'var(--fox)' : 'var(--sage)' },
              { value: `${progress.percentage}%`, label: '完成率', color: progress.percentage === 100 ? 'var(--sage)' : 'var(--fox)' },
            ].map((s, i) => (
              <div key={i} className="card p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            )) : [
              { value: students.length, label: '总交卷', color: 'var(--ink-600)' },
              { value: students.filter(s => s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED' || s.scoringStatus === 'GRADED').length, label: '已判', color: 'var(--sage)' },
              { value: students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length, label: '待判', color: 'var(--fox)' },
            ].map((s, i) => (
              <div key={i} className="card p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-400)' }}>整体进度</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress?.percentage || Math.round(students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length / Math.max(students.length, 1) * 100)}%`, background: progress?.percentage === 100 || (students.length > 0 && students.every(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING')) ? 'var(--sage)' : 'var(--fox)' }} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>{progress?.percentage || Math.round(students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length / Math.max(students.length, 1) * 100)}%</span>
            </div>
          </div>
          {progress?.perGrader?.length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-medium mb-3" style={{ color: 'var(--ink-400)' }}>各阅卷员进度</div>
              <div className="space-y-3">
                {progress.perGrader.map((g: any) => (
                  <div key={g.graderId}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--ink-600)' }}>{g.graderName}</span>
                      <span style={{ color: 'var(--ink-400)' }}>{g.submitted}/{g.assigned} ({g.assigned > 0 ? Math.round(g.submitted / g.assigned * 100) : 0}%)</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                      <div className="h-full rounded-full" style={{ width: `${g.assigned > 0 ? g.submitted / g.assigned * 100 : 0}%`, background: g.remaining === 0 ? 'var(--sage)' : 'var(--fox)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {statusSummary && (
            <div className="card p-4">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-400)' }}>状态分布</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusSummary).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                  <span key={k} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)' }}>
                    {k}: <strong>{String(v)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appeals Tab */}
      {activeTab === 'appeals' && (
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
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
                </div>
              ));
            })()}
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead><tr><th>学员</th><th>原因</th><th>说明</th><th>原分</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {appeals.map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.student?.displayName || '—'}</td>
                    <td><span className="tag tag-cyan text-[10px]">{a.reason}</span></td>
                    <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>{a.description}</td>
                    <td>{a.oldScore ?? '—'}</td>
                    <td><span className={`tag ${a.status === 'PENDING' ? 'tag-gold' : a.status === 'APPROVED' ? 'tag-cyan' : 'tag-ink'}`}>{a.status === 'PENDING' ? '待处理' : a.status === 'APPROVED' ? '已批准' : '已驳回'}</span></td>
                    <td>
                      {a.status === 'PENDING' ? (
                        <div className="flex gap-2">
                          <button onClick={() => { setAppealReviewing(appealReviewing === a.id ? null : a.id); setAppealNewScore(''); setAppealReviewNote(''); }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>审核</button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>{a.reviewNote || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {appeals.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无申诉记录</td></tr>}
              </tbody>
            </table>
          </div>
          {appealReviewing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAppealReviewing(null)}>
              <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold text-base mb-4">审核申诉</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button onClick={() => { handleReviewAppeal(appealReviewing, 'APPROVED'); }} className="btn btn-fox btn-sm flex-1">✅ 批准</button>
                    <button onClick={() => { handleReviewAppeal(appealReviewing, 'REJECTED'); }} className="btn btn-sm flex-1" style={{ border: '1px solid var(--ink-200)' }}>❌ 驳回</button>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>新分数（批准时必填）</label>
                    <input type="number" value={appealNewScore} onChange={e => setAppealNewScore(e.target.value)} className="input w-full" placeholder="调整后分数" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>审核意见</label>
                    <textarea value={appealReviewNote} onChange={e => setAppealReviewNote(e.target.value)} className="input w-full" rows={3} placeholder="审核意见" />
                  </div>
                  <button onClick={() => setAppealReviewing(null)} className="btn btn-outline btn-sm w-full">取消</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grading Tab - unchanged */}
      {activeTab === 'grading' && (
        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
              <div className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>已提交学员</div>
              <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                {students.map((s: any, idx: number) => {
                  const si = scoringStatusLabel(s.scoringStatus, s.pendingCount || 0);
                  return (
                    <div key={s.id} onClick={() => loadStudentAnswers(s.student?.id)}
                      className="px-4 py-3 cursor-pointer transition-colors text-sm"
                      style={{ background: selectedStudent === s.student?.id ? '#fef3e7' : 'white', color: 'var(--ink-600)' }}>
                      <div className="font-medium">{getStudentLabel(s, idx)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>得分：{s.finalScore ?? s.totalScore ?? '-'}</div>
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: si.color }}>{si.text}</div>
                    </div>
                  );
                })}
                {students.length === 0 && <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无已提交学员</div>}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {!selectedStudent ? (
              <div className="rounded-xl p-12 text-center" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                <p className="text-4xl mb-4">📝</p>
                <p style={{ color: 'var(--ink-300)' }}>选择一个学员开始阅卷</p>
              </div>
            ) : (
              <div className="space-y-4">
                {answers.map((a: any) => {
                  const isSub = a.type === 'SHORT_ANSWER' || a.type === 'CASE_STUDY';
                  const graded = a.score !== null;
                  const need = isSub && !graded;
                  return (
                    <div key={a.answerId} className="rounded-xl p-5" style={{ background: 'white', border: `1px solid ${need ? '#fde68a' : graded ? '#d4edda' : 'var(--ink-100)'}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>{typeNames[a.type] || a.type} · {a.maxScore}分</span>
                        {graded && <span className="text-xs font-medium" style={{ color: 'var(--sage)' }}>已评分：{a.score}/{a.maxScore}</span>}
                      {graded && !need && <button onClick={() => setReviewModal({ answerId: a.answerId, sessionId: 0, score: a.score })} className="text-xs ml-2 px-2 py-0.5 rounded" style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-400)' }}>标记复核</button>}
                        {need && <span className="text-xs font-medium" style={{ color: '#d97706' }}>待评分</span>}
                      </div>
                      <p className="text-sm mb-3" style={{ color: 'var(--ink-600)' }}>{a.content}</p>
                      <div className="text-sm p-3 rounded-lg mb-3" style={{ background: '#faf8f5' }}>
                        <p style={{ color: 'var(--ink-500)' }}>学员答案：</p>
                        <p className="mt-1 font-medium" style={{ color: 'var(--ink-700)' }}>
                          {a.type === 'SHORT_ANSWER' ? (a.yourAnswer || '未作答') : a.type === 'CASE_STUDY' ? (JSON.stringify(a.yourAnswer) || '未作答') : String(a.yourAnswer ?? '-')}
                        </p>
                      </div>
                      {need && <GradingForm answerId={a.answerId} maxScore={a.maxScore} onGrade={gradeAnswer} onNextStudent={() => {
                        const currentIdx = students.findIndex(s => s.student?.id === selectedStudent);
                        const nextStudent = students[currentIdx + 1];
                        if (nextStudent) loadStudentAnswers(nextStudent.student?.id);
                      }} />}
                    </div>
                  );
                })}

                <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                  <button onClick={() => setAdjustOpen(!adjustOpen)} className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--ink-200)' }}>⚖️ 成绩调整</button>
                  <button onClick={() => { setShowReviews(!showReviews); if (!showReviews) loadReviews(); }} className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--ink-200)' }}>🔍 复核 ({reviews.filter((r: any) => r.status === 'PENDING').length})</button>
                  {allConf ? (
                    <button onClick={() => setShowPublishConfirm(true)} disabled={publishing} className="btn btn-fox text-sm px-4 py-2" style={{ opacity: publishing ? 0.6 : 1 }}>{publishing ? '发布中…' : '🔄 重新发布'}</button>
                  ) : (
                    <button onClick={() => setShowPublishConfirm(true)} disabled={publishing} className="btn btn-fox text-sm px-4 py-2" style={{ opacity: publishing ? 0.6 : 1 }}>{publishing ? '发布中…' : '📢 发布成绩'}</button>
                  )}
                </div>

                {adjustOpen && (
                  <div className="rounded-xl p-5" style={{ background: 'white', border: '1px solid #fde68a' }}>
                    <p className="text-sm font-medium mb-3" style={{ color: 'var(--ink-600)' }}>成绩调整（将记录审计日志）</p>
                    <div className="flex gap-3 items-end">
                      <div><label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>调整后分数</label><input type="number" value={adjustScore} onChange={e => setAdjustScore(e.target.value)} className="input w-24" min={0} max={100} /></div>
                      <div className="flex-1"><label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>调整原因 *</label><input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="如：主观题评分争议复核" className="input" /></div>
                      <button onClick={handleAdjust} disabled={!adjustReason || !adjustScore} className="btn text-sm px-4 py-2" style={{ background: 'var(--fox)', color: 'white', opacity: !adjustReason || !adjustScore ? 0.5 : 1 }}>确认调整</button>
                    </div>
                  </div>
                )}

                {showPublishConfirm && (
                  <div className="modal-overlay" onClick={() => !publishing && setShowPublishConfirm(false)}>
                    <div className="modal-card max-w-[460px]" onClick={e => e.stopPropagation()}>
                      <div className="modal-header">
                        <h3 className="font-serif font-bold text-sm">{allConf ? '🔄 确认重新发布' : '📢 确认发布成绩'}</h3>
                        <button onClick={() => setShowPublishConfirm(false)} disabled={publishing} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
                      </div>
                      <div className="modal-body text-sm space-y-3">
                        {allConf ? (
                          <p style={{ color: 'var(--ink-600)' }}>成绩已发布过。<strong style={{ color: 'var(--verm)' }}>已发布的成绩和证书将被覆盖</strong>。确认重新发布？</p>
                        ) : (
                          <>
                            <p style={{ color: 'var(--ink-600)' }}>
                              本次考试共 <strong>{students.length}</strong> 名学员，发布后将自动发送成绩通知并生成证书。
                            </p>
                            <div className="p-3 rounded-lg grid grid-cols-2 gap-2" style={{ background: 'var(--fox-glow)' }}>
                              <div className="text-center">
                                <div className="text-lg font-bold" style={{ color: 'var(--sage)' }}>
                                  {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= (exam?.passScore || 60)).length}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--ink-400)' }}>获证书</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold" style={{ color: 'var(--verm)' }}>
                                  {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) < (exam?.passScore || 60)).length}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--ink-400)' }}>未达及格线</div>
                              </div>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>成绩发布后学员端将立即看到成绩和证书。</p>
                          </>
                        )}
                      </div>
                      <div className="modal-footer">
                        <button onClick={() => setShowPublishConfirm(false)} disabled={publishing} className="btn btn-ghost btn-sm">取消</button>
                        <button onClick={handlePublish} disabled={publishing} className="btn btn-fox btn-sm">{publishing ? '发布中…' : '确认发布'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {showReviews && (
            <div className="mt-6">
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink-700)' }}>🔍 复核管理</h3>
              <div className="card overflow-hidden">
                <table className="list-table">
                  <thead><tr><th>学员</th><th>原因</th><th>原分</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {reviews.map((r: any) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.session?.student?.displayName || '—'}</td>
                        <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{r.reason}</td>
                        <td>{r.originalScore}</td>
                        <td><span className={`tag ${r.status === 'PENDING' ? 'tag-gold' : r.status === 'RESOLVED' ? 'tag-cyan' : 'tag-ink'}`}>{r.status}</span></td>
                        <td>
                          {r.status === 'PENDING' && (
                            <div className="flex gap-1">
                              <button onClick={() => { const s = prompt('输入新分数：', String(r.originalScore)); if (s) handleResolveReview(r.id, 'RESOLVED', parseFloat(s)); }} className="btn btn-ghost btn-xs" style={{ color: 'var(--cyan)' }}>改分</button>
                              <button onClick={() => handleResolveReview(r.id, 'DISMISSED')} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>驳回</button>
                            </div>
                          )}
                          {r.status !== 'PENDING' && <span className="text-xs" style={{ color: 'var(--ink-300)' }}>已处理</span>}
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-xs" style={{ color: 'var(--ink-300)' }}>暂无复核记录</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {reviewModal && (
        <div className="modal-overlay" onClick={() => setReviewModal(null)}>
          <div className="modal-card max-w-[400px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-sm">标记复核</h3>
              <button onClick={() => setReviewModal(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-3">
              <p className="text-xs" style={{ color: 'var(--ink-400)' }}>当前得分：{reviewModal.score}</p>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>复核原因 *</label>
                <textarea value={reviewReason} onChange={e => setReviewReason(e.target.value)} className="input textarea" rows={3} placeholder="如：评分标准有疑义，需二审确认" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setReviewModal(null)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleRequestReview} disabled={!reviewReason} className="btn btn-fox btn-sm">提交复核</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function GradingForm({ answerId, maxScore, onGrade, onNextStudent }: { answerId: number; maxScore: number; onGrade: (id: number, score: number, note?: string) => void; onNextStudent?: () => void }) {
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!score) return;
    setSubmitting(true);
    await onGrade(answerId, parseInt(score), note);
    setSubmitting(false);
    setScore('');
    if (onNextStudent) onNextStudent();
  };
  return (
    <div className="flex gap-2 items-end">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>评分（/{maxScore}）</label><input type="number" value={score} onChange={e => setScore(e.target.value)} className="input w-20" min={0} max={maxScore}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} /></div>
      <div className="flex-1"><label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>评语</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="扣分原因" className="input"
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} /></div>
      <button onClick={handleSubmit}
        disabled={!score || submitting} className="btn text-xs px-3 py-2" style={{ background: 'var(--sage)', color: 'white', opacity: !score || submitting ? 0.5 : 1 }}>
        {submitting ? '提交中…' : '提交评分'}</button>
    </div>
  );
}
