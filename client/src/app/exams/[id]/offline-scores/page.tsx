'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_FLOW: Record<string, { label: string; color: string; next?: string; action?: string }> = {
  DRAFT: { label: '草稿', color: 'var(--ink-300)', next: 'PUBLISHED', action: '发布考试' },
  PUBLISHED: { label: '已发布', color: 'var(--blue)', next: 'AWAITING_GRADING', action: '进入阅卷' },
  AWAITING_GRADING: { label: '待阅卷', color: 'var(--amber)', next: 'GRADING_IN_PROGRESS', action: '开始录入' },
  GRADING_IN_PROGRESS: { label: '录入中', color: 'var(--fox)', next: 'SCORE_CONFIRMED', action: '确认成绩' },
  SCORE_CONFIRMED: { label: '已确认', color: 'var(--green)', next: 'SCORE_PUBLISHED', action: '发布成绩' },
  SCORE_PUBLISHED: { label: '已发布', color: 'var(--green)' },
};

export default function OfflineScoresPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.id);

  const [exam, setExam] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 录入表单
  const [editSession, setEditSession] = useState<any>(null);
  const [scoreForm, setScoreForm] = useState<Record<string, string>>({});
  const [graderName, setGraderName] = useState('');

  // 批量导入
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [examData, scoresData] = await Promise.all([
        api.exams.get(examId),
        api.offlineExams.getScores(examId).catch(() => []),
      ]);
      setExam(examData);
      setSessions(examData.sessions || []);
      setScores(Array.isArray(scoresData) ? scoresData : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [examId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusInfo = STATUS_FLOW[exam?.status] || { label: exam?.status, color: 'var(--ink-400)' };
  const canEnterScores = ['AWAITING_GRADING', 'GRADING_IN_PROGRESS'].includes(exam?.status);
  const canAssignSeats = ['DRAFT', 'PUBLISHED'].includes(exam?.status);
  const canMarkAbsent = ['PUBLISHED', 'AWAITING_GRADING', 'GRADING_IN_PROGRESS'].includes(exam?.status);

  // 状态流转
  const handleStatusAction = async () => {
    if (!exam) return;
    const action = statusInfo.action;
    if (!action) return;
    if (!confirm(`确认执行「${action}」？`)) return;
    try {
      switch (exam.status) {
        case 'DRAFT': await api.offlineExams.publish(examId); break;
        case 'PUBLISHED': await api.offlineExams.startGrading(examId); break;
        case 'AWAITING_GRADING': await api.offlineExams.startScoreEntry(examId); break;
        case 'GRADING_IN_PROGRESS': await api.offlineExams.confirmScores(examId); break;
        case 'SCORE_CONFIRMED': await api.offlineExams.publishScores(examId); break;
      }
      setSuccess(`操作成功：${action}`);
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // 打开录入弹窗
  const openScoreEntry = (session: any) => {
    setEditSession(session);
    const existing = scores.find(s => s.sessionId === session.id);
    if (existing) {
      const form: Record<string, string> = {};
      Object.entries(existing.scoreByType || {}).forEach(([k, v]) => { form[k] = String(v); });
      setScoreForm(form);
      setGraderName(existing.graderName || '');
    } else {
      setScoreForm({});
      setGraderName('');
    }
  };

  // 保存单人成绩
  const saveScore = async () => {
    if (!editSession) return;
    // 覆盖确认：如果已有成绩，需二次确认
    const existing = scores.find(s => s.sessionId === editSession.id);
    if (existing) {
      if (!confirm(`⚠️ 该学员已有成绩（总分 ${existing.totalScore}），确认覆盖？
覆盖将记录审计日志。`)) return;
    }
    setSaving(editSession.id);
    setError('');
    try {
      const scoreByType: Record<string, number> = {};
      Object.entries(scoreForm).forEach(([k, v]) => {
        if (v !== '') scoreByType[k] = parseFloat(v) || 0;
      });
      if (Object.keys(scoreByType).length === 0) { setError('请至少填写一个题型分数'); setSaving(null); return; }
      await api.offlineExams.enterScore(examId, {
        sessionId: editSession.id,
        scoreByType,
        graderName: graderName || undefined,
      });
      setSuccess('成绩已保存');
      setEditSession(null);
      fetchData();
    } catch (e: any) { setError(e.message); }
    setSaving(null);
  };

  // 标记缺考
  const toggleAbsent = async (session: any) => {
    const newAbsent = !session.absent;
    if (newAbsent && !confirm(`确认标记「${session.student?.displayName}」为缺考？`)) return;
    try {
      await api.offlineExams.markAbsent(examId, session.id, newAbsent);
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // 座位分配
  const handleAssignSeats = async () => {
    if (!confirm('确认自动分配座位号？')) return;
    try {
      await api.offlineExams.assignSeats(examId);
      setSuccess('座位号已分配');
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // 创建补考
  const handleCreateRetake = async () => {
    if (!confirm('确认为未通过学员创建补考？（补考仅有一次机会）')) return;
    const startTime = prompt('补考开始时间（格式：2026-08-01T09:00）');
    if (!startTime) return;
    const endTime = prompt('补考结束时间（格式：2026-08-01T11:00）');
    if (!endTime) return;
    try {
      const retake = await api.offlineExams.createRetake(examId, { startTime, endTime });
      setSuccess(`补考已创建（${retake._count?.sessions || 0} 人），ID: ${retake.id}`);
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // 批量导入
  const handleBatchImport = async () => {
    if (!importData.trim()) { setError('请粘贴导入数据'); return; }
    try {
      const lines = importData.trim().split('\n');
      const entries = lines.map(line => {
        const cols = line.split(',').map(c => c.trim());
        const studentId = parseInt(cols[0]);
        const scoreByType: Record<string, number> = {};
        // 假设格式: studentId, singleChoice, multiChoice, ...
        const types = getQuestionTypes();
        types.forEach((t, i) => {
          if (cols[i + 1] !== undefined && cols[i + 1] !== '') scoreByType[t] = parseFloat(cols[i + 1]) || 0;
        });
        return { studentId, scoreByType, graderName: cols[types.length + 1] || '' };
      });
      const result = await api.offlineExams.batchImport(examId, entries);
      if (result.success) {
        setSuccess(`成功导入 ${result.importedCount} 条成绩`);
        setShowImport(false);
        setImportData('');
        fetchData();
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e: any) { setError(e.message); }
  };

  const getQuestionTypes = () => {
    const types = new Set<string>();
    exam?.paper?.questions?.forEach((pq: any) => types.add(pq.question?.type));
    return [...types];
  };

  const typeLabels: Record<string, string> = {
    SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
    FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例',
  };

  if (loading) return <AppLayout><div className="text-[var(--ink-400)] p-8 text-center">加载中…</div></AppLayout>;

  const questionTypes = getQuestionTypes();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">{exam?.title} — 成绩管理</h1>
            <p className="page-subtitle">线下笔试 · 成绩录入与管理</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="tag" style={{ background: statusInfo.color + '18', color: statusInfo.color }}>{statusInfo.label}</span>
            {statusInfo.action && (
              <button onClick={handleStatusAction} className="btn btn-fox btn-sm">{statusInfo.action}</button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>⚠ {error}</div>}
        {success && <div className="mb-4 text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--success-pale)', color: 'var(--green)' }}>✓ {success}</div>}

        {/* 工具栏 */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {canEnterScores && (
            <>
              <button onClick={() => setShowImport(!showImport)} className="btn btn-outline btn-xs">📥 批量导入</button>
              <button onClick={() => window.open(api.offlineExams.importTemplateUrl(examId), '_blank')} className="btn btn-outline btn-xs">📄 下载模板</button>
            </>
          )}
          {canAssignSeats && (
            <button onClick={handleAssignSeats} className="btn btn-outline btn-xs">💺 分配座位</button>
          )}
          <button onClick={() => window.open(api.offlineExams.seatTableExcelUrl(examId), '_blank')} className="btn btn-outline btn-xs">📊 座位表Excel</button>
          <button onClick={() => window.open(api.offlineExams.seatTablePdfUrl(examId), '_blank')} className="btn btn-outline btn-xs">🖨️ 座位表PDF</button>
          {['SCORE_PUBLISHED', 'SCORE_CONFIRMED'].includes(exam?.status) && (
            <button onClick={handleCreateRetake} className="btn btn-outline btn-xs" style={{ borderColor: 'var(--verm)', color: 'var(--verm)' }}>📝 创建补考</button>
          )}
          <button onClick={() => router.push(`/exams/${examId}`)} className="btn btn-ghost btn-xs">← 返回详情</button>
        </div>

        {/* 批量导入面板 */}
        {showImport && (
          <div className="card p-4 mb-4">
            <p className="text-[var(--ink-500)] text-xs font-medium mb-2">
              粘贴 CSV 数据（格式：学员ID,{questionTypes.map(t => typeLabels[t] || t).join(',')},阅卷人）
            </p>
            <textarea value={importData} onChange={e => setImportData(e.target.value)}
              className="input font-mono text-xs" rows={6} placeholder="1,18,16,10,8,张老师&#10;2,20,14,10,6,张老师" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleBatchImport} className="btn btn-fox btn-xs">确认导入</button>
              <button onClick={() => setShowImport(false)} className="btn btn-ghost btn-xs">取消</button>
            </div>
          </div>
        )}

        {/* 成绩表格 */}
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="text-[var(--ink-500)] text-left px-4 py-3 font-medium">座位</th>
                <th className="text-[var(--ink-500)] text-left px-4 py-3 font-medium">学员</th>
                {questionTypes.map(t => (
                  <th key={t} className="text-[var(--ink-500)] text-center px-2 py-3 font-medium">{typeLabels[t] || t}</th>
                ))}
                <th className="text-[var(--ink-500)] text-center px-3 py-3 font-medium">总分</th>
                <th className="text-[var(--ink-500)] text-center px-3 py-3 font-medium">状态</th>
                <th className="text-[var(--ink-500)] text-center px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const score = scores.find(sc => sc.sessionId === s.id);
                return (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--ink-50)', background: s.absent ? 'var(--paper)' : 'white' }}>
                    <td className="text-[var(--ink-400)] px-4 py-2.5">{s.seatNumber || '-'}</td>
                    <td className="px-4 py-2.5 font-medium">{s.student?.displayName || `#${s.studentId}`}</td>
                    {questionTypes.map(t => (
                      <td key={t} className="text-[var(--ink-500)] text-center px-2 py-2.5">
                        {s.absent ? '-' : (score?.scoreByType?.[t] ?? '-')}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2.5 font-bold">
                      {s.absent ? <span className="text-[var(--verm)]">缺考</span> : (score?.totalScore ?? '-')}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {s.absent ? <span className="tag tag-verm">缺考</span> :
                       score ? <span className="tag tag-green">已录入</span> :
                       <span className="tag" style={{ background: 'var(--ink-50)', color: 'var(--ink-400)' }}>待录入</span>}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {(canEnterScores || canMarkAbsent) && (
                        <div className="flex gap-1 justify-center">
                          {canEnterScores && !s.absent && (
                            <button onClick={() => openScoreEntry(s)} className="btn btn-ghost btn-xs" style={{ fontSize: '10px' }}>录入</button>
                          )}
                          {canMarkAbsent && (
                            <button onClick={() => toggleAbsent(s)} className="btn btn-ghost btn-xs" style={{ fontSize: '10px', color: s.absent ? 'var(--green)' : 'var(--verm)' }}>
                              {s.absent ? '取消缺考' : '缺考'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 统计 */}
        <div className="text-[var(--ink-400)] flex gap-4 mt-4 text-xs">
          <span>共 {sessions.length} 人</span>
          <span>已录入 {scores.length} 人</span>
          <span>缺考 {sessions.filter(s => s.absent).length} 人</span>
          <span>通过 {sessions.filter(s => s.isPassed).length} 人</span>
        </div>
      </div>

      {/* 录入弹窗 */}
      {editSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="card p-6 w-[420px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-sm font-bold mb-4">录入成绩 — {editSession.student?.displayName}</h3>
            <div className="space-y-3">
              {questionTypes.map(t => (
                <div key={t} className="flex items-center gap-3">
                  <label className="text-[var(--ink-500)] text-xs w-16 shrink-0">{typeLabels[t] || t}</label>
                  <input type="number" min={0} value={scoreForm[t] || ''}
                    onChange={e => setScoreForm({ ...scoreForm, [t]: e.target.value })}
                    className="input" style={{ width: '100px' }} placeholder="0" />
                </div>
              ))}
              <div className="border-[var(--ink-100)] flex items-center gap-3 pt-2 border-t">
                <label className="text-[var(--ink-500)] text-xs w-16 shrink-0">阅卷人</label>
                <input value={graderName} onChange={e => setGraderName(e.target.value)}
                  className="input" placeholder="阅卷人姓名（可与录入人不同）" />
              </div>
              <p className="text-[var(--ink-300)] text-[10px]">录入人默认为当前登录用户，阅卷人可另填</p>
              <div className="text-[var(--ink-400)] text-xs pt-2">
                总分：{Object.values(scoreForm).reduce((s, v) => s + (parseFloat(v) || 0), 0)}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveScore} disabled={saving === editSession.id} className="btn btn-fox btn-sm">
                {saving === editSession.id ? '保存中…' : '保存'}
              </button>
              <button onClick={() => setEditSession(null)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
