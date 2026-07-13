'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const PROVIDER_NAMES: Record<string, string> = {
  DeepSeek: 'DeepSeek', GLM: '智谱 GLM', OpenAI: 'OpenAI',
  '硅基流动': '硅基流动', CUSTOM: '自定义',
};

export default function AiConfigsPage() {
  const toast = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', provider: 'DeepSeek', apiBaseUrl: '', apiKey: '',
    modelVersion: '', temperature: '0.7', topP: '0.9', maxTokens: '4096', isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setConfigs(await api.aiConfigs.list() || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', provider: 'DeepSeek', apiBaseUrl: '', apiKey: '', modelVersion: '', temperature: '0.7', topP: '0.9', maxTokens: '4096', isActive: true });
    setTestResult(null);
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name, provider: c.provider, apiBaseUrl: c.apiBaseUrl,
      apiKey: c.apiKey ? '****' : '', modelVersion: c.modelVersion,
      temperature: c.temperature?.toString() || '0.7', topP: c.topP?.toString() || '0.9',
      maxTokens: c.maxTokens?.toString() || '4096', isActive: c.isActive,
    });
    setTestResult(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.apiKey) { toast.warning('请填写名称和 API Key'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name, provider: form.provider,
        apiBaseUrl: form.apiBaseUrl || undefined,
        apiKey: form.apiKey === '****' && editId ? undefined : form.apiKey,
        modelVersion: form.modelVersion || undefined,
        temperature: parseFloat(form.temperature) || 0.7,
        topP: parseFloat(form.topP) || 0.9,
        maxTokens: parseInt(form.maxTokens) || 4096,
        isActive: form.isActive,
      };
      if (editId) {
        await api.aiConfigs.update(editId, data);
      } else {
        await api.aiConfigs.create(data);
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该配置吗？')) return;
    try { await api.aiConfigs.delete(id); load(); } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = {
        apiBaseUrl: form.apiBaseUrl || 'https://api.deepseek.com',
        apiKey: form.apiKey,
        modelVersion: form.modelVersion || 'deepseek-chat',
        configId: editId || undefined,
      };
      const res = await api.aiConfigs.test(data);
      setTestResult(res.success ? '✅ 连接成功' : '❌ 连接失败：' + res.message);
    } catch (e: any) { setTestResult('❌ 测试失败：' + e.message); }
    setTesting(false);
  };

  const maskKey = (key: string) => {
    if (!key) return '—';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🤖 AI 配置</h1>
          <p className="page-subtitle">管理 AI 模型接入配置 · 共 {configs.length} 个配置</p>
        </div>
        <button onClick={openNew} className="btn btn-fox btn-sm">➕ 新建配置</button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : configs.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-4">🤖</p><p style={{ color: 'var(--ink-300)' }}>暂无 AI 配置</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead><tr>
              <th>名称</th><th>Provider</th><th>模型版本</th><th>API 地址</th><th>API Key</th><th>状态</th><th>操作</th>
            </tr></thead>
            <tbody>
              {configs.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td><span className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '10px' }}>{PROVIDER_NAMES[c.provider] || c.provider}</span></td>
                  <td className="text-xs font-mono" style={{ color: 'var(--ink-400)' }}>{c.modelVersion || '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-400)' }}>{c.apiBaseUrl || '—'}</td>
                  <td className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>{maskKey(c.apiKey)}</td>
                  <td>
                    <span className="tag" style={{ background: c.isActive ? '#2e7d3218' : '#8b817418', color: c.isActive ? '#2e7d32' : '#8b8174', fontSize: '10px' }}>
                      {c.isActive ? '活跃' : '停用'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>编辑</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--paper)', border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">{editId ? '编辑 AI 配置' : '新建 AI 配置'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>配置名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="例如：DeepSeek 主配置" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>Provider</label>
                  <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="input select w-full">
                    {Object.entries(PROVIDER_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>模型版本</label>
                  <input value={form.modelVersion} onChange={e => setForm({ ...form, modelVersion: e.target.value })} className="input w-full" placeholder="deepseek-chat" />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>API 地址</label>
                <input value={form.apiBaseUrl} onChange={e => setForm({ ...form, apiBaseUrl: e.target.value })} className="input w-full" placeholder="https://api.deepseek.com" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>API Key *</label>
                <input value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} className="input w-full" type="password" placeholder={editId ? '留空则保持不变' : 'sk-...'} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>Temperature</label>
                  <input value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} className="input w-full" type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>Top P</label>
                  <input value={form.topP} onChange={e => setForm({ ...form, topP: e.target.value })} className="input w-full" type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>Max Tokens</label>
                  <input value={form.maxTokens} onChange={e => setForm({ ...form, maxTokens: e.target.value })} className="input w-full" type="number" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm">启用该配置</span>
                </label>
              </div>

              {testResult && (
                <div className="text-sm p-2 rounded" style={{
                  background: testResult.startsWith('✅') ? '#2e7d3218' : '#e5393518',
                  color: testResult.startsWith('✅') ? '#2e7d32' : '#e53935',
                }}>{testResult}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
                <button onClick={handleTest} disabled={testing} className="btn btn-outline btn-sm">{testing ? '测试中…' : '🔌 测试连接'}</button>
                <button onClick={() => setModalOpen(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
