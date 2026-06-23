'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.organizations.list();
      setOrgs(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '' });

  const openEdit = (org: any) => {
    setEditOrg(org);
    setForm({ name: org.name, code: org.code, contactName: org.contactName || '', contactPhone: org.contactPhone || '', contactEmail: org.contactEmail || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { alert('名称和编码不能为空'); return; }
    setSaving(true);
    try {
      if (editOrg) {
        await api.organizations.update(editOrg.id, form);
      } else {
        await api.organizations.create(form);
      }
      setShowModal(false); setEditOrg(null); resetForm(); load();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此机构？')) return;
    try {
      await api.organizations.remove(id);
      load();
    } catch (e: any) { alert('删除失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🏢 机构管理</h1>
          <p className="page-subtitle">共 {orgs.length} 个机构</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditOrg(null); resetForm(); }}
          className="btn btn-fox btn-sm">➕ 新建机构</button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : orgs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-5xl mb-4">🏢</p>
          <p style={{ color: 'var(--ink-400)' }}>暂无机构</p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>创建第一个机构开始使用</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orgs.map(org => (
            <div key={org.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm" style={{ color: 'var(--ink-700)' }}>{org.name}</h3>
                    <span className="tag tag-ink text-[10px]">{org.code}</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
                    <span>👥 {org._count?.users || 0} 用户</span>
                    <span>📋 {org._count?.programs || 0} 培训班</span>
                    {org.contactName && <span>📞 {org.contactName}{org.contactPhone ? ` ${org.contactPhone}` : ''}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button onClick={() => openEdit(org)} className="btn btn-ghost btn-xs">编辑</button>
                  <button onClick={() => handleDelete(org.id)} className="btn btn-ghost btn-xs"
                    style={{ color: 'var(--verm)' }}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditOrg(null); } }}>
          <div className="modal-card max-w-[460px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{editOrg ? '编辑机构' : '新建机构'}</h3>
              <button onClick={() => { setShowModal(false); setEditOrg(null); }}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>机构名称 *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="如：中电标协" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>机构编码 *</label>
                  <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="input" placeholder="如：CEC" disabled={!!editOrg} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系人</label>
                <input value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="input" placeholder="联系人姓名" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系电话</label>
                  <input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} className="input" placeholder="手机号" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系邮箱</label>
                  <input value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="input" placeholder="邮箱" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowModal(false); setEditOrg(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
