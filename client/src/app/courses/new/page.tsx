'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', code: '', description: '', hours: '', syllabus: '', remark: '',
    type: 'STANDARD', parentCourseId: '', isReviewed: true });
  const [saving, setSaving] = useState(false);
  const [standardCourses, setStandardCourses] = useState<any[]>([]);

  useEffect(() => {
    api.courses.list({ type: 'STANDARD', pageSize: '200' }).then((data: any) => {
      setStandardCourses(data.items || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.name) { alert('请输入课程名称'); return; }
    setSaving(true);
    try {
      await api.courses.create({
        ...form,
        hours: form.hours ? parseFloat(form.hours) : null,
        syllabus: form.syllabus ? { content: form.syllabus } : null,
        parentCourseId: form.parentCourseId ? parseInt(form.parentCourseId) : null,
        isReviewed: form.type === 'CUSTOM' ? form.isReviewed : true,
      });
      router.push('/courses');
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  return (
    <AppLayout>
      <button onClick={() => router.push('/courses')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回课程列表</button>
      <h1 className="page-title">新建课程</h1>
      <p className="page-subtitle mb-6">添加新的课程基本信息</p>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程名称 *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="例如：数字化转型管理" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程类型</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, parentCourseId: '' })} className="input select w-full" style={{ maxWidth: 200 }}>
              <option value="STANDARD">标准课</option>
              <option value="CUSTOM">定制课</option>
            </select>
          </div>
          {form.type === 'CUSTOM' && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>基于课程</label>
              <select value={form.parentCourseId} onChange={e => setForm({ ...form, parentCourseId: e.target.value })} className="input select w-full" style={{ maxWidth: 400 }}>
                <option value="">请选择标准课…</option>
                {standardCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {form.type === 'CUSTOM' && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>是否已通过协会审核</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isReviewed} onChange={e => setForm({ ...form, isReviewed: e.target.checked })}
                  className="w-4 h-4" />
                <span className="text-sm">{form.isReviewed ? '已审核' : '待审核'}</span>
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程编号</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input w-full" placeholder="例如：DTM-101" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>学时</label>
              <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input w-full" type="number" step="0.5" placeholder="例如：40" />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程简介</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" rows={3} placeholder="课程简介内容" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>教学大纲（JSON 文本或自由文本）</label>
            <textarea value={form.syllabus} onChange={e => setForm({ ...form, syllabus: e.target.value })} className="input w-full" rows={4} placeholder="可选，输入大纲内容" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>备注</label>
            <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="input w-full" rows={2} />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleSubmit} disabled={saving} className="btn btn-fox">{saving ? '保存中…' : '保存'}</button>
            <button onClick={() => router.push('/courses')} className="btn btn-outline">取消</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
