'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

// 出勤 Tab：统计卡 + 出勤表（进行中/待审核可编辑实际出勤）
export default function AttendanceTab({ programId, programStatus }: { programId: number; programStatus: string }) {
  const toast = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [editAttendance, setEditAttendance] = useState<Record<number, string>>({});
  const [attendanceSaving, setAttendanceSaving] = useState<number | null>(null);

  const loadAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const data = await api.trainingPrograms.getAttendance(programId);
      setAttendanceRecords(data || []);
      const edits: Record<number, string> = {};
      (data || []).forEach((r: any) => { edits[r.id] = r.actualDays?.toString() || '0'; });
      setEditAttendance(edits);
    } catch {}
    setAttendanceLoading(false);
  };

  useEffect(() => { loadAttendance(); }, []);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-[var(--fox)] text-2xl font-bold">{attendanceRecords.length}</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">学员总数</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[var(--info)] text-2xl font-bold">
            {attendanceRecords.length > 0
              ? Math.round(attendanceRecords.reduce((s, r) => s + (r.attendanceRate || 0), 0) / attendanceRecords.length)
              : 0}%
          </div>
          <div className="text-[var(--ink-400)] text-xs mt-1">平均出勤率</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[var(--blue)] text-2xl font-bold">{attendanceRecords[0]?.totalDays || 0}</div>
          <div className="text-[var(--ink-400)] text-xs mt-1">总排课天数</div>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        {attendanceLoading ? (
          <div className="text-[var(--ink-300)] p-10 text-center text-xs">加载中…</div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-[var(--ink-300)] p-10 text-center text-xs">暂无出勤记录，请先添加学员和排课</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="list-table">
            <thead><tr><th>序号</th><th>姓名</th><th>推荐单位</th><th>总天数</th><th>实际出勤</th><th>出勤率</th><th>操作</th></tr></thead>
            <tbody>
              {attendanceRecords.map((r: any, i: number) => {
                const canEdit = programStatus === 'IN_PROGRESS' || programStatus === 'REVIEWING';
                const saving = attendanceSaving === r.id;
                return (
                  <tr key={r.id}>
                    <td className="text-[var(--ink-300)] text-xs font-mono">{i + 1}</td>
                    <td className="font-medium">{r.student?.displayName || '—'}</td>
                    <td className="text-[var(--ink-400)] text-xs">{r.student?.organization || '—'}</td>
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
                    <td><span className="font-semibold" style={{ color: (r.attendanceRate || 0) >= 80 ? 'var(--info)' : 'var(--fox)' }}>{r.attendanceRate || 0}%</span></td>
                    <td>
                      {canEdit && (
                        <button onClick={async () => {
                          setAttendanceSaving(r.id);
                          try {
                            await api.trainingPrograms.updateAttendance(programId, r.studentId || r.student?.id, {
                              actualDays: parseInt(editAttendance[r.id] || '0'),
                              reason: '管理员编辑',
                            });
                            loadAttendance();
                          } catch (e: any) { toast.error('保存失败：' + e.message); }
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
          </div>
        )}
      </div>
    </div>
  );
}
