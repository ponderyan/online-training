'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { STATUS_NAMES, STATUS_COLORS, NEXT_STATUS } from './program-constants';
import HoursTab from './hours-tab';
import DashboardTab from './dashboard-tab';
import StudentsTab from './students-tab';
import ScheduleTab from './schedule-tab';
import EvaluationsTab from './evaluations-tab';
import StatusTab from './status-tab';
import AttendanceTab from './attendance-tab';
import EvidencesTab from './evidences-tab';
import FilingTab from './filing-tab';

const TAB_LABELS: Record<string, string> = {
  students: '👥 学员名单', exams: '📋 考试', dashboard: '📊 数据看板', schedule: '📅 课表',
  evaluations: '⭐ 评价', status: '🔄 状态流转', attendance: '✅ 出勤', evidences: '📎 证据',
  filing: '🏢 备案', hours: '⏱ 学时',
};

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');

  // Status modal（页头状态流转按钮触发）
  const [statusModal, setStatusModal] = useState<{ target: string; label: string; confirm?: string } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);

  const openStatusModal = (action: { target: string; label: string; confirm?: string }) => {
    setStatusModal(action);
    setStatusReason('');
  };

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    setStatusChanging(true);
    try {
      await api.trainingPrograms.updateStatus(Number(params.id), statusModal.target, statusReason || undefined);
      setStatusModal(null);
      load();
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setStatusChanging(false);
  };

  const load = async () => {
    try {
      const p = await api.trainingPrograms.get(Number(params.id));
      setProgram(p);
    } catch { router.push('/programs'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <AppLayout><div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载… 🦊</div></AppLayout>;
  if (!program) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/programs')} className="text-xs bg-transparent border-none cursor-pointer mb-4 text-[var(--fox)]" >← 返回培训班列表</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[var(--ink-300)] text-xs font-mono">{program.code}</span>
            <span className="tag" style={{
              background: `color-mix(in srgb, ${STATUS_COLORS[program.status] || 'var(--neutral-400)'} 10%, transparent)`,
              color: STATUS_COLORS[program.status] || 'var(--neutral-400)',
              padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            }}>{STATUS_NAMES[program.status] || program.status}</span>
          </div>
          <h1 className="page-title">{program.name}</h1>
          <p className="page-subtitle">{program.courseName}</p>
        </div>
        <div className="flex gap-2">
          {(NEXT_STATUS[program.status] || []).map(action => (
            <button key={action.target} onClick={() => openStatusModal(action)}
              className="btn btn-sm text-[#fff]" style={{ background: action.target === 'PREPARING' ? 'var(--verm)' : 'var(--fox)',  border: 'none' }}>
              {action.label}
            </button>
          ))}
          {(program.status === 'PREPARING' || program.status === 'ENROLLING') && (
            <button onClick={() => router.push(`/programs/${params.id}/edit`)} className="btn btn-outline btn-sm">编辑</button>
          )}
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-[var(--ink-400)] text-xs">课程全称</span><p>{program.courseName}</p></div>
          <div><span className="text-[var(--ink-400)] text-xs">时间</span><p>{program.startDate?.slice(0,10)} ~ {program.endDate?.slice(0,10)}</p></div>
          <div><span className="text-[var(--ink-400)] text-xs">报名</span><p>{program.enrollStart?.slice(0,10)} ~ {program.enrollEnd?.slice(0,10)}</p></div>
          <div><span className="text-[var(--ink-400)] text-xs">费用</span><p>培训 ¥{program.tuitionFee || 0} / 考试 ¥{program.examFee || 0} / 证书 ¥{program.certFee || 0}</p></div>
          <div><span className="text-[var(--ink-400)] text-xs">人数</span><p>{program.enrolledCount || 0}{program.maxStudents ? ` / ${program.maxStudents}` : ''}</p></div>
          <div><span className="text-[var(--ink-400)] text-xs">班主任</span><p>{program.headTeacher || '—'}</p></div>
        </div>
      </div>

      <div className="flex gap-1 mb-5 p-0.5 rounded-lg bg-[var(--paper-dark)]" style={{  width: 'fit-content' }}>
        {Object.keys(TAB_LABELS).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: activeTab === tab ? 'var(--paper)' : 'transparent', color: activeTab === tab ? 'var(--fox)' : 'var(--ink-400)', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'students' && <StudentsTab enrollments={program.enrollments || []} />}

      {activeTab === 'exams' && (
        <div className="text-[var(--ink-300)] card p-10 text-center text-xs">
          暂无关联考试。可在创建考试时选择此培训班。
        </div>
      )}

      {activeTab === 'dashboard' && <DashboardTab programId={params.id as string} />}

      {activeTab === 'schedule' && <ScheduleTab programId={Number(params.id)} defaultLocation={program.location} />}

      {activeTab === 'evaluations' && <EvaluationsTab programId={Number(params.id)} />}

      {activeTab === 'status' && <StatusTab programId={Number(params.id)} status={program.status} />}

      {activeTab === 'attendance' && <AttendanceTab programId={Number(params.id)} programStatus={program.status} />}

      {activeTab === 'evidences' && <EvidencesTab programId={Number(params.id)} programName={program.name} />}

      {activeTab === 'hours' && <HoursTab programId={params.id as string} />}

      {activeTab === 'filing' && <FilingTab programId={Number(params.id)} onProgramChanged={load} />}

      {/* Status Change Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStatusModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-md bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-2">确认{statusModal.label}</h3>
            <p className="text-[var(--ink-400)] text-sm mb-4">{statusModal.confirm || '确认执行此操作？'}</p>
            <div className="mb-4">
              <label className="text-[var(--ink-400)] text-xs mb-1 block">备注原因</label>
              <textarea value={statusReason} onChange={e => setStatusReason(e.target.value)}
                className="input w-full" rows={3} placeholder="填写操作原因（可选）" />
            </div>
            <div className="flex gap-3">
              <button onClick={confirmStatusChange} disabled={statusChanging}
                className="btn btn-fox btn-sm">{statusChanging ? '操作中…' : '确认'}</button>
              <button onClick={() => setStatusModal(null)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
