'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import ExamStatusCards from './components/exam-status-cards';
import ExamStudentList from './components/exam-student-list';

export default function ExamDetail() {
  const params = useParams();
  const router = useRouter();
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'finish' | null>(null);
  const refreshRef = useRef<any>(null);

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

  if (loading) return <AppLayout><p className="text-[var(--ink-300)]">加载中…</p></AppLayout>;
  if (!exam) return null;

  const isOffline = exam.examMode === 'OFFLINE';

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{exam.title}</h1>
          <p className="page-subtitle">试卷：{exam.paper?.name || '-'} · 共{students.length}名考生{isOffline ? ' · ✍️ 线下笔试' : ''}</p>
        </div>
        <div className="flex gap-2">
          {exam.status === 'DRAFT' && (
            <>
              <button onClick={() => router.push(`/exams/${exam.id}/edit`)}
                className="btn text-sm px-4 py-2 text-[var(--ink-500)]" style={{ border: '1px solid var(--ink-200)',  }}>
                ✏️ 编辑
              </button>
              <button onClick={handlePublish} className="btn btn-fox text-sm px-4 py-2">发布考试</button>
            </>
          )}
          {!isOffline && exam.status !== 'FINISHED' && exam.status !== 'CANCELLED' && (
            <button onClick={() => setConfirmAction('finish')} className="btn text-sm px-4 py-2 text-[var(--verm)]"
              style={{ border: '1px solid var(--verm)',  }}>结束考试</button>
          )}
          {exam.status === 'DRAFT' && (
            <button onClick={() => setConfirmAction('delete')} className="btn text-sm px-4 py-2 text-[var(--ink-400)]"
              style={{ border: '1px solid var(--ink-200)',  }}>删除</button>
          )}
          {(exam.status === 'FINISHED' || (isOffline && exam.status === 'SCORE_PUBLISHED')) && (
            <>
              {!isOffline && (
                <button onClick={() => router.push(`/grading/${exam.id}`)}
                  className="btn text-sm px-4 py-2 text-[var(--fox)]" style={{ border: '1px solid var(--fox)',  }}>
                  📊 阅卷
                </button>
              )}
              <button onClick={() => router.push(`/exams/${exam.id}/transcript`)}
                className="btn text-sm px-4 py-2 text-[var(--sage)]" style={{ border: '1px solid var(--sage)',  }}>
                📋 成绩单
              </button>
              <button onClick={() => router.push(`/exams/${exam.id}/analysis`)}
                className="btn text-sm px-4 py-2 text-[var(--gold)]" style={{ border: '1px solid var(--gold)',  }}>
                📊 分析
              </button>
              <button onClick={() => router.push(`/exams/${exam.id}/quality-report`)}
                className="btn text-sm px-4 py-2 text-[var(--sage)]" style={{ border: '1px solid var(--sage)',  }}>
                🧪 质检
              </button>
            </>
          )}
          {(exam.status === 'IN_PROGRESS' || exam.status === 'PUBLISHED') && !isOffline && (
            <button onClick={() => router.push(`/proctoring/${exam.id}`)}
              className="btn text-sm px-4 py-2 text-[var(--error)]" style={{ border: '1px solid var(--error)',  }}>
              🎥 监考
            </button>
          )}
          {isOffline && (
            <button onClick={() => router.push(`/exams/${exam.id}/offline-scores`)}
              className="btn text-sm px-4 py-2 text-[var(--fox)]" style={{ border: '1px solid var(--fox)',  }}>
              ✍️ 成绩管理
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <ExamStatusCards exam={exam} students={students} isOffline={isOffline} />

      {/* Info */}
      <div className="rounded-xl p-4 mb-6 text-xs space-y-1 bg-[var(--paper-bright)] text-[var(--ink-500)]" style={{  border: '1px solid var(--ink-100)',  }}>
        <p>📅 {new Date(exam.startTime).toLocaleString('zh-CN')} — {new Date(exam.endTime).toLocaleString('zh-CN')}</p>
        <p>⏱ 单人次限时 {exam.durationMinutes} 分钟 · {exam.timeMode === 'FLEXIBLE' ? '随到随考' : '统一开考'} · {exam.paperMode === 'RANDOM' ? '随机抽题' : '统一试卷'} · {exam.shuffleQuestions ? '题目乱序' : '顺序出题'}</p>
        {exam.program && <p>📚 所属培训项目：{exam.program.name}{exam.program.code ? `（${exam.program.code}）` : ''}</p>}
        {exam.passingScore != null && <p>🎯 合格线：{exam.passingScore} 分</p>}
        {exam.isOpenBook && <p>📖 开卷考试 · 允许携带纸质资料，禁止电子设备</p>}
        {exam.tabSwitchLimit != null && (
          <p>🛡️ 切屏限制 {exam.tabSwitchLimit > 0 ? `${exam.tabSwitchLimit}次后强制交卷` : '不限制'} · {exam.copyProtection ? '禁止复制粘贴' : '允许复制'} · 自动保存每{exam.autoSaveInterval || 30}秒</p>
        )}
      </div>

      {/* Student List */}
      <ExamStudentList
        students={students}
        isOffline={isOffline}
        lastUpdated={lastUpdated}
        examStatus={exam.status}
        onRefresh={loadStudents}
      />

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
