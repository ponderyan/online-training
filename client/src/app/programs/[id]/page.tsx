'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS_NAMES: Record<string, string> = {
  PREPARING: '筹备中', ENROLLING: '报名中', IN_PROGRESS: '进行中',
  REVIEWING: '待审核', CERTIFYING: '发证中', COMPLETED: '已结业', CANCELLED: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  PREPARING: '#8b8174', ENROLLING: '#00897b', IN_PROGRESS: '#e87a30',
  REVIEWING: '#e87a30', CERTIFYING: '#7b1fa2', COMPLETED: '#2e7d32', CANCELLED: '#aaa',
};
const NEXT_STATUS: Record<string, { label: string; target: string; confirm?: string }[]> = {
  PREPARING: [{ label: '开放报名', target: 'ENROLLING', confirm: '确认开放报名？报名开始后学员可自主报名。' }],
  ENROLLING: [{ label: '开始培训', target: 'IN_PROGRESS', confirm: '确认开始培训？开课后将锁定学员名单。' }],
  IN_PROGRESS: [{ label: '提交审核', target: 'REVIEWING', confirm: '确认提交审核？提交后等待协会审核。' }],
  REVIEWING: [
    { label: '批准发证', target: 'CERTIFYING', confirm: '确认批准发证？将触发证书批量生成。' },
    { label: '退回筹备', target: 'PREPARING', confirm: '退回到筹备阶段？退回后可修改信息重新提交。' },
  ],
  CERTIFYING: [{ label: '完成结业', target: 'COMPLETED', confirm: '确认完成结业？此操作不可逆。' }],
};

const LEVEL_NAMES: Record<string, string> = {
  JUNIOR: '初级', MIDDLE: '中级', SENIOR: '高级', EXPERT: '专家',
};

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');

  // Status modal
  const [statusModal, setStatusModal] = useState<{ target: string; label: string; confirm?: string } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);

  // Status logs
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Phase 1c: 出勤
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [editAttendance, setEditAttendance] = useState<Record<number, string>>({});
  const [attendanceReason, setAttendanceReason] = useState('');
  const [attendanceSaving, setAttendanceSaving] = useState<number | null>(null);

  // Phase 1c: 证据
  const [evidences, setEvidences] = useState<any[]>([]);
  const [evidencesLoading, setEvidencesLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('ATTENDANCE_SHEET');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [signinGenerating, setSigninGenerating] = useState(false);

  // Phase 1c: 备案
  const [filing, setFiling] = useState<any>(null);
  const [filingLoading, setFilingLoading] = useState(false);
  const [filingModal, setFilingModal] = useState(false);
  const [filingForm, setFilingForm] = useState({ agencyName: '', agencyContact: '', agencyPhone: '' });
  const [filingSubmitting, setFilingSubmitting] = useState(false);

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
    } catch (e: any) { alert('操作失败：' + e.message); }
    setStatusChanging(false);
  };

  const loadStatusLogs = async () => {
    setLogsLoading(true);
    try { setStatusLogs(await api.trainingPrograms.getStatusLogs(Number(params.id)) || []); } catch {}
    setLogsLoading(false);
  };

  // Schedule modal state
  const [schedules, setSchedules] = useState<any[]>([]);
  // Evaluations state
  const [evals, setEvals] = useState<any[]>([]);
  const [evalStats, setEvalStats] = useState<any>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState<any>({
    courseId: '', instructorId: '', startTime: '', endTime: '', location: '', remark: '',
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const load = async () => {
    try {
      const p = await api.trainingPrograms.get(Number(params.id));
      setProgram(p);
    } catch { router.push('/programs'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Phase 1c: 出勤
  const loadAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const data = await api.trainingPrograms.getAttendance(Number(params.id));
      setAttendanceRecords(data || []);
      const edits: Record<number, string> = {};
      (data || []).forEach((r: any) => { edits[r.id] = r.actualDays?.toString() || '0'; });
      setEditAttendance(edits);
    } catch {}
    setAttendanceLoading(false);
  };

  // Phase 1c: 证据
  const loadEvidences = async () => {
    setEvidencesLoading(true);
    try { setEvidences(await api.trainingPrograms.getEvidences(Number(params.id)) || []); } catch {}
    setEvidencesLoading(false);
  };

  // Phase 1c: 备案
  const loadFiling = async () => {
    setFilingLoading(true);
    try {
      const all = await api.filing.list({ pageSize: 100 });
      const progFiling = (all.items || []).find((f: any) => f.programId === Number(params.id) || f.program?.id === Number(params.id));
      setFiling(progFiling || null);
    } catch {}
    setFilingLoading(false);
  };

  const loadSchedules = async () => {
    try {
      const data = await api.schedules.getByProgram(Number(params.id));
      setSchedules(data || []);
    } catch {}
  };

  // Load schedules when tab changes
  useEffect(() => {
    if (activeTab === 'schedule') loadSchedules();
    if (activeTab === 'evaluations') loadEvaluations();
    if (activeTab === 'status') loadStatusLogs();
    if (activeTab === 'attendance') loadAttendance();
    if (activeTab === 'evidences') loadEvidences();
    if (activeTab === 'filing') loadFiling();
  }, [activeTab]);

  const loadEvaluations = async () => {
    try {
      const [ev, st] = await Promise.all([
        api.evaluations.byProgram(Number(params.id)).catch(() => []),
        api.evaluations.programStats(Number(params.id)).catch(() => null),
      ]);
      setEvals(ev as any[] || []);
      setEvalStats(st);
    } catch {}
  };

  // Schedule handlers
  const openNewSchedule = async () => {
    try {
      const [c, i] = await Promise.all([
        api.courses.list({ pageSize: '200' }),
        api.instructors.list({ pageSize: '200' }),
      ]);
      setCourses(c.items || []);
      setInstructors(i.items?.filter((x: any) => x.status === 'ACTIVE') || []);
    } catch {}
    setEditingSchedule(null);
    setScheduleForm({
      courseId: '', instructorId: '', startTime: '', endTime: '',
      location: program?.location || '', remark: '',
    });
    setShowScheduleModal(true);
  };

  const openEditSchedule = async (s: any) => {
    try {
      const [c, i] = await Promise.all([
        api.courses.list({ pageSize: '200' }),
        api.instructors.list({ pageSize: '200' }),
      ]);
      setCourses(c.items || []);
      setInstructors(i.items?.filter((x: any) => x.status === 'ACTIVE') || []);
    } catch {}
    setEditingSchedule(s);
    setScheduleForm({
      courseId: s.courseId?.toString() || '',
      instructorId: s.instructorId?.toString() || '',
      startTime: s.startTime?.slice(0, 16) || '',
      endTime: s.endTime?.slice(0, 16) || '',
      location: s.location || program?.location || '',
      remark: s.remark || '',
    });
    setShowScheduleModal(true);
  };

  const handleScheduleSave = async () => {
    if (!scheduleForm.courseId || !scheduleForm.startTime || !scheduleForm.endTime) {
      alert('请填写课程、开始时间和结束时间'); return;
    }
    setScheduleLoading(true);
    try {
      const data = {
        programId: Number(params.id),
        courseId: parseInt(scheduleForm.courseId),
        instructorId: scheduleForm.instructorId ? parseInt(scheduleForm.instructorId) : null,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        location: scheduleForm.location || null,
        remark: scheduleForm.remark || null,
      };
      if (editingSchedule) {
        await api.schedules.update(editingSchedule.id, data);
      } else {
        await api.schedules.create(data);
      }
      setShowScheduleModal(false);
      loadSchedules();
    } catch (e: any) { alert('操作失败：' + e.message); }
    setScheduleLoading(false);
  };

  const handleScheduleDelete = async (id: number) => {
    if (!confirm('确定删除该排课记录吗？')) return;
    try { await api.schedules.delete(id); loadSchedules(); }
    catch (e: any) { alert('删除失败：' + e.message); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!program) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/programs')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回培训班列表</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{program.code}</span>
            <span className="tag" style={{
              background: `${STATUS_COLORS[program.status] || '#888'}18`,
              color: STATUS_COLORS[program.status] || '#888',
              padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            }}>{STATUS_NAMES[program.status] || program.status}</span>
          </div>
          <h1 className="page-title">{program.name}</h1>
          <p className="page-subtitle">{program.courseName}</p>
        </div>
        <div className="flex gap-2">
          {(NEXT_STATUS[program.status] || []).map(action => (
            <button key={action.target} onClick={() => openStatusModal(action)}
              className="btn btn-sm" style={{ background: action.target === 'PREPARING' ? 'var(--verm)' : 'var(--fox)', color: '#fff', border: 'none' }}>
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
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>课程全称</span><p>{program.courseName}</p></div>
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>时间</span><p>{program.startDate?.slice(0,10)} ~ {program.endDate?.slice(0,10)}</p></div>
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>报名</span><p>{program.enrollStart?.slice(0,10)} ~ {program.enrollEnd?.slice(0,10)}</p></div>
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>费用</span><p>培训 ¥{program.tuitionFee || 0} / 考试 ¥{program.examFee || 0} / 证书 ¥{program.certFee || 0}</p></div>
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>人数</span><p>{program.enrolledCount || 0}{program.maxStudents ? ` / ${program.maxStudents}` : ''}</p></div>
          <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>班主任</span><p>{program.headTeacher || '—'}</p></div>
        </div>
      </div>

      <div className="flex gap-1 mb-5 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {['students', 'exams', 'schedule', 'evaluations', 'status', 'attendance', 'evidences', 'filing'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: activeTab === tab ? 'var(--paper)' : 'transparent', color: activeTab === tab ? 'var(--fox)' : 'var(--ink-400)', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {tab === 'students' ? '👥 学员名单' : tab === 'exams' ? '📋 考试' : tab === 'schedule' ? '📅 课表' : tab === 'evaluations' ? '⭐ 评价' : tab === 'status' ? '🔄 状态流转' : tab === 'attendance' ? '✅ 出勤' : tab === 'evidences' ? '📎 证据' : '🏢 备案'}
          </button>
        ))}
      </div>

      {activeTab === 'students' && (
        <div className="card p-0 overflow-hidden">
          {(!program.enrollments || program.enrollments.length === 0) ? (
            <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无学员报名</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="list-table">
                <thead><tr>
                  <th>序号</th>
                  <th>姓名</th>
                  <th>手机号</th>
                  <th>推荐单位</th>
                  <th>报名来源</th>
                  <th>报名时间</th>
                  <th>缴费金额</th>
                  <th>缴费时间</th>
                  <th>报名状态</th>
                </tr></thead>
                <tbody>{program.enrollments.map((e: any, i: number) => {
                  const feeStatusNames: Record<string, string> = { UNPAID: '未缴费', PAID: '已缴费', REFUNDED: '已退款', PARTIAL: '部分缴费' };
                  const enrollStatusNames: Record<string, string> = { ENROLLED: '已报名', COMPLETED: '已完成', CANCELLED: '已取消', DROPPED: '已退学' };
                  return (
                    <tr key={e.id}>
                      <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</td>
                      <td className="font-medium">{e.student?.displayName || '—'}</td>
                      <td>{e.student?.phone || '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{e.student?.organization || e.agency?.name || '—'}</td>
                      <td className="text-xs">{e.enrollSource || '系统录入'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{e.createdAt ? new Date(e.createdAt).toLocaleDateString('zh-CN') : '—'}</td>
                      <td>{e.feeAmount ? `¥${e.feeAmount.toLocaleString()}` : '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{e.paidAt ? new Date(e.paidAt).toLocaleDateString('zh-CN') : '—'}</td>
                      <td>
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                          background: e.feeStatus === 'PAID' ? '#00897b18' : e.feeStatus === 'REFUNDED' ? '#e5393518' : '#8b817418',
                          color: e.feeStatus === 'PAID' ? '#00897b' : e.feeStatus === 'REFUNDED' ? '#e53935' : '#8b8174',
                        }}>
                          {feeStatusNames[e.feeStatus] || e.feeStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="card p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>
          暂无关联考试。可在创建考试时选择此培训班。
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={openNewSchedule} className="btn btn-fox btn-sm">➕ 添加排课</button>
          </div>
          <div className="card p-0 overflow-hidden">
            {schedules.length === 0 ? (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无排课记录</div>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>课程</th>
                    <th>讲师</th>
                    <th>地点</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s: any) => (
                    <tr key={s.id}>
                      <td>{new Date(s.startTime).toLocaleString('zh-CN')}</td>
                      <td>{new Date(s.endTime).toLocaleString('zh-CN')}</td>
                      <td className="font-medium">{s.course?.name || '—'}</td>
                      <td>{s.instructor ? `${s.instructor.realName}${s.instructor.title ? ` (${s.instructor.title})` : ''}` : '—'}</td>
                      <td>{s.location || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openEditSchedule(s)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>编辑</button>
                          <button onClick={() => handleScheduleDelete(s.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'evaluations' && (
        <div>
          {evalStats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: '评价人数', value: evalStats.count, color: 'var(--ink-600)' },
                { label: '课程内容', value: `${'★'.repeat(Math.floor(evalStats.contentRating))}${evalStats.contentRating % 1 >= 0.5 ? '☆' : ''} ${evalStats.contentRating}`, color: 'var(--fox)' },
                { label: '讲师教学', value: `${'★'.repeat(Math.floor(evalStats.instructorRating))} ${evalStats.instructorRating}`, color: 'var(--cyan)' },
                { label: '总体评分', value: `${'★'.repeat(Math.floor(evalStats.overallRating))} ${evalStats.overallRating}`, color: 'var(--sage)' },
              ].map((s, i) => (
                <div key={i} className="card p-4 text-center">
                  <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <table className="list-table">
              <thead><tr><th>学员</th><th>时间</th><th>内容</th><th>讲师</th><th>总体</th><th>评语</th></tr></thead>
              <tbody>
                {evals.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.isAnonymous ? '匿名' : e.student?.displayName || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="text-center">{'★'.repeat(e.contentRating)}</td>
                    <td className="text-center">{'★'.repeat(e.instructorRating)}</td>
                    <td className="text-center"><strong style={{ color: e.overallRating >= 4 ? 'var(--sage)' : e.overallRating >= 3 ? 'var(--gold)' : 'var(--verm)' }}>{'★'.repeat(e.overallRating)}</strong></td>
                    <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>{e.comment || '—'}</td>
                  </tr>
                ))}
                {evals.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--ink-300)' }}>暂无评价</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div>
          <div className="card p-5 mb-6 text-center">
            <div className="text-xs mb-2" style={{ color: 'var(--ink-400)' }}>当前状态</div>
            <div className="text-2xl font-bold mb-1" style={{ color: STATUS_COLORS[program.status] || '#888' }}>
              {STATUS_NAMES[program.status] || program.status}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-700)' }}>状态变更记录</h3>
            <div className="relative pl-8">
              <div className="absolute left-3.5 top-2 bottom-2 w-0.5" style={{ background: 'var(--ink-200)' }} />
              {logsLoading ? (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
              ) : statusLogs.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无状态变更记录</div>
              ) : statusLogs.map((log: any) => (
                <div key={log.id} className="relative pb-6">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2"
                    style={{ background: 'var(--paper)', borderColor: STATUS_COLORS[log.toStatus] || '#888' }} />
                  <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </div>
                  <div className="text-sm mt-0.5">
                    <span style={{ color: STATUS_COLORS[log.fromStatus] || '#888' }}>
                      {STATUS_NAMES[log.fromStatus] || log.fromStatus || '初始'}
                    </span>
                    {' → '}
                    <span style={{ color: STATUS_COLORS[log.toStatus] || '#888', fontWeight: 600 }}>
                      {STATUS_NAMES[log.toStatus] || log.toStatus}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                    {log.operator?.displayName || '系统'}{log.reason ? ` · ${log.reason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{attendanceRecords.length}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>学员总数</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: '#00897b' }}>
                {attendanceRecords.length > 0
                  ? Math.round(attendanceRecords.reduce((s, r) => s + (r.attendanceRate || 0), 0) / attendanceRecords.length)
                  : 0}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>平均出勤率</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: '#1565c0' }}>{attendanceRecords[0]?.totalDays || 0}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>总排课天数</div>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            {attendanceLoading ? (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无出勤记录，请先添加学员和排课</div>
            ) : (
              <table className="list-table">
                <thead><tr><th>序号</th><th>姓名</th><th>推荐单位</th><th>总天数</th><th>实际出勤</th><th>出勤率</th><th>操作</th></tr></thead>
                <tbody>
                  {attendanceRecords.map((r: any, i: number) => {
                    const canEdit = program.status === 'IN_PROGRESS' || program.status === 'REVIEWING';
                    const saving = attendanceSaving === r.id;
                    return (
                      <tr key={r.id}>
                        <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{i + 1}</td>
                        <td className="font-medium">{r.student?.displayName || '—'}</td>
                        <td style={{ color: 'var(--ink-400)' }} className="text-xs">{r.student?.organization || '—'}</td>
                        <td>{r.totalDays}</td>
                        <td>
                          {canEdit ? (
                            <input type="number" min={0} max={r.totalDays}
                              value={editAttendance[r.id] ?? r.actualDays ?? 0}
                              onChange={e => setEditAttendance({ ...editAttendance, [r.id]: e.target.value })}
                              className="input" style={{ width: 70 }} />
                          ) : (
                            <span>{r.actualDays ?? 0}</span>
                          )}
                        </td>
                        <td><span className="font-semibold" style={{ color: (r.attendanceRate || 0) >= 80 ? '#00897b' : '#e87a30' }}>{r.attendanceRate || 0}%</span></td>
                        <td>
                          {canEdit && (
                            <button onClick={async () => {
                              setAttendanceSaving(r.id);
                              try {
                                await api.trainingPrograms.updateAttendance(Number(params.id), r.studentId || r.student?.id, {
                                  actualDays: parseInt(editAttendance[r.id] || '0'),
                                  reason: '管理员编辑',
                                });
                                loadAttendance();
                              } catch (e: any) { alert('保存失败：' + e.message); }
                              setAttendanceSaving(null);
                            }} disabled={saving} className="btn btn-outline btn-xs text-xs">
                              {saving ? '保存中…' : '保存'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'evidences' && (
        <div>
          <div className="flex gap-3 mb-4">
            <button onClick={async () => {
              setSigninGenerating(true);
              try {
                const res = await fetch(`/api/training-programs/${params.id}/generate-signin-sheet`, {
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `签到表_${program.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) { alert('生成失败：' + e.message); }
              setSigninGenerating(false);
            }} disabled={signinGenerating} className="btn btn-fox btn-sm">
              {signinGenerating ? '生成中…' : '📄 生成签到表'}
            </button>
            <button onClick={() => setUploadModal(true)} className="btn btn-outline btn-sm">📎 上传证据文件</button>
          </div>

          <div className="card p-0 overflow-hidden">
            {evidencesLoading ? (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</div>
            ) : evidences.length === 0 ? (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-300)' }}>暂无证据文件</div>
            ) : (
              <table className="list-table">
                <thead><tr><th>文件名</th><th>类型</th><th>上传者</th><th>上传时间</th><th>备注</th><th>操作</th></tr></thead>
                <tbody>
                  {evidences.map((e: any) => (
                    <tr key={e.id}>
                      <td>
                        <a href={api.trainingPrograms.downloadEvidence(Number(params.id), e.id)}
                          target="_blank" className="text-sm" style={{ color: 'var(--fox)' }}>{e.fileName}</a>
                      </td>
                      <td><span className="tag" style={{
                        background: e.evidenceType === 'ATTENDANCE_SHEET' ? '#00897b18' : '#8b817418',
                        color: e.evidenceType === 'ATTENDANCE_SHEET' ? '#00897b' : '#8b8174',
                        fontSize: '10px',
                      }}>{e.evidenceType === 'ATTENDANCE_SHEET' ? '签到表' : e.evidenceType === 'SCORING' ? '成绩表' : e.evidenceType === 'SCHEDULE' ? '排课表' : '其他'}</span></td>
                      <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{e.uploadedBy?.displayName || '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                      <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{e.notes || '—'}</td>
                      <td>
                        <button onClick={async () => {
                          if (!confirm('确定删除该文件？')) return;
                          try { await api.trainingPrograms.deleteEvidence(Number(params.id), e.id); loadEvidences(); }
                          catch (e: any) { alert('删除失败：' + e.message); }
                        }} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Upload Modal */}
          {uploadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !uploading && setUploadModal(false)}>
              <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold text-base mb-4">上传证据文件</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>文件</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="input w-full" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>证据类型</label>
                    <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="input select w-full">
                      <option value="ATTENDANCE_SHEET">签到表</option>
                      <option value="SCORING">成绩表</option>
                      <option value="SCHEDULE">排课表</option>
                      <option value="OTHER">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>备注</label>
                    <input value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} className="input w-full" placeholder="可选" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={async () => {
                      if (!uploadFile) { alert('请选择文件'); return; }
                      setUploading(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', uploadFile);
                        fd.append('evidenceType', uploadType);
                        fd.append('notes', uploadNotes);
                        await api.trainingPrograms.uploadEvidence(Number(params.id), fd);
                        setUploadModal(false);
                        setUploadFile(null);
                        setUploadNotes('');
                        loadEvidences();
                      } catch (e: any) { alert('上传失败：' + e.message); }
                      setUploading(false);
                    }} disabled={uploading} className="btn btn-fox btn-sm">{uploading ? '上传中…' : '上传'}</button>
                    <button onClick={() => setUploadModal(false)} className="btn btn-outline btn-sm">取消</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'filing' && (
        <div>
          <div className="card p-5 mb-6 text-center">
            <div className="text-xs mb-2" style={{ color: 'var(--ink-400)' }}>备案状态</div>
            <div className="text-2xl font-bold mb-1" style={{
              color: !filing ? '#8b8174' : filing.status === 'PENDING' ? '#e87a30' : filing.status === 'APPROVED' ? '#2e7d32' : '#e53935',
            }}>
              {!filing ? '未提交' : filing.status === 'PENDING' ? '待审核' : filing.status === 'APPROVED' ? '已通过' : '已驳回'}
            </div>
          </div>

          {!filing && (
            <div className="card p-6 text-center">
              <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>尚未提交备案</p>
              <button onClick={async () => {
                const evs = await api.trainingPrograms.getEvidences(Number(params.id)).catch(() => []);
                if (!evs || evs.length === 0) { alert('请先上传签到表扫描件后再提交备案'); return; }
                setFilingForm({ agencyName: '', agencyContact: '', agencyPhone: '' });
                setFilingModal(true);
              }} className="btn btn-fox">提交备案</button>
            </div>
          )}

          {filing && (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3">审核信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>机构名称</span><p>{filing.agencyName}</p></div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>联系人</span><p>{filing.agencyContact} ({filing.agencyPhone})</p></div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>提交人</span><p>{filing.submittedBy?.displayName || '—'}</p></div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>提交时间</span><p>{filing.submittedAt ? new Date(filing.submittedAt).toLocaleString('zh-CN') : '—'}</p></div>
                </div>
              </div>

              {filing.reviewedBy && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-3">审核记录</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核人</span><p>{filing.reviewedBy?.displayName || '—'}</p></div>
                    <div><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核时间</span><p>{filing.reviewedAt ? new Date(filing.reviewedAt).toLocaleString('zh-CN') : '—'}</p></div>
                  </div>
                  {filing.reviewComment && (
                    <div className="mt-2"><span className="text-xs" style={{ color: 'var(--ink-400)' }}>审核意见</span><p className="text-sm mt-1">{filing.reviewComment}</p></div>
                  )}
                </div>
              )}

              {filing.status === 'APPROVED' && (
                <div className="card p-5 text-center" style={{ background: '#2e7d3208' }}>
                  <p className="text-sm font-semibold" style={{ color: '#2e7d32' }}>✅ 备案已通过</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>培训班状态已自动更新为「报名中」</p>
                </div>
              )}
            </div>
          )}

          {/* Filing Submit Modal */}
          {filingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFilingModal(false)}>
              <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold text-base mb-4">提交备案</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>机构名称 *</label>
                    <input value={filingForm.agencyName} onChange={e => setFilingForm({ ...filingForm, agencyName: e.target.value })} className="input w-full" placeholder="例如：XX培训机构" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>联系人 *</label>
                    <input value={filingForm.agencyContact} onChange={e => setFilingForm({ ...filingForm, agencyContact: e.target.value })} className="input w-full" placeholder="姓名" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>联系电话 *</label>
                    <input value={filingForm.agencyPhone} onChange={e => setFilingForm({ ...filingForm, agencyPhone: e.target.value })} className="input w-full" placeholder="手机号" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={async () => {
                      if (!filingForm.agencyName || !filingForm.agencyContact || !filingForm.agencyPhone) {
                        alert('请填写完整信息'); return;
                      }
                      setFilingSubmitting(true);
                      try {
                        await api.trainingPrograms.submitFiling(Number(params.id), filingForm);
                        setFilingModal(false);
                        loadFiling();
                        load();
                      } catch (e: any) { alert('提交失败：' + e.message); }
                      setFilingSubmitting(false);
                    }} disabled={filingSubmitting} className="btn btn-fox btn-sm">{filingSubmitting ? '提交中…' : '提交'}</button>
                    <button onClick={() => setFilingModal(false)} className="btn btn-outline btn-sm">取消</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowScheduleModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">{editingSchedule ? '编辑排课' : '添加排课'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程 *</label>
                <select value={scheduleForm.courseId} onChange={e => setScheduleForm({ ...scheduleForm, courseId: e.target.value })} className="input select w-full">
                  <option value="">选择课程…</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>讲师</label>
                <select value={scheduleForm.instructorId} onChange={e => setScheduleForm({ ...scheduleForm, instructorId: e.target.value })} className="input select w-full">
                  <option value="">不指定</option>
                  {instructors.map((i: any) => <option key={i.id} value={i.id}>{i.realName}{i.title ? ` (${i.title})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>开始时间 *</label>
                  <input type="datetime-local" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>结束时间 *</label>
                  <input type="datetime-local" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>上课地点</label>
                <input value={scheduleForm.location} onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })} className="input w-full" placeholder={program?.location || '默认使用培训班地点'} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>备注</label>
                <input value={scheduleForm.remark} onChange={e => setScheduleForm({ ...scheduleForm, remark: e.target.value })} className="input w-full" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleScheduleSave} disabled={scheduleLoading} className="btn btn-fox btn-sm">{scheduleLoading ? '保存中…' : '保存'}</button>
                <button onClick={() => setShowScheduleModal(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStatusModal(null)}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-2">确认{statusModal.label}</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>{statusModal.confirm || '确认执行此操作？'}</p>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>备注原因</label>
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
