'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function BrandingPage() {
  const [form, setForm] = useState({
    siteName: '', siteTitle: '', siteLogo: '', favicon: '',
    footerText: '', icpBeian: '', publicRegistration: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.json())
      .then(data => {
        setForm({
          siteName: data.siteName || '',
          siteTitle: data.siteTitle || '',
          siteLogo: data.siteLogo || '',
          favicon: data.favicon || '',
          footerText: data.footerText || '',
          icpBeian: data.icpBeian || '',
          publicRegistration: data.publicRegistration ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🎨 品牌设置</h1>
        <p className="page-subtitle">自定义网站名称、LOGO、页脚等品牌信息</p>
      </div>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>网站名称</label>
              <input value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>浏览器标题</label>
              <input value={form.siteTitle} onChange={e => setForm({ ...form, siteTitle: e.target.value })} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>LOGO URL</label>
              <input value={form.siteLogo} onChange={e => setForm({ ...form, siteLogo: e.target.value })} className="input w-full" placeholder="https://…" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>Favicon URL</label>
              <input value={form.favicon} onChange={e => setForm({ ...form, favicon: e.target.value })} className="input w-full" placeholder="https://…" />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>页脚文字</label>
            <input value={form.footerText} onChange={e => setForm({ ...form, footerText: e.target.value })} className="input w-full" placeholder="版权信息" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>ICP 备案号</label>
            <input value={form.icpBeian} onChange={e => setForm({ ...form, icpBeian: e.target.value })} className="input w-full" placeholder="京ICP备XXXXXXXX号" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="pubReg" checked={form.publicRegistration} onChange={e => setForm({ ...form, publicRegistration: e.target.checked })} className="accent-[#e87a30]" />
            <label htmlFor="pubReg" className="text-sm">允许公开注册</label>
          </div>

          {error && <div className="text-xs" style={{ color: '#e53935' }}>{error}</div>}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn btn-fox">{saving ? '保存中…' : '保存设置'}</button>
            {saved && <span className="text-xs" style={{ color: 'var(--sage)' }}>✅ 已保存</span>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
