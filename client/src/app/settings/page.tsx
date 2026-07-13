'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function SettingsPage() {
  const toast = useToast();
  const [dictionaries, setDictionaries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dict');
  const [bankPolicy, setBankPolicy] = useState<{ allow_org_own_bank: boolean; org_bank_visibility: string } | null>(null);
  const [bankPolicyLoading, setBankPolicyLoading] = useState(false);
  const [bankPolicySaving, setBankPolicySaving] = useState(false);

  // System params form
  const [coolingDays, setCoolingDays] = useState(() => {
    if (typeof window !== 'undefined') return Number(localStorage.getItem('sys_coolingDays') || '30');
    return 30;
  });
  const [defaultPrefix, setDefaultPrefix] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sys_defaultPrefix') || 'DT+';
    return 'DT+';
  });
  const [diffLabels, setDiffLabels] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sys_diffLabels');
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return ['易', '较易', '较难', '难'];
  });

  // Dictionary form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.dataDictionaries.list().then(setDictionaries).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'bank') {
      setBankPolicyLoading(true);
      api.systemConfig.bankPolicy.get()
        .then(setBankPolicy)
        .catch(() => {})
        .finally(() => setBankPolicyLoading(false));
    }
  }, [activeTab]);

  const saveSysParams = () => {
    localStorage.setItem('sys_coolingDays', String(coolingDays));
    localStorage.setItem('sys_defaultPrefix', defaultPrefix);
    localStorage.setItem('sys_diffLabels', JSON.stringify(diffLabels));
    toast.success('系统参数已保存');
  };

  const addDictionary = async () => {
    if (!newCode || !newName) return;
    const code = newCode.toUpperCase();
    // 先创建数据字典条目，返回包含实际 id
    const newDict = await api.dataDictionaries.create({ code, name: newName });
    // 同步创建对应的科目（Subject），使用实际返回的字典 ID
    try {
      await api.subjects.create({ name: newName, code, dictionaryId: newDict.id, sortOrder: 99 });
    } catch {
      // 科目可能已存在，忽略
    }
    setNewCode(''); setNewName('');
    api.dataDictionaries.list().then(setDictionaries);
  };

  const deleteDict = async (id: number) => {
    if (!confirm('确认删除？')) return;
    await api.dataDictionaries.delete(id);
    api.dataDictionaries.list().then(setDictionaries);
  };

  return (
    <AppLayout>
      <div className="mb-7">
        <h1 className="page-title">🦊 系统设置</h1>
        <p className="page-subtitle">告诉小狐狸怎么干活</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        {[
          { key: 'dict', label: '数据字典' },
          { key: 'sys', label: '系统参数' },
          { key: 'bank', label: '题库策略' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent"
            style={{
              borderColor: activeTab === tab.key ? 'var(--fox)' : 'transparent',
              color: activeTab === tab.key ? 'var(--ink-800)' : 'var(--ink-300)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* AI 配置导航 */}
      <div className="card p-4 max-w-[500px] mb-6" style={{ background: 'var(--paper-50)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">🤖 AI 模型配置</h4>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>在独立管理页面中配置</p>
          </div>
          <a href="/admin/ai-configs" className="btn btn-fox btn-sm">前往配置 →</a>
        </div>
      </div>

      {activeTab === 'dict' && (
        <div className="card p-6 max-w-[500px]">
          <h3 className="section-title mb-5">
            数据字典
            <span className="text-xs font-normal" style={{ color: 'var(--ink-300)' }}>试卷编号编码</span>
          </h3>

          <div className="space-y-2 mb-5 p-3 rounded" style={{ background: 'var(--paper)' }}>
            {dictionaries.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无编码，请添加</p>
            ) : (
              dictionaries.map((d: any) => (
                <DictItem key={d.id} dict={d} onUpdate={() => api.dataDictionaries.list().then(setDictionaries)} onDelete={() => deleteDict(d.id)} />
              ))
            )}
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>编码</label>
              <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="如 DTM" className="input" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>名称</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="如 数智化管理师" className="input" />
            </div>
            <button onClick={addDictionary} className="btn btn-fox btn-sm">添加</button>
          </div>
        </div>
      )}

      {activeTab === 'sys' && (
        <div className="card p-6 max-w-[500px]">
          <div className="p-3 mb-5 rounded-lg text-xs" style={{ background: '#f9a82518', color: '#e87a30', border: '1px solid #f9a82544' }}>
            ℹ️ 系统参数正在迁移至<strong>配置中心</strong>，新配置请在 <a href="/admin/system-config" style={{ color: 'var(--fox)', textDecoration: 'underline' }}>🦊 配置中心</a> 中管理
          </div>
          <h3 className="section-title mb-5">系统参数</h3>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>试题冷却阈值</label>
              <div className="flex items-center gap-3">
                <input type="number" value={coolingDays} onChange={e => setCoolingDays(Number(e.target.value))}
                  className="input" style={{ width: '100px' }} />
                <span className="text-xs" style={{ color: 'var(--ink-300)' }}>天内不重复出现</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>默认编号前缀</label>
              <input value={defaultPrefix} onChange={e => setDefaultPrefix(e.target.value)} className="input" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                难度等级 <span style={{ color: 'var(--ink-300)' }}>（名称可自定义）</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {diffLabels.map((v, i) => (
                  <input key={i} value={v} onChange={e => {
                    const n = [...diffLabels]; n[i] = e.target.value; setDiffLabels(n);
                  }} className="input" />
                ))}
              </div>
            </div>

            <button onClick={saveSysParams} className="btn btn-ink btn-sm">保存参数</button>
          </div>
        </div>
      )}

      {activeTab === 'bank' && (
        <div className="card p-6 max-w-[500px]">
          <h3 className="section-title mb-5">题库权限策略</h3>

          {bankPolicyLoading || !bankPolicy ? (
            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</p>
          ) : (
            <>
              {/* 开关：允许机构自建题库 */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">允许机构自建题库</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>
                    开启后，机构管理员可在自己机构下创建和管理试题
                  </div>
                </div>
                <label className="toggle-switch" style={{ position: 'relative', cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={bankPolicy.allow_org_own_bank}
                    onChange={e => setBankPolicy(prev => prev ? { ...prev, allow_org_own_bank: e.target.checked } : prev)}
                    style={{ accentColor: '#e87a30', width: '20px', height: '20px' }} />
                </label>
              </div>

              {/* 单选：协会对机构题库的可见性 */}
              <div className="py-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <div className="text-sm font-medium mb-3">协会对机构题库的可见性</div>
                <div className="space-y-3">
                  {[
                    { value: 'hidden', label: '不可见', desc: '协会看不到机构创建的题库内容' },
                    { value: 'view_only', label: '仅查看，不可编辑', desc: '协会可浏览机构题库，但不能修改或删除' },
                    { value: 'full_access', label: '完全可见', desc: '协会可浏览、编辑、删除机构题库' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" name="org_bank_visibility"
                        value={opt.value}
                        checked={bankPolicy.org_bank_visibility === opt.value}
                        onChange={e => setBankPolicy(prev => prev ? { ...prev, org_bank_visibility: e.target.value } : prev)}
                        style={{ accentColor: '#e87a30', marginTop: '3px' }} />
                      <div>
                        <div className="text-sm">{opt.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <button onClick={async () => {
                  if (!bankPolicy) return;
                  setBankPolicySaving(true);
                  try {
                    await api.systemConfig.bankPolicy.update({
                      allow_org_own_bank: bankPolicy.allow_org_own_bank,
                      org_bank_visibility: bankPolicy.org_bank_visibility,
                    });
                    toast.success('题库策略已更新');
                  } catch (e: any) {
                    toast.error('保存失败：' + (e.message || '未知错误'));
                  }
                  setBankPolicySaving(false);
                }} className="btn btn-ink btn-sm">
                  {bankPolicySaving ? '保存中…' : '保存策略'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function DictItem({ dict, onUpdate, onDelete }: { dict: any; onUpdate: () => void; onDelete: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(dict.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editName.trim() || editName === dict.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await api.dataDictionaries.update(dict.id, { name: editName.trim() });
      setEditing(false);
      onUpdate();
    } catch (e: any) {
      toast.error('保存失败：' + (e.message || '未知错误'));
    }
    setSaving(false);
  };

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-dashed last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium min-w-[60px]">{dict.code}</span>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            className="input text-sm flex-1" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditName(dict.name); setEditing(false); } }} />
          <button onClick={handleSave} disabled={saving}
            className="btn btn-fox btn-xs">{saving ? '保存中…' : '保存'}</button>
          <button onClick={() => { setEditName(dict.name); setEditing(false); }}
            className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}>取消</button>
        </div>
      ) : (
        <>
          <span className="text-sm"><span className="font-medium">{dict.code}</span> — {dict.name}</span>
          <div className="flex gap-1">
            <button onClick={() => { setEditName(dict.name); setEditing(true); }}
              className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fox)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>编辑</button>
            <button onClick={onDelete} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
          </div>
        </>
      )}
    </div>
  );
}
