'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import GradingForm from './grading-form';

const typeNames: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题', ESSAY: '论文题',
};

// 按人阅卷 Tab：学员侧栏 + 得分汇总 + 答案卡片 + 复核/改分/发布弹窗
export default function GradingTab({ examId, exam, students, userRole, blind, viewFilter, assignedSessionIds, assignedQuestionIds, onStudentsReload }: {
  examId: number;
  exam: any;
  students: any[];
  userRole: string;
  blind: boolean;
  viewFilter: 'mine' | 'all';
  assignedSessionIds: Set<number>;
  assignedQuestionIds: Set<number>;
  onStudentsReload: () => void;
}) {
  const toast = useToast();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustScore, setAdjustScore] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewModal, setReviewModal] = useState<{ answerId: number; sessionId: number; score: number } | null>(null);
  const [reGrade, setReGrade] = useState<{ answerId: number; paperQuestionId: number; maxScore: number; currentScore: number; currentNote: string } | null>(null);

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
      if (data.message || data.error) { toast.error('发布失败：' + (data.message || data.error)); return; }
      const passScore = exam?.passingScore ?? 60;
      const passCount = students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= passScore).length;
      const failCount = students.length - passCount;
      toast.success(`发布成功！共 ${passCount} 名学员获得证书，${failCount} 名未达及格线`);
      setShowPublishConfirm(false);
      onStudentsReload();
    } catch (e: any) { toast.error('发布失败：' + e.message); }
    setPublishing(false);
  };

  const loadReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/grading-reviews/${examId}`, { headers: { Authorization: `Bearer ${token}` } });
      // 防御：接口失败返回错误对象而非数组（同 assign 页 401 崩溃问题）
      const rData = res.ok ? await res.json() : null;
      setReviews(Array.isArray(rData) ? rData : []);
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
    if (data.message || data.error) { toast.error(data.message || data.error); return; }
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

  const filteredStudents = viewFilter === 'mine' && assignedSessionIds.size > 0
    ? students.filter((s: any) => assignedSessionIds.has(s.id))
    : students;
  const allConf = students.length > 0 && students.every((s: any) => s.scoringStatus === 'CONFIRMED');

  return (
    <>
    <div className="flex gap-6">
      <div className="w-64 flex-shrink-0">
        <div className="rounded-xl overflow-hidden bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
          <div className="px-4 py-3 text-xs font-medium text-[var(--ink-400)]" style={{  borderBottom: '1px solid var(--ink-100)' }}>已提交学员</div>
          <div className="border-[var(--ink-100)] divide-y">
            {filteredStudents.map((s: any, idx: number) => {
              const si = scoringStatusLabel(s.scoringStatus, s.pendingCount || 0);
              const score = s.finalScore ?? s.totalScore;
              const maxScore = exam?.totalScore || s.totalScore || 0;
              const objScore = s.objectiveScore ?? null;
              const subjScore = s.subjectiveScore ?? null;
              const pendingCount = s.pendingCount || 0;
              return (
                <div key={s.id} onClick={() => loadStudentAnswers(s.student?.id)}
                  className="px-4 py-3 cursor-pointer transition-colors text-sm text-[var(--ink-600)]"
                  style={{ background: selectedStudent === s.student?.id ? 'var(--fox-pale2)' : 'white',  }}>
                  <div className="flex items-center gap-1">
                    <div className="font-medium">{getStudentLabel(s, idx)}</div>
                    {assignedSessionIds.has(s.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(46,125,50,0.1)] text-[var(--sage)]" >已分派</span>
                    )}
                  </div>
                  <div className="text-[var(--ink-400)] text-xs mt-0.5 flex items-center gap-1.5">
                    <span className="text-[var(--ink-600)]" style={{  fontWeight: 600 }}>得分：{score ?? '-'}/{maxScore || '-'}</span>
                    {objScore !== null && subjScore !== null && (
                      <span className="text-[var(--ink-300)] text-[10px]">客观{objScore} + 主观{subjScore}</span>
                    )}
                  </div>
                  {pendingCount > 0 && (
                    <div className="text-[var(--gold-dark)] text-[10px] mt-0.5">⏳ 待评 {pendingCount} 题</div>
                  )}
                  <div className="text-[10px] mt-0.5 font-medium" style={{ color: si.color }}>{si.text}</div>
                </div>
              );
            })}
            {filteredStudents.length === 0 && <div className="text-[var(--ink-300)] px-4 py-8 text-center text-xs">
              {viewFilter === 'mine' ? '暂无分派给你的学员' : '暂无已提交学员'}
            </div>}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {!selectedStudent ? (
          <div className="rounded-xl p-12 text-center bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
            <p className="text-4xl mb-4">📝</p>
            <p className="text-[var(--ink-300)]">选择一个学员开始阅卷</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 分值汇总条 */}
            {(() => {
              const objectiveTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'];
              const subjectiveTypes = ['SHORT_ANSWER', 'CASE_STUDY', 'ESSAY'];
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
                <div className="rounded-xl p-5 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-[var(--fox)]" style={{ width: 4, height: 16,  borderRadius: 2, display: 'inline-block' }} />
                    <h3 className="text-[var(--ink-700)] text-sm font-semibold">得分汇总</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[var(--cyan-glow)] text-center p-3 rounded-lg">
                      <div className="text-[var(--cyan)] text-lg font-bold">{objScore}/{objMax}</div>
                      <div className="text-[var(--ink-400)] text-[11px] mt-0.5">客观题</div>
                      <div className="text-[var(--sage)] text-[10px] mt-0.5 font-medium">✅ 自动判分</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: pendingSubj.length > 0 ? 'var(--gold-glow)' : 'var(--cyan-glow)' }}>
                      <div className="text-lg font-bold" style={{ color: pendingSubj.length > 0 ? 'var(--gold-dark)' : 'var(--cyan)' }}>{subjScore}/{subjMax}</div>
                      <div className="text-[var(--ink-400)] text-[11px] mt-0.5">主观题</div>
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: pendingSubj.length > 0 ? 'var(--gold-dark)' : 'var(--sage)' }}>
                        {pendingSubj.length > 0 ? '⏳ 待评 ' + pendingSubj.length + '题' : '✅ 已评完'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: isPassed ? 'var(--sage-glow)' : 'var(--verm-glow)' }}>
                      <div className="text-lg font-bold" style={{ color: isPassed ? 'var(--sage)' : 'var(--verm)' }}>{totalScore}/{totalMax}</div>
                      <div className="text-[var(--ink-400)] text-[11px] mt-0.5">总分</div>
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: isPassed ? 'var(--sage)' : 'var(--verm)' }}>
                        {!allGraded ? '⏳ 评阅中' : isPassed ? '✅ 已及格' : '❌ 未及格'}
                      </div>
                    </div>
                    <div className="bg-[var(--paper-dark)] text-center p-3 rounded-lg">
                      <div className="text-[var(--ink-600)] text-lg font-bold">{passScore}分</div>
                      <div className="text-[var(--ink-400)] text-[11px] mt-0.5">及格线</div>
                      <div className="text-[var(--ink-400)] text-[10px] mt-0.5 font-medium">{passRate}%</div>
                    </div>
                  </div>
                  {pendingSubj.length > 0 && (
                    <p className="text-[var(--gold-dark)] text-xs mt-3">
                      待评：{pendingSubj.length} 道主观题（{pendingSubj.map(a => typeNames[a.type]).join('、')}）
                    </p>
                  )}
                </div>
              );
            })()}

            {answers.map((a: any) => {
              const isSub = a.type === 'SHORT_ANSWER' || a.type === 'CASE_STUDY' || a.type === 'ESSAY';
              const graded = a.score !== null;
              const need = isSub && !graded;
              return (
                <div key={a.answerId} className="rounded-xl p-5 bg-[var(--paper-bright)]" style={{  border: `1px solid ${need ? 'var(--gold-light)' : graded ? 'var(--success-pale)' : 'var(--ink-100)'}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--fox-glow)] text-[var(--fox)]" >
                        {isSub ? '✍️' : '☑️'} {typeNames[a.type] || a.type} · {a.maxScore}分
                      </span>
                      {graded ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--sage-glow)] text-[var(--sage)]" >✅ 已评分 {a.score}/{a.maxScore}</span>
                      ) : need ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--gold-glow)] text-[var(--gold-dark)]" >⏳ 待评分</span>
                      ) : !a.yourAnswer ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--paper-dark)] text-[var(--ink-400)]" >❌ 未作答</span>
                      ) : null}
                    </div>
                    {graded && !need && <>
                      <button onClick={() => setReviewModal({ answerId: a.answerId, sessionId: a.sessionId || 0, score: a.score })} className="text-xs ml-2 px-2 py-0.5 rounded text-[var(--ink-400)]" style={{ border: '1px solid var(--ink-200)',  }}>🔍 复核</button>
                      <button onClick={() => {
                        setReGrade({ answerId: a.answerId, paperQuestionId: a.paperQuestionId, maxScore: a.maxScore, currentScore: a.score, currentNote: a.graderNote || '' });
                      }} className="text-xs ml-1 px-2 py-0.5 rounded text-[var(--sage)]" style={{ border: '1px solid var(--sage)',  }}>✏️ 改分</button>
                    </>}
                  </div>
                  <p className="text-[var(--ink-600)] text-sm mb-3">{a.content}</p>
                  <div className="text-sm p-3 rounded-lg mb-3" style={{ background: isSub ? 'var(--fox-pale)' : 'var(--paper-alt)', borderLeft: `3px solid ${isSub ? 'var(--fox-light)' : 'var(--ink-200)'}` }}>
                    <p className="text-[var(--ink-500)] flex items-center gap-1">
                      {isSub ? '✍️ 学员答案：' : '☑️ 学员答案：'}
                    </p>
                    <p className="mt-1 font-medium text-[var(--ink-700)]">
                      {(a.type === 'SHORT_ANSWER' || a.type === 'ESSAY') ? (a.yourAnswer || '未作答') : a.type === 'CASE_STUDY' ? (JSON.stringify(a.yourAnswer) || '未作答') : String(a.yourAnswer ?? '-')}
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
            <div className="rounded-xl p-5 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--ink-100)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[var(--fox)]" style={{ width: 4, height: 14,  borderRadius: 2, display: 'inline-block' }} />
                <span className="text-[var(--ink-600)] text-xs font-semibold">阅卷操作</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowReviews(!showReviews); if (!showReviews) loadReviews(); }} className="btn btn-outline btn-sm">🔍 标记复核 ({reviews.filter((r: any) => r.status === 'PENDING').length})</button>
                <button onClick={() => setAdjustOpen(!adjustOpen)} className="btn btn-outline btn-sm">✏️ 改分</button>
              </div>
            </div>

            {/* 考试管理（仅考务员可见） */}
            {(userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && (
              <div className="rounded-xl p-5 bg-[var(--fox-glow)]" style={{  border: '1px solid var(--fox-light)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[var(--gold-dark)]" style={{ width: 4, height: 14,  borderRadius: 2, display: 'inline-block' }} />
                  <span className="text-[var(--gold-dark)] text-xs font-semibold">考试管理</span>
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
              <div className="rounded-xl p-5 bg-[var(--paper-bright)]" style={{  border: '1px solid var(--gold-light)' }}>
                <p className="text-[var(--ink-600)] text-sm font-medium mb-3">成绩调整（将记录审计日志）</p>
                <div className="flex gap-3 items-end">
                  <div><label className="text-[var(--ink-400)] block text-xs mb-1">调整后分数</label><input type="number" value={adjustScore} onChange={e => setAdjustScore(e.target.value)} className="input w-24" min={0} max={100} /></div>
                  <div className="flex-1"><label className="text-[var(--ink-400)] block text-xs mb-1">调整原因 *</label><input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="如：主观题评分争议复核" className="input" /></div>
                  <button onClick={handleAdjust} disabled={!adjustReason || !adjustScore} className="btn text-sm px-4 py-2 bg-[var(--fox)]" style={{  color: 'white', opacity: !adjustReason || !adjustScore ? 0.5 : 1 }}>确认调整</button>
                </div>
              </div>
            )}

            {showPublishConfirm && (
              <div className="modal-overlay" onClick={() => !publishing && setShowPublishConfirm(false)}>
                <div className="modal-card max-w-[460px]" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3 className="font-serif font-bold text-sm">{allConf ? '🔄 确认重新发布' : '📢 确认发布成绩'}</h3>
                    <button onClick={() => setShowPublishConfirm(false)} disabled={publishing} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
                  </div>
                  <div className="modal-body text-sm space-y-3">
                    {allConf ? (
                      <p className="text-[var(--ink-600)]">成绩已发布过。<strong className="text-[var(--verm)]">已发布的成绩和证书将被覆盖</strong>。确认重新发布？</p>
                    ) : (
                      <>
                        <p className="text-[var(--ink-600)]">
                          本次考试共 <strong>{students.length}</strong> 名学员，发布后将自动发送成绩通知并生成证书。
                        </p>
                        <div className="bg-[var(--fox-glow)] p-3 rounded-lg grid grid-cols-2 gap-2">
                          <div className="text-center">
                            <div className="text-[var(--sage)] text-lg font-bold">
                              {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) >= (exam?.passingScore ?? 60)).length}
                            </div>
                            <div className="text-[var(--ink-400)] text-xs">获证书</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[var(--verm)] text-lg font-bold">
                              {students.filter(s => (s.finalScore ?? s.totalScore ?? 0) < (exam?.passingScore ?? 60)).length}
                            </div>
                            <div className="text-[var(--ink-400)] text-xs">未达及格线</div>
                          </div>
                        </div>
                        <p className="text-[var(--ink-300)] text-xs">成绩发布后学员端将立即看到成绩和证书。</p>
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
          <h3 className="text-[var(--ink-700)] text-sm font-bold mb-3">🔍 复核管理</h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="list-table">
              <thead><tr><th>学员</th><th>原因</th><th>原分</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {reviews.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.session?.student?.displayName || '—'}</td>
                    <td className="text-[var(--ink-400)] text-xs">{r.reason}</td>
                    <td>{r.originalScore}</td>
                    <td><span className={`tag ${r.status === 'PENDING' ? 'tag-gold' : r.status === 'RESOLVED' ? 'tag-cyan' : 'tag-ink'}`}>{r.status}</span></td>
                    <td>
                      {r.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <button onClick={() => { const s = prompt('输入新分数：', String(r.originalScore)); if (s) handleResolveReview(r.id, 'RESOLVED', parseFloat(s)); }} className="btn btn-ghost btn-xs text-[var(--cyan)]" >改分</button>
                          <button onClick={() => handleResolveReview(r.id, 'DISMISSED')} className="btn btn-ghost btn-xs text-[var(--verm)]" >驳回</button>
                        </div>
                      )}
                      {r.status !== 'PENDING' && <span className="text-[var(--ink-300)] text-xs">已处理</span>}
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && <tr><td colSpan={5} className="text-[var(--ink-300)] text-center py-4 text-xs">暂无复核记录</td></tr>}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>

    {reviewModal && (
      <div className="modal-overlay" onClick={() => setReviewModal(null)}>
        <div className="modal-card max-w-[400px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="font-serif font-bold text-sm">标记复核</h3>
            <button onClick={() => setReviewModal(null)} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
          </div>
          <div className="modal-body space-y-3">
            <p className="text-[var(--ink-400)] text-xs">当前得分：{reviewModal.score}</p>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">复核原因 *</label>
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
        <div className="rounded-xl p-6 w-full max-w-md bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
          <h3 className="font-semibold text-base mb-4">改分</h3>
          <div className="space-y-3">
            <p className="text-[var(--ink-400)] text-xs">当前得分：{reGrade.currentScore}/{reGrade.maxScore}</p>
            <div>
              <label className="text-[var(--ink-400)] block text-xs mb-1">新分数（/{reGrade.maxScore}）</label>
              <input type="number" id="reGradeScore" className="input w-full" min={0} max={reGrade.maxScore} defaultValue={reGrade.currentScore} />
            </div>
            <div>
              <label className="text-[var(--ink-400)] block text-xs mb-1">评语</label>
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
    </>
  );
}
