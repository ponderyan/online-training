'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const FALLBACK_SUBJECTS = [
  { id: 1, code: 'DTM', name: 'DTM' },
  { id: 2, code: 'DTC', name: 'DTC' },
  { id: 3, code: 'DTGV', name: 'DTGV' },
  { id: 4, code: 'DTA', name: 'DTA' },
  { id: 5, code: 'COMMON', name: 'COMMON' },
];

export default function NewProgramPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    courseName: '',
    subjectId: 1,
    startDate: '',
    endDate: '',
    enrollStart: '',
    enrollEnd: '',
    tuitionFee: '',
    examFee: '',
    certFee: '',
    maxStudents: '',
    headTeacher: '',
    location: '',
    description: '',
    remark: '',
  });
  const [subjects, setSubjects] = useState<{ id: number; code: string; name: string }[]>(FALLBACK_SUBJECTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.dataDictionaries.list().then((d: any) => {
      const items = Array.isArray(d) ? d : d?.items || [];
      if (items.length) setSubjects(items.map((s: any) => ({ id: s.code || s.id, code: s.code, name: s.name })));
    }).catch(() => {});
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '请输入培训班名称';
    if (!form.courseName.trim()) errs.courseName = '请输入课程全称';
    if (!form.startDate) errs.startDate = '请选择开班日期';
    if (!form.endDate) errs.endDate = '请选择结课日期';
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = '结课日期不能早于开班日期';
    if (form.enrollStart && form.enrollEnd && form.enrollStart > form.enrollEnd) errs.enrollEnd = '报名截止不能早于报名开始';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setError('');
    try {
      const data = await api.trainingPrograms.create({
        ...form,
        subjectId: form.subjectId as unknown as number,
        tuitionFee: form.tuitionFee ? parseFloat(form.tuitionFee) : undefined,
        examFee: form.examFee ? parseFloat(form.examFee) : undefined,
        certFee: form.certFee ? parseFloat(form.certFee) : undefined,
        maxStudents: form.maxStudents ? parseInt(form.maxStudents) : undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        enrollStart: form.enrollStart ? new Date(form.enrollStart).toISOString() : undefined,
        enrollEnd: form.enrollEnd ? new Date(form.enrollEnd).toISOString() : undefined,
        createdBy: JSON.parse(localStorage.getItem('user') || '{}').id || 1,
      });
      router.push(`/programs/${data.id}`);
    } catch (e: any) { setError('保存失败：' + e.message); }
    setSaving(false);
  };

  const Field = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>
        {label} {required && <span style={{ color: 'var(--verm)' }}>*</span>}
      </label>
      {children}
      {error && <p className="text-xs mt-0.5" style={{ color: 'var(--verm)' }}>{error}</p>}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/programs')}
          className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>
          ← 返回培训班列表
        </button>

        <h1 className="page-title">📋 新建培训班</h1>
        <p className="page-subtitle mb-6">填写培训班基本信息，系统将自动生成培训班编号</p>

        {error && (
          <div className="text-xs px-4 py-2 rounded-lg mb-4" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
            ⚠ {error}
          </div>
        )}

        {/* 基本信息 */}
        <div className="card p-6 mb-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>📄 基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="培训班名称" required error={errors.name}>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="input" placeholder="如：第9期DT+人才培育体系咨询师（DTC）培训班" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="课程全称" required error={errors.courseName}>
                <input value={form.courseName} onChange={e => setForm({...form, courseName: e.target.value})}
                  className="input" placeholder="如：DT+人才培育体系咨询师（DTC）培训" />
              </Field>
            </div>
            <div>
              <Field label="科目" required>
                <select value={form.subjectId} onChange={e => setForm({...form, subjectId: parseInt(e.target.value) || 1})}
                  className="input select">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </Field>
            </div>
            <div>
              <Field label="班主任">
                <input value={form.headTeacher} onChange={e => setForm({...form, headTeacher: e.target.value})}
                  className="input" placeholder="班主任姓名" />
              </Field>
            </div>
            <div>
              <Field label="开班日期" required error={errors.startDate}>
                <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                  className="input" />
              </Field>
            </div>
            <div>
              <Field label="结课日期" required error={errors.endDate}>
                <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                  className="input" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="培训地点">
                <input value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                  className="input" placeholder="如：北京市海淀区知春路XX号" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="培训说明">
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="input textarea" rows={3} placeholder="培训班简介、课程安排概述等" />
              </Field>
            </div>
          </div>
        </div>

        {/* 费用信息 */}
        <div className="card p-6 mb-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>💰 费用信息</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-300)' }}>留空或填 0 表示该项目免费或不收取</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="培训费（元/人）">
              <input type="number" min={0} value={form.tuitionFee} onChange={e => setForm({...form, tuitionFee: e.target.value})}
                className="input" placeholder="如 2980" />
            </Field>
            <Field label="考试费（元/人）">
              <input type="number" min={0} value={form.examFee} onChange={e => setForm({...form, examFee: e.target.value})}
                className="input" placeholder="如 500" />
            </Field>
            <Field label="证书费（元/人）">
              <input type="number" min={0} value={form.certFee} onChange={e => setForm({...form, certFee: e.target.value})}
                className="input" placeholder="如 200" />
            </Field>
          </div>
          {form.tuitionFee || form.examFee || form.certFee ? (
            <div className="mt-3 text-xs" style={{ color: 'var(--ink-400)' }}>
              合计：<strong>¥{(
                (parseFloat(form.tuitionFee) || 0) +
                (parseFloat(form.examFee) || 0) +
                (parseFloat(form.certFee) || 0)
              ).toLocaleString()}</strong> /人
            </div>
          ) : null}
        </div>

        {/* 招生设置 */}
        <div className="card p-6 mb-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>📢 招生设置</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Field label="报名开始">
                <input type="date" value={form.enrollStart} onChange={e => setForm({...form, enrollStart: e.target.value})}
                  className="input" />
              </Field>
            </div>
            <div>
              <Field label="报名截止" error={errors.enrollEnd}>
                <input type="date" value={form.enrollEnd} onChange={e => setForm({...form, enrollEnd: e.target.value})}
                  className="input" />
              </Field>
            </div>
            <div>
              <Field label="限额人数">
                <input type="number" min={1} value={form.maxStudents} onChange={e => setForm({...form, maxStudents: e.target.value})}
                  className="input" placeholder="留空表示不限制" />
              </Field>
            </div>
          </div>
        </div>

        {/* 备注 */}
        <div className="card p-6 mb-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>📝 备注</h2>
          <Field label="内部备注（仅管理员可见）">
            <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})}
              className="input textarea" rows={2} placeholder="任何需要记录的补充信息" />
          </Field>
        </div>

        <div className="flex gap-2 mt-5 pb-10">
          <button onClick={() => router.push('/programs')} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
            {saving ? '保存中…' : '创建培训班'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
