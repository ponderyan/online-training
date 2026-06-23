'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function EditCoursePage() {
  const params = useParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [standardCourses, setStandardCourses] = useState<any[]>([]);

  useEffect(() => {
    api.courses.get(Number(params.id)).then((data: any) => {
      setForm({
        name: data.name || '', code: data.code || '', description: data.description || '',
        hours: data.hours?.toString() || '', syllabus: data.syllabus?.content || data.syllabus || '',
        remark: data.remark || '',
        type: data.type || 'STANDARD',
        parentCourseId: data.parentCourseId?.toString() || '',
        isReviewed: data.isReviewed !== false,
        parentCourseName: data.parentCourse?.name || '',
      });
    }).catch(() => router.push('/courses')).finally(() => setLoading(false));
    api.courses.list({ type: 'STANDARD', pageSize: '200' }).then((data: any) => {
      setStandardCourses(data.items || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.name) { alert('请输入课程名称'); return; }
    setSaving(true);
    try {
      await api.courses.update(Number(params.id), {
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

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => router.push('/courses')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回课程列表</button>
      <h1 className="page-title">编辑课程</h1>
      <p className="page-subtitle mb-6">修改课程信息</p>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程名称 *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程类型</label>
            {form.type === 'CUSTOM' ? (
              <div className="text-sm py-1.5" style={{ color: 'var(--ink-400)' }}>
                定制课（基于：{form.parentCourseName || '未知'}）
                <span className="ml-2 text-xs">（类型不可修改）</span>
              </div>
            ) : (
              <div className="text-sm py-1.5" style={{ color: 'var(--ink-400)' }}>标准课</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程编号</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>学时</label>
              <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input w-full" type="number" step="0.5" />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>课程简介</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" rows={3} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>教学大纲</label>
            <textarea value={form.syllabus} onChange={e => setForm({ ...form, syllabus: e.target.value })} className="input w-full" rows={4} />
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
