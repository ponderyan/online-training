'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import Loading from '@/components/Loading';
import { api } from '@/lib/api';
import CircularProgress from '@/components/charts/CircularProgress';

export default function GradingDetail() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const examId = parseInt(params.examId as string);
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [assignedSessionIds, setAssignedSessionIds] = useState<Set<number>>(new Set());
  const [assignedQuestionIds, setAssignedQuestionIds] = useState<Set<number>>(new Set());
  const [viewFilter, setViewFilter] = useState<'mine' | 'all'>('mine');
  const [userRole, setUserRole] = useState<string>('');
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
  const [reGrade, setReGrade] = useState<{ answerId: number; paperQuestionId: number; maxScore: number; currentScore: number; currentNote: string } | null>(null);
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
    }).catch((e: any) => {
      console.error('加载考试数据失败:', e);
      toast.error('加载考试数据失败：' + (e.message || '未知错误'));
    }).finally(() => setLoading(false));
  }, [examId]);

  // 获取当前用户角色 + 分派信息
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    const userId = user.id;
    const isOfficer = user.role === 'ORG_ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isOfficer && examId) {
      fetch(`/api/grading-assignments/${examId}?graderId=${userId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      ).then(r => {
        if (!r.ok) throw new Error(`获取分派失败 (${r.status})`);
        return r.json();
      }).then(data => {
        const items = data.assignments || (Array.isArray(data) ? data : []);
        setMyAssignments(items);
        setAssignedSessionIds(new Set(items.filter((a: any) => a.sessionId !== null).map((a: any) => a.sessionId)));
        setAssignedQuestionIds(new Set(items.filter((a: any) => a.paperQuestionId !== null).map((a: any) => a.paperQuestionId)));
      }).catch(e => {
        console.error('获取分派信息失败:', e);
      });
    } else {
      setViewFilter('all');
    }
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
    } catch (e: any) { console.error('加载进度失败:', e); toast.error('加载进度失败：' + (e.message || '未知错误')); }
  };

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
    // 前端校验：非管理员不能评分未分派的题
    const isOfficer = userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isOfficer) {
      const answer = answers.find((a: any) => a.answerId === answerId);
        if (answer && !assignedQuestionIds.has(answer.paperQuestionId)) {
        toast.warning('你未被分派评分此题');
        return;
      }
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/grading/${examId}/${selectedStudent}/${answerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score, graderNote: note || '' }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      toast.error(errorData.error || '评分提交失败');
      return;
    }
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
      if (data.error) { toast.error('发布失败：' + data.error); return; }
      const passScore = exam?.passingScore ?? 60;
      const passCount = students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= passScore).length;
      const failCount = students.length - passCount;
      toast.success(`发布成功！共 ${passCount} 名学员获得证书，${failCount} 名未达及格线`);
      setShowPublishConfirm(false);
      const d = await api.exams.students(examId);
      setStudents(d?.filter((st: any) => st.status === 'SUBMITTED') || []);
    } catch (e: any) { toast.error('发布失败：' + e.message); }
    setPublishing(false);
  };

  const handleConfirm = async () => {
    if (!confirm('确认所有成绩？锁存后需解锁才能修改。')) return;
    setConfirming(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading/${examId}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      toast.success('成绩已确认锁存');
      const d = await api.exams.students(examId);
      setStudents(d?.filter((st: any) => st.status === 'SUBMITTED') || []);
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setConfirming(false);
  };

  const loadReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading-reviews/${examId}`, { headers: { Authorization: `Bearer ${token}` } });
      setReviews(await res.json() || []);
    } catch (e: any) { console.error('加载复核记录失败:', e); toast.error('加载复核记录失败：' + (e.message || '未知错误')); }
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
    } catch (e: any) { toast.error('操作失败：' + e.message); }
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
    } catch (e: any) { toast.error('操作失败：' + e.message); }
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
    if (data.error) { toast.error(data.error); return; }
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

  if (loading) return <AppLayout><Loading text="正在加载阅卷数据…" /></AppLayout>;

  const typeNames: Record<string, string> = {
    SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
    FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
  };

  const filteredStudents = viewFilter === 'mine' && assignedSessionIds.size > 0
    ? students.filter((s: any) => assignedSessionIds.has(s.id))
    : students;
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
            {/* 视图切换开关 */}
            {userRole !== 'SUPER_ADMIN' && userRole !== 'ORG_ADMIN' && (
              <div className="flex gap-1 ml-3" style={{ border: '1px solid var(--ink-200)', borderRadius: '8px', padding: '2px' }}>
                <button onClick={() => setViewFilter('mine')}
                  className="text-xs px-3 py-1 rounded-md transition-all cursor-pointer"
                  style={{ background: viewFilter === 'mine' ? 'var(--fox)' : 'transparent', color: viewFilter === 'mine' ? 'white' : 'var(--ink-400)' }}>
                  仅我的分派
                </button>
                <button onClick={() => setViewFilter('all')}
                  className="text-xs px-3 py-1 rounded-md transition-all cursor-pointer"
                  style={{ background: viewFilter === 'all' ? 'var(--fox)' : 'transparent', color: viewFilter === 'all' ? 'white' : 'var(--ink-400)' }}>
                  全部
                </button>
              </div>
            )}
          </div>
          <p className="page-subtitle">
            {viewFilter === 'mine'
              ? `分派给我 ${filteredStudents.length} 人 · 已批改 ${filteredStudents.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length}`
              : `共 ${students.length} 人已提交 · 已批改 ${students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length} / 待批改 ${students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length}`}
            {allConf ? ' · 🔒 已确认' : allPub ? ' · ✅ 已全部发布' : ` · ${students.filter((s: any) => s.scoringStatus === 'PUBLISHED').length} 已发布`}
          </p>
        </div>
        <div className="flex gap-2">
          {allPub && !allConf && (userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && <button onClick={handleConfirm} disabled={confirming} className="btn btn-fox btn-sm">{confirming ? "确认中…" : "🔒 确认成绩"}</button>}
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
                <div className="text-2xl font-bold num" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            )) : [
              { value: students.length, label: '总交卷', color: 'var(--ink-600)' },
              { value: students.filter(s => s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED' || s.scoringStatus === 'GRADED').length, label: '已判', color: 'var(--sage)' },
              { value: students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length, label: '待判', color: 'var(--fox)' },
            ].map((s, i) => (
              <div key={i} className="card p-4 text-center">
                <div className="text-2xl font-bold num" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 整体进度 — 圆环图 */}
          <div className="card p-5">
            <div className="text-xs font-medium mb-3" style={{ color: 'var(--ink-400)' }}>整体进度</div>
            <div className="flex items-center gap-6">
              <CircularProgress
                percentage={progress?.percentage ?? Math.round(students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length / Math.max(students.length, 1) * 100)}
                size={130}
              />
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>已批改</span>
                  <span className="num font-medium" style={{ color: 'var(--sage)' }}>
                    {progress?.graded ?? students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>待批改</span>
                  <span className="num font-medium" style={{ color: 'var(--fox)' }}>
                    {progress?.remaining ?? students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>总提交</span>
                  <span className="num font-medium" style={{ color: 'var(--ink-600)' }}>
                    {progress?.total ?? students.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 各阅卷员进度 — 条纹动画 */}
          {progress?.perGrader?.length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-medium mb-3" style={{ color: 'var(--ink-400)' }}>各阅卷员进度</div>
              <div className="space-y-3">
                {progress.perGrader.map((g: any) => {
                  const gpct = g.assigned > 0 ? Math.round(g.submitted / g.assigned * 100) : 0;
                  const gDone = g.remaining === 0;
                  return (
                    <div key={g.graderId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-600)' }}>
                          {gDone && <span style={{ color: 'var(--sage)' }}>✓</span>}
                          {g.graderName}
                        </span>
                        <span className="num" style={{ color: 'var(--ink-400)' }}>{g.submitted}/{g.assigned} ({gpct}%)</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--paper-dark)' }}>
                        <div
                          className={`h-full rounded-full transition-all ${gDone ? 'progress-done' : 'progress-striped'}`}
                          style={{ width: `${gpct}%`, background: gDone ? 'var(--sage)' : 'var(--fox)' }}
                        />
                      </div>
                      {g.details && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {g.details.map((d: any, idx: number) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: d.submitted >= d.total ? 'rgba(46,125,50,0.1)' : 'rgba(222,115,30,0.1)', color: d.submitted >= d.total ? 'var(--sage)' : 'var(--gold)' }}>
                              {d.label}: {d.submitted}/{d.total}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 成绩分布直方图 — 前端从 students 计算 */}
          {(() => {
            const maxScore = exam?.totalScore || 100;
            const scored = students
              .map(s => s.finalScore ?? s.totalScore)
              .filter((v: any) => typeof v === 'number' && v !== null);
            if (scored.length === 0) return null;
            // 按百分比分桶（兼容不同满分）
            const buckets = [
              { range: '0-59', min: 0, max: 59, count: 0 },
              { range: '60-69', min: 60, max: 69, count: 0 },
              { range: '70-79', min: 70, max: 79, count: 0 },
              { range: '80-89', min: 80, max: 89, count: 0 },
              { range: '90-100', min: 90, max: 100, count: 0 },
            ];
            scored.forEach((raw: number) => {
              const pct = Math.round((raw / maxScore) * 100);
              const b = buckets.find(bk => pct >= bk.min && pct <= bk.max) || buckets[0];
              b.count++;
            });
            const maxCount = Math.max(...buckets.map(b => b.count), 1);
            const colorFor = (range: string) =>
              range === '0-59' ? 'var(--verm)' :
              range === '60-69' ? 'var(--gold)' :
              range === '70-79' ? 'var(--fox)' :
              range === '80-89' ? 'var(--cyan)' : 'var(--sage)';
            return (
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-700)' }}>成绩分布</h3>
                <div className="space-y-3">
                  {buckets.map(b => {
                    const w = (b.count / maxCount) * 100;
                    return (
                      <div key={b.range}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: b.range === '0-59' ? 'var(--verm)' : 'var(--ink-500)' }}>{b.range} 分</span>
                          <span className="num" style={{ color: 'var(--ink-400)' }}>{b.count} 人</span>
                        </div>
                        <div className="h-6 rounded-lg overflow-hidden" style={{ background: 'var(--paper-dark)' }}>
                          <div className="hist-bar h-full rounded-lg flex items-center justify-end px-2 text-[10px] text-white font-medium"
                            style={{ width: `${Math.max(w, b.count > 0 ? 4 : 0)}%`, background: colorFor(b.range), minWidth: b.count > 0 ? 'auto' : 0 }}>
                            {b.count > 0 && `${b.count}人`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {statusSummary && (
            <div className="card p-4">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-400)' }}>状态分布</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusSummary).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                  <span key={k} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)' }}>
                    {k}: <strong className="num">{String(v)}</strong>
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
                {filteredStudents.map((s: any, idx: number) => {
                  const si = scoringStatusLabel(s.scoringStatus, s.pendingCount || 0);
                  const score = s.finalScore ?? s.totalScore;
                  const maxScore = exam?.totalScore || s.totalScore || 0;
                  const objScore = s.objectiveScore ?? null;
                  const subjScore = s.subjectiveScore ?? null;
                  const pendingCount = s.pendingCount || 0;
                  return (
                    <div key={s.id} onClick={() => loadStudentAnswers(s.student?.id)}
                      className="px-4 py-3 cursor-pointer transition-colors text-sm"
                      style={{ background: selectedStudent === s.student?.id ? '#fef3e7' : 'white', color: 'var(--ink-600)' }}>
                      <div className="flex items-center gap-1">
                        <div className="font-medium">{getStudentLabel(s, idx)}</div>
                        {assignedSessionIds.has(s.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(46,125,50,0.1)', color: 'var(--sage)' }}>已分派</span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--ink-400)' }}>
                        <span style={{ color: 'var(--ink-600)', fontWeight: 600 }}>得分：{score ?? '-'}/{maxScore || '-'}</span>
                        {objScore !== null && subjScore !== null && (
                          <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>客观{objScore} + 主观{subjScore}</span>
                        )}
                      </div>
                      {pendingCount > 0 && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--gold-dark)' }}>⏳ 待评 {pendingCount} 题</div>
                      )}
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: si.color }}>{si.text}</div>
                    </div>
                  );
                })}
                {filteredStudents.length === 0 && <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>
                  {viewFilter === 'mine' ? '暂无分派给你的学员' : '暂无已提交学员'}
                </div>}
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
                {/* 分值汇总条 */}
                {(() => {
                  const objectiveTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'];
                  const subjectiveTypes = ['SHORT_ANSWER', 'CASE_STUDY'];
                  const objAnswers = answers.filter(a => objectiveTypes.includes(a.type));
                  const subjAnswers = answers.filter(a => subjectiveTypes.includes(a.type));
                  const objScore = objAnswers.reduce((s, a) => s + (a.score || 0), 0);
                  const objMax = objAnswers.reduce((s, a) => s + (a.maxScore || 0), 0);
                  const subjScore = subjAnswers.reduce((s, a) => s + (a.score || 0), 0);
                  const subjMax = subjAnswers.reduce((s, a) => s + (a.maxScore || 0), 0);
                  const totalScore = answers.reduce((s, a) => s + (a.score || 0), 0);
                  const totalMax = answers.reduce((s, a) => s + (a.maxScore || 0), 0);
                  const pendingSubj = subjAnswers.filter(a => a.score === null);
                  const passScore = exam?.passingScore ?? 60;
                  const passRate = totalMax > 0 ? Math.round(passScore / totalMax * 100) : 60;
                  const isPassed = totalScore >= passScore;
                  const allGraded = pendingSubj.length === 0 && answers.every(a => a.score !== null);
                  return (
                    <div className="rounded-xl p-5" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ width: 4, height: 16, background: 'var(--fox)', borderRadius: 2, display: 'inline-block' }} />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>得分汇总</h3>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-3 rounded-lg" style={{ background: 'var(--cyan-glow)' }}>
                          <div className="text-lg font-bold" style={{ color: 'var(--cyan)' }}>{objScore}/{objMax}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-400)' }}>客观题</div>
                          <div className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--sage)' }}>✅ 自动判分</div>
                        </div>
                        <div className="text-center p-3 rounded-lg" style={{ background: pendingSubj.length > 0 ? 'var(--gold-glow)' : 'var(--cyan-glow)' }}>
                          <div className="text-lg font-bold" style={{ color: pendingSubj.length > 0 ? 'var(--gold-dark)' : 'var(--cyan)' }}>{subjScore}/{subjMax}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-400)' }}>主观题</div>
                          <div className="text-[10px] mt-0.5 font-medium" style={{ color: pendingSubj.length > 0 ? 'var(--gold-dark)' : 'var(--sage)' }}>
                            {pendingSubj.length > 0 ? '⏳ 待评 ' + pendingSubj.length + '题' : '✅ 已评完'}
                          </div>
                        </div>
                        <div className="text-center p-3 rounded-lg" style={{ background: isPassed ? 'var(--sage-glow)' : 'var(--verm-glow)' }}>
                          <div className="text-lg font-bold" style={{ color: isPassed ? 'var(--sage)' : 'var(--verm)' }}>{totalScore}/{totalMax}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-400)' }}>总分</div>
                          <div className="text-[10px] mt-0.5 font-medium" style={{ color: isPassed ? 'var(--sage)' : 'var(--verm)' }}>
                            {!allGraded ? '⏳ 评阅中' : isPassed ? '✅ 已及格' : '❌ 未及格'}
                          </div>
                        </div>
                        <div className="text-center p-3 rounded-lg" style={{ background: 'var(--paper-dark)' }}>
                          <div className="text-lg font-bold" style={{ color: 'var(--ink-600)' }}>{passScore}分</div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-400)' }}>及格线</div>
                          <div className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--ink-400)' }}>{passRate}%</div>
                        </div>
                      </div>
                      {pendingSubj.length > 0 && (
                        <p className="text-xs mt-3" style={{ color: 'var(--gold-dark)' }}>
                          待评：{pendingSubj.length} 道主观题（{pendingSubj.map(a => typeNames[a.type]).join('、')}）
                        </p>
                      )}
                    </div>
                  );
                })()}

                {answers.map((a: any) => {
                  const isSub = a.type === 'SHORT_ANSWER' || a.type === 'CASE_STUDY';
                  const graded = a.score !== null;
                  const need = isSub && !graded;
                  return (
                    <div key={a.answerId} className="rounded-xl p-5" style={{ background: 'white', border: `1px solid ${need ? '#fde68a' : graded ? '#d4edda' : 'var(--ink-100)'}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                            {isSub ? '✍️' : '☑️'} {typeNames[a.type] || a.type} · {a.maxScore}分
                          </span>
                          {graded ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>✅ 已评分 {a.score}/{a.maxScore}</span>
                          ) : need ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--gold-glow)', color: 'var(--gold-dark)' }}>⏳ 待评分</span>
                          ) : !a.yourAnswer ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>❌ 未作答</span>
                          ) : null}
                        </div>
                        {graded && !need && <>
                          <button onClick={() => setReviewModal({ answerId: a.answerId, sessionId: a.sessionId || 0, score: a.score })} className="text-xs ml-2 px-2 py-0.5 rounded" style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-400)' }}>🔍 复核</button>
                          <button onClick={() => {
                            setReGrade({ answerId: a.answerId, paperQuestionId: a.paperQuestionId, maxScore: a.maxScore, currentScore: a.score, currentNote: a.graderNote || '' });
                          }} className="text-xs ml-1 px-2 py-0.5 rounded" style={{ border: '1px solid var(--sage)', color: 'var(--sage)' }}>✏️ 改分</button>
                        </>}
                      </div>
                      <p className="text-sm mb-3" style={{ color: 'var(--ink-600)' }}>{a.content}</p>
                      <div className="text-sm p-3 rounded-lg mb-3" style={{ background: isSub ? 'var(--fox-pale)' : 'var(--paper-alt)', borderLeft: `3px solid ${isSub ? 'var(--fox-light)' : 'var(--ink-200)'}` }}>
                        <p className="flex items-center gap-1" style={{ color: 'var(--ink-500)' }}>
                          {isSub ? '✍️ 学员答案：' : '☑️ 学员答案：'}
                        </p>
                        <p className="mt-1 font-medium" style={{ color: 'var(--ink-700)', maxHeight: isSub && String(a.yourAnswer ?? '').length > 200 ? undefined : undefined }}>
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

                {/* 阅卷操作 */}
                <div className="rounded-xl p-5" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ width: 4, height: 14, background: 'var(--fox)', borderRadius: 2, display: 'inline-block' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--ink-600)' }}>阅卷操作</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowReviews(!showReviews); if (!showReviews) loadReviews(); }} className="btn btn-outline btn-sm">🔍 标记复核 ({reviews.filter((r: any) => r.status === 'PENDING').length})</button>
                    <button onClick={() => setAdjustOpen(!adjustOpen)} className="btn btn-outline btn-sm">✏️ 改分</button>
                  </div>
                </div>

                {/* 考试管理（仅考务员可见） */}
                {(userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && (
                  <div className="rounded-xl p-5" style={{ background: 'var(--fox-glow)', border: '1px solid var(--fox-light)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ width: 4, height: 14, background: 'var(--gold-dark)', borderRadius: 2, display: 'inline-block' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--gold-dark)' }}>考试管理</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAdjustOpen(!adjustOpen)} className="btn btn-outline btn-sm">⚖️ 成绩调整</button>
                      {allConf ? (
                        <button onClick={() => setShowPublishConfirm(true)} disabled={publishing} className="btn btn-fox btn-sm" style={{ opacity: publishing ? 0.6 : 1 }}>{publishing ? '发布中…' : '🔄 重新发布'}</button>
                      ) : (
                        <button onClick={() => setShowPublishConfirm(true)} disabled={publishing} className="btn btn-fox btn-sm" style={{ opacity: publishing ? 0.6 : 1 }}>{publishing ? '发布中…' : '📢 发布成绩'}</button>
                      )}
                    </div>
                  </div>
                )}

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
                                  {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= (exam?.passingScore ?? 60)).length}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--ink-400)' }}>获证书</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold" style={{ color: 'var(--verm)' }}>
                                  {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) < (exam?.passingScore ?? 60)).length}
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

      {reGrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReGrade(null)}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">改分</h3>
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--ink-400)' }}>当前得分：{reGrade.currentScore}/{reGrade.maxScore}</p>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>新分数（/{reGrade.maxScore}）</label>
                <input type="number" id="reGradeScore" className="input w-full" min={0} max={reGrade.maxScore} defaultValue={reGrade.currentScore} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ink-400)' }}>评语</label>
                <input type="text" id="reGradeNote" className="input w-full" placeholder="改分原因" defaultValue={reGrade.currentNote} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReGrade(null)} className="btn btn-ghost btn-sm flex-1">取消</button>
                <button onClick={async () => {
                  const scoreInput = document.getElementById('reGradeScore') as HTMLInputElement;
                  const noteInput = document.getElementById('reGradeNote') as HTMLInputElement;
                  const newScore = parseFloat(scoreInput?.value || '');
                  if (isNaN(newScore)) { toast.warning('请输入有效分数'); return; }
                  await gradeAnswer(reGrade.answerId, newScore, noteInput?.value || '');
                  setReGrade(null);
                }} className="btn btn-fox btn-sm flex-1">确认改分</button>
              </div>
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
