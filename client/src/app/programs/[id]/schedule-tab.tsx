'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';

// 课表 Tab：排课列表 + 增删改弹窗
export default function ScheduleTab({ programId, defaultLocation }: { programId: number; defaultLocation?: string }) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    courseId: '', instructorId: '', startTime: '', endTime: '', location: '', remark: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadSchedules = async () => {
    try {
      const data = await api.schedules.getByProgram(programId);
      setSchedules(data || []);
    } catch {}
  };

  useEffect(() => { loadSchedules(); }, []);

  const loadOptions = async () => {
    try {
      const [c, i] = await Promise.all([
        api.courses.list({ pageSize: '200' }),
        api.instructors.list({ pageSize: '200' }),
      ]);
      setCourses(c.items || []);
      setInstructors(i.items?.filter((x: any) => x.status === 'ACTIVE') || []);
    } catch {}
  };

  const openNew = async () => {
    await loadOptions();
    setEditing(null);
    setForm({
      courseId: '', instructorId: '', startTime: '', endTime: '',
      location: defaultLocation || '', remark: '',
    });
    setShowModal(true);
  };

  const openEdit = async (s: any) => {
    await loadOptions();
    setEditing(s);
    setForm({
      courseId: s.courseId?.toString() || '',
      instructorId: s.instructorId?.toString() || '',
      startTime: s.startTime?.slice(0, 16) || '',
      endTime: s.endTime?.slice(0, 16) || '',
      location: s.location || defaultLocation || '',
      remark: s.remark || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.courseId || !form.startTime || !form.endTime) {
      toast.warning('请填写课程、开始时间和结束时间'); return;
    }
    setSaving(true);
    try {
      const data = {
        programId,
        courseId: parseInt(form.courseId),
        instructorId: form.instructorId ? parseInt(form.instructorId) : null,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location || null,
        remark: form.remark || null,
      };
      if (editing) {
        await api.schedules.update(editing.id, data);
      } else {
        await api.schedules.create(data);
      }
      setShowModal(false);
      loadSchedules();
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setSaving(false);
  };

  const handleDeleteWithReason = async (reason: string) => {
    if (deleteTarget === null) return;
    try {
      await api.schedules.delete(deleteTarget);
      toast.success('排课已删除');
      setDeleteTarget(null);
      loadSchedules();
    } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="btn btn-fox btn-sm">➕ 添加排课</button>
      </div>
      <div className="card p-0 overflow-hidden">
        {schedules.length === 0 ? (
          <div className="text-[var(--ink-300)] p-10 text-center text-xs">暂无排课记录</div>
        ) : (
          <div className="overflow-x-auto">
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
                      <button onClick={() => openEdit(s)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]" >编辑</button>
                      <button onClick={() => setDeleteTarget(s.id)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--error)]" >删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">{editing ? '编辑排课' : '添加排课'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">课程 *</label>
                <select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} className="input select w-full">
                  <option value="">选择课程…</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">讲师</label>
                <select value={form.instructorId} onChange={e => setForm({ ...form, instructorId: e.target.value })} className="input select w-full">
                  <option value="">不指定</option>
                  {instructors.map((i: any) => <option key={i.id} value={i.id}>{i.realName}{i.title ? ` (${i.title})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--ink-400)] text-xs mb-1 block">开始时间 *</label>
                  <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="text-[var(--ink-400)] text-xs mb-1 block">结束时间 *</label>
                  <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">上课地点</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="input w-full" placeholder={defaultLocation || '默认使用培训班地点'} />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">备注</label>
                <input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="input w-full" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
                <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 排课删除弹窗 */}
      <ReasonConfirmModal
        open={deleteTarget !== null}
        title="🗑 删除排课记录"
        required
        presetReasons={['排课时间调整', '课程变更', '创建错误']}
        confirmText="确认删除"
        onConfirm={handleDeleteWithReason}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
