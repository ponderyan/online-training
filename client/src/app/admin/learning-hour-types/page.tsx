'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface LearningHourType {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  description: string;
  status: string;
}

const defaultForm = {
  name: '',
  code: '',
  sortOrder: 0,
  description: '',
};

export default function LearningHourTypesPage() {
  const toast = useToast();
  const [types, setTypes] = useState<LearningHourType[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTypes(await api.learningHourTypes.listAll() || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (t: LearningHourType) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      code: t.code,
      sortOrder: t.sortOrder || 0,
      description: t.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.warning('请填写名称和编码');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        code: form.code,
        sortOrder: form.sortOrder,
        description: form.description || undefined,
      };
      if (editId) {
        await api.learningHourTypes.update(editId, data);
      } else {
        await api.learningHourTypes.create(data);
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error('保存失败：' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该学时类型吗？（软删除）')) return;
    try {
      await api.learningHourTypes.delete(id);
      load();
    } catch (e: any) {
      toast.error('删除失败：' + e.message);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📋 学时类型</h1>
          <p className="page-subtitle">管理学时类型字典 · 共 {types.length} 个类型</p>
        </div>
        <button onClick={openNew} className="btn btn-fox btn-sm">➕ 新建类型</button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : types.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无学时类型</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>编码</th>
                <th>排序</th>
                <th>描述</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t: LearningHourType) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td>
                    <span className="text-xs font-mono" style={{ color: 'var(--ink-400)' }}>
                      {t.code}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{t.sortOrder ?? '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{t.description || '—'}</td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        background: t.status === 'ACTIVE' ? '#2e7d3218' : '#e5393518',
                        color: t.status === 'ACTIVE' ? '#2e7d32' : '#e53935',
                        fontSize: '10px',
                      }}
                    >
                      {t.status === 'ACTIVE' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs bg-transparent border-none cursor-pointer"
                        style={{ color: 'var(--fox)' }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs bg-transparent border-none cursor-pointer"
                        style={{ color: '#e53935' }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-base mb-4">
              {editId ? '编辑学时类型' : '新建学时类型'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>
                  类型名称 *
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input w-full"
                  placeholder="例如：专业技术人员继续教育"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>
                  编码 *
                </label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  className="input w-full"
                  placeholder="例如：CONTINUING_EDU"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>
                  排序
                </label>
                <input
                  value={form.sortOrder}
                  onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  type="number"
                  placeholder="数值越小越靠前"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>
                  描述
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="描述该学时类型的用途…"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
                  {saving ? '保存中…' : '保存'}
                </button>
                <button onClick={() => setModalOpen(false)} className="btn btn-outline btn-sm">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
