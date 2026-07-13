'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function AgenciesPage() {
  const router = useRouter();
  const toast = useToast();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', shortName: '', contactPerson: '', contactPhone: '', contactEmail: '', remark: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: '1' };
      if (keyword) params.keyword = keyword;
      const data = await api.agencies.list(params);
      setAgencies(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.warning('名称不能为空'); return; }
    setSaving(true);
    try {
      if (editItem) await api.agencies.update(editItem.id, form);
      else await api.agencies.create(form);
      setShowModal(false); setEditItem(null); load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return;
    try { await api.agencies.delete(id); load(); }
    catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🏢 招生机构管理</h1>
          <p className="page-subtitle">共 {total} 个合作机构</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditItem(null); setForm({ name: '', shortName: '', contactPerson: '', contactPhone: '', contactEmail: '', remark: '' }); }}
          className="btn btn-fox btn-sm">➕ 新建机构</button>
      </div>

      <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="🔍 搜索机构名称/联系人…"
        className="input mb-4" style={{ maxWidth: 320 }} onKeyDown={e => e.key === 'Enter' && load()} />

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : agencies.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--ink-300)' }}>暂无招生机构</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="list-table">
            <thead><tr><th>机构名称</th><th>简称</th><th>联系人</th><th>联系电话</th><th>招生人数</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{agencies.map((a: any) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td><td style={{ color: 'var(--ink-400)' }}>{a.shortName || '—'}</td>
                <td>{a.contactPerson || '—'}</td><td>{a.contactPhone || '—'}</td>
                <td>{a.totalEnrolled || 0}</td>
                <td><span className={`tag ${a.isActive ? 'tag-cyan' : 'tag-ink'}`}>{a.isActive ? '启用' : '停用'}</span></td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditItem(a); setForm({ name: a.name, shortName: a.shortName || '', contactPerson: a.contactPerson || '', contactPhone: a.contactPhone || '', contactEmail: a.contactEmail || '', remark: a.remark || '' }); setShowModal(true); }}
                      className="btn btn-ghost btn-xs">编辑</button>
                    <button onClick={() => handleDelete(a.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>删除</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-card max-w-[500px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{editItem ? '编辑机构' : '新建机构'}</h3>
              <button onClick={() => setShowModal(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>机构名称 *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>简称</label><input value={form.shortName} onChange={e => setForm({...form, shortName: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系人</label><input value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系电话</label><input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>邮箱</label><input value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="input" /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>备注</label><textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="input textarea" rows={2} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
