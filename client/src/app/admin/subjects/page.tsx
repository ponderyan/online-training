'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface SubjectItem {
  id: number;
  name: string;
  code: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  isSystem?: boolean;
  orgId?: number | null;
  organization?: { id: number; name: string; code: string; orgType: string } | null;
  ownership?: 'OWN' | 'ANCESTOR' | 'CHILD';
  manageable?: boolean;
  _count?: { chapters: number; questions: number; knowledgePoints: number };
}

const OWNERSHIP_LABELS: Record<string, string> = {
  OWN: '本级',
  ANCESTOR: '上级继承',
  CHILD: '下级定义',
};
const OWNERSHIP_COLORS: Record<string, string> = {
  OWN: 'var(--sage)',
  ANCESTOR: 'var(--blue)',
  CHILD: 'var(--warning)',
};

export default function SubjectsAdminPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.subjects.list();
      setSubjects(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', code: '', description: '', sortOrder: subjects.length + 1 });
    setShowForm(true);
  };

  const openEdit = (s: SubjectItem) => {
    setEditingId(s.id);
    setForm({ name: s.name, code: s.code, description: s.description || '', sortOrder: s.sortOrder });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('科目名称和代码不能为空');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.subjects.update(editingId, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || undefined,
          sortOrder: form.sortOrder,
        });
        toast.success('科目已更新');
      } else {
        await api.subjects.create({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || undefined,
          sortOrder: form.sortOrder,
        });
        toast.success('科目已创建');
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
    setSaving(false);
  };

  const handleDelete = async (s: SubjectItem) => {
    if (!confirm(`确认删除科目「${s.name}」？`)) return;
    try {
      await api.subjects.delete(s.id);
      toast.success('已删除');
      load();
    } catch (e: any) {
      toast.error(e?.message || '删除失败');
    }
  };

  const toggleActive = async (s: SubjectItem) => {
    try {
      await api.subjects.update(s.id, { isActive: !s.isActive });
      toast.success(s.isActive ? '已停用' : '已启用');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  return (
    <AppLayout>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="page-title">科目管理</h1>
          <p className="page-subtitle">管理培训科目 · 共 {subjects.length} 个科目</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ 新增科目</button>
      </div>

      {loading ? (
        <div className="text-[var(--ink-300)] text-center py-20 text-sm">加载中...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-[var(--ink-100)] border-b">
                <th className="text-[var(--ink-400)] text-left px-4 py-3 font-medium">代码</th>
                <th className="text-[var(--ink-400)] text-left px-4 py-3 font-medium">名称</th>
                <th className="text-[var(--ink-400)] text-left px-4 py-3 font-medium">归属</th>
                <th className="text-[var(--ink-400)] text-left px-4 py-3 font-medium">描述</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">章节</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">题目</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">知识点</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">状态</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">排序</th>
                <th className="text-[var(--ink-400)] text-center px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id} className="border-[var(--ink-50)] border-b last:border-0 hover:bg-[var(--paper-50)]">
                  <td className="px-4 py-3">
                    <span className="tag tag-gold">{s.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {s.isSystem && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--warning-pale)', color: 'var(--fox-dark)' }}>系统</span>}
                  </td>
                  <td className="text-[var(--ink-400)] px-4 py-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      {s.organization ? (
                        <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--ink-50)', color: 'var(--ink-500)' }}>
                          {s.organization.code} - {s.organization.name}
                        </span>
                      ) : <span className="text-[var(--ink-300)]">平台级</span>}
                      {s.ownership && (
                        <span className="px-1 py-0.5 rounded text-[10px]" style={{ background: OWNERSHIP_COLORS[s.ownership] + '15', color: OWNERSHIP_COLORS[s.ownership] }}>
                          {OWNERSHIP_LABELS[s.ownership]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--ink-300)', maxWidth: 200 }}>
                    {s.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">{s._count?.chapters ?? 0}</td>
                  <td className="px-4 py-3 text-center">{s._count?.questions ?? 0}</td>
                  <td className="px-4 py-3 text-center">{s._count?.knowledgePoints ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {s.manageable !== false ? (
                      <button onClick={() => toggleActive(s)}
                        className="px-2 py-0.5 rounded text-xs cursor-pointer"
                        style={{
                          background: s.isActive ? 'var(--green-bg, #ecfdf5)' : 'var(--ink-50)',
                          color: s.isActive ? 'var(--green, #059669)' : 'var(--ink-300)',
                        }}>
                        {s.isActive ? '启用' : '停用'}
                      </button>
                    ) : (
                      <span className="text-[var(--ink-300)] px-2 py-0.5 text-xs">{s.isActive ? '启用' : '停用'}</span>
                    )}
                  </td>
                  <td className="text-[var(--ink-300)] px-4 py-3 text-center text-xs">{s.sortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {s.manageable !== false ? (
                        <>
                          <button onClick={() => openEdit(s)} className="text-xs cursor-pointer" style={{ color: 'var(--fox)' }}>编辑</button>
                          {s.isSystem || s.organization?.orgType === 'ASSOCIATION' ? (
                            <span className="text-[var(--ink-200)] text-xs" title={s.isSystem ? '系统内置科目不可删除' : '协会级科目不可删除，仅可停用'}>删除</span>
                          ) : (
                            <button onClick={() => handleDelete(s)} className="text-xs cursor-pointer" style={{ color: 'var(--red, #dc2626)' }}>删除</button>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--ink-200)] text-xs" title="非本级科目，仅可查看">🔒 只读</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr><td colSpan={10} className="text-[var(--ink-300)] text-center py-12 text-sm">暂无科目，点击「新增科目」创建</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="card p-6 w-[420px]">
            <h3 className="text-base font-semibold mb-4">{editingId ? '编辑科目' : '新增科目'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--ink-400)] block text-xs font-medium mb-1">科目代码 *</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="如 DT+、DTC" maxLength={20}
                  className="input w-full" disabled={!!editingId} />
                {editingId && <p className="text-[var(--ink-300)] text-xs mt-1">代码创建后不可修改</p>}
              </div>
              <div>
                <label className="text-[var(--ink-400)] block text-xs font-medium mb-1">科目名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如 数智化管理师" maxLength={200}
                  className="input w-full" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] block text-xs font-medium mb-1">描述</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="科目简介（可选）" rows={3}
                  className="input w-full resize-none" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] block text-xs font-medium mb-1">排序</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="input w-24" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-ghost">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
