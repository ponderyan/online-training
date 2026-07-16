'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';

export default function ExamDetail() {
  const params = useParams();
  const router = useRouter();
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'finish' | null>(null);
  const refreshRef = useRef<any>(null);

  const loadExam = () => {
    api.exams.get(parseInt(params.id as string)).then(setExam).catch(() => router.push('/exams'));
  };

  const loadStudents = () => {
    api.exams.students(parseInt(params.id as string)).then(s => {
      setStudents(s || []);
      setLastUpdated(new Date().toLocaleTimeString('zh-CN'));
    }).catch(() => {});
  };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.exams.get(parseInt(params.id as string)),
      api.exams.students(parseInt(params.id as string)),
    ]).then(([e, s]) => {
      setExam(e);
      setStudents(s || []);
      setLastUpdated(new Date().toLocaleTimeString('zh-CN'));
    }).catch(() => router.push('/exams')).finally(() => setLoading(false));
  };

  useEffect(loadAll, [params.id]);

  // 自动刷新（考试进行中时每10秒刷新学员状态）
  useEffect(() => {
    if (!exam || exam.status === 'FINISHED') return;
    refreshRef.current = setInterval(loadStudents, 10000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [exam?.status]);

  const handlePublish = async () => {
    await api.exams.publish(parseInt(params.id as string));
    loadAll();
  };
  const handleFinish = async (reason: string) => {
    await api.exams.finish(parseInt(params.id as string));
    setConfirmAction(null);
    loadAll();
  };
  const handleDelete = async (reason: string) => {
    await api.exams.delete(parseInt(params.id as string));
    setConfirmAction(null);
    router.push('/exams');
  };

  if (loading) return <AppLayout><p style={{ color: 'var(--ink-300)' }}>加载中…</p></AppLayout>;
  if (!exam) return null;

  const statusLabels: Record<string, string> = {
    DRAFT: '草稿', PUBLISHED: '已发布', IN_PROGRESS: '进行中', FINISHED: '已结束', CANCELLED: '已取消',
  };

  const sessionStatusLabels: Record<string, string> = {
    ASSIGNED: '未开始', ACTIVE: '考试中', PAUSED: '已断线', SUBMITTED: '已提交',
  };

  const submittedCount = students.filter(s => s.status === 'SUBMITTED').length;
  const activeCount = students.filter(s => s.status === 'ACTIVE').length;
  const pausedCount = students.filter(s => s.status === 'PAUSED').length;
  const pendingCount = students.length - submittedCount - activeCount - pausedCount;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{exam.title}</h1>
          <p className="page-subtitle">试卷：{exam.paper?.name || '-'} · 共{students.length}名考生</p>
        </div>
        <div className="flex gap-2">
          {exam.status === 'DRAFT' && (
            <>
              <button onClick={() => router.push(`/exams/${exam.id}/edit`)}
                className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-500)' }}>
                ✏️ 编辑
              </button>
              <button onClick={handlePublish} className="btn btn-fox text-sm px-4 py-2">发布考试</button>
            </>
          )}
          {exam.status !== 'FINISHED' && exam.status !== 'CANCELLED' && (
            <button onClick={() => setConfirmAction('finish')} className="btn text-sm px-4 py-2"
              style={{ border: '1px solid var(--verm)', color: 'var(--verm)' }}>结束考试</button>
          )}
          {exam.status === 'DRAFT' && (
            <button onClick={() => setConfirmAction('delete')} className="btn text-sm px-4 py-2"
              style={{ border: '1px solid var(--ink-200)', color: 'var(--ink-400)' }}>删除</button>
          )}
          {exam.status === 'FINISHED' && (
            <>
              <button onClick={() => router.push(`/grading/${exam.id}`)}
                className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--fox)', color: 'var(--fox)' }}>
                📊 阅卷
              </button>
              <button onClick={() => router.push(`/exams/${exam.id}/transcript`)}
                className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--sage)', color: 'var(--sage)' }}>
                📋 成绩单
              </button>
              <button onClick={() => router.push(`/exams/${exam.id}/analysis`)}
                className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}>
                📊 分析
              </button>
              <button onClick={() => router.push(`/exams/${exam.id}/quality-report`)}
                className="btn text-sm px-4 py-2" style={{ border: '1px solid var(--sage)', color: 'var(--sage)' }}>
                🧪 质检
              </button>
            </>
          )}
          {(exam.status === 'IN_PROGRESS' || exam.status === 'PUBLISHED') && (
            <button onClick={() => router.push(`/proctoring/${exam.id}`)}
              className="btn text-sm px-4 py-2" style={{ border: '1px solid #ef4444', color: '#ef4444' }}>
              🎥 监考
            </button>
          )}
        </div>
      </div>

      {/* Status Overview — auto-refresh during active exams */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: '考试状态', value: statusLabels[exam.status] || exam.status, color: '#8b8174' },
          { label: '已提交', value: submittedCount, color: '#00897b' },
          { label: '考试中', value: activeCount, color: '#e87a30' },
          { label: '已断线', value: pausedCount, color: '#ef4444' },
          { label: '待参加', value: pendingCount, color: '#5a5348' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4 text-center transition-all" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="rounded-xl p-4 mb-6 text-xs space-y-1" style={{ background: 'white', border: '1px solid var(--ink-100)', color: 'var(--ink-500)' }}>
        <p>📅 {new Date(exam.startTime).toLocaleString('zh-CN')} — {new Date(exam.endTime).toLocaleString('zh-CN')}</p>
        <p>⏱ 单人次限时 {exam.durationMinutes} 分钟 · {exam.timeMode === 'FLEXIBLE' ? '随到随考' : '统一开考'} · {exam.paperMode === 'RANDOM' ? '随机抽题' : '统一试卷'} · {exam.shuffleQuestions ? '题目乱序' : '顺序出题'}</p>
        {exam.program && <p>📚 所属培训项目：{exam.program.name}{exam.program.code ? `（${exam.program.code}）` : ''}</p>}
        {exam.passingScore != null && <p>🎯 合格线：{exam.passingScore} 分</p>}
        {exam.isOpenBook && <p>📖 开卷考试 · 允许携带纸质资料，禁止电子设备</p>}
        {exam.tabSwitchLimit != null && (
          <p>🛡️ 切屏限制 {exam.tabSwitchLimit > 0 ? `${exam.tabSwitchLimit}次后强制交卷` : '不限制'} · {exam.copyProtection ? '禁止复制粘贴' : '允许复制'} · 自动保存每{exam.autoSaveInterval || 30}秒</p>
        )}
      </div>

      {/* Student list / Proctoring table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--ink-100)' }}>
        <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-100)' }}>
          <span>考生状态 · 共{students.length}人</span>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span>更新于 {lastUpdated}
                {exam.status !== 'FINISHED' && exam.status !== 'CANCELLED' && ' · 自动刷新中'}
              </span>
            )}
            <button onClick={loadStudents} className="px-2 py-1 rounded hover:bg-[var(--fox-glow)] transition-colors"
              style={{ border: '1px solid var(--ink-200)' }}>
              🔄 刷新
            </button>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
          {students.map(s => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                  {s.student?.displayName?.[0] || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>{s.student?.displayName || '未知'}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-300)' }}>{s.student?.organization || ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {s.totalScore !== null && <span className="text-xs font-medium" style={{ color: 'var(--sage)' }}>{s.totalScore}分</span>}
                <span className="text-xs px-2.5 py-1 rounded-full" style={{
                  background: s.status === 'SUBMITTED' ? '#e8f5e9' : s.status === 'ACTIVE' ? '#fff3e0' : '#f5f5f5',
                  color: s.status === 'SUBMITTED' ? '#2e7d32' : s.status === 'ACTIVE' ? '#e65100' : '#757575',
                }}>
                  {sessionStatusLabels[s.status] || s.status}
                </span>
                {s.suspicionLevel > 0 && <span className="text-xs">⚠️ 异常{s.suspicionLevel}</span>}
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无考生</div>
          )}
        </div>
      </div>
      <ReasonConfirmModal
        open={confirmAction !== null}
        title={confirmAction === 'delete' ? '🗑 删除考试' : '🛑 结束考试'}
        message={confirmAction === 'delete'
          ? '确定删除该考试场次？此操作不可撤销。'
          : '确定结束考试？未提交学员将被强制收卷。'}
        required
        presetReasons={confirmAction === 'delete'
          ? ['创建错误', '考试安排取消', '重复创建']
          : ['考试时间已到', '所有学员已交卷', '考试异常需终止']}
        confirmText={confirmAction === 'delete' ? '确认删除' : '确认结束'}
        onConfirm={confirmAction === 'delete' ? handleDelete : handleFinish}
        onCancel={() => setConfirmAction(null)}
      />
    </AppLayout>
  );
}
