'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [dictionaries, setDictionaries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dict');

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

  const saveSysParams = () => {
    localStorage.setItem('sys_coolingDays', String(coolingDays));
    localStorage.setItem('sys_defaultPrefix', defaultPrefix);
    localStorage.setItem('sys_diffLabels', JSON.stringify(diffLabels));
    alert('系统参数已保存');
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
                <div key={d.id} className="flex justify-between items-center py-1.5 border-b border-dashed last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
                  <span className="text-sm"><span className="font-medium">{d.code}</span> — {d.name}</span>
                  <button onClick={() => deleteDict(d.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                </div>
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
    </AppLayout>
  );
}
