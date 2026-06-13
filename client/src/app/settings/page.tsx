'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const PROVIDER_MODELS: Record<string, string[]> = {
  'DeepSeek': ['deepseek-v4-flash', 'deepseek-v4-pro'],
  'Kimi (Moonshot)': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  'GLM (智谱)': ['glm-4', 'glm-4v', 'glm-3-turbo'],
  'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
};
const PROVIDER_BASE: Record<string, string> = {
  'DeepSeek': 'https://api.deepseek.com',
  'Kimi (Moonshot)': 'https://api.moonshot.cn',
  'GLM (智谱)': 'https://open.bigmodel.cn/api/paas/v4',
  'OpenAI': 'https://api.openai.com',
};

export default function SettingsPage() {
  const [dictionaries, setDictionaries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('ai');

  // AI config form
  const [provider, setProvider] = useState('DeepSeek');
  const [apiBase, setApiBase] = useState('https://api.deepseek.com');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-flash');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [temp, setTemp] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(4096);

  const [savedConfigId, setSavedConfigId] = useState<number | null>(null);

  // Connection test
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    api.aiConfigs.list().then(list => {
      if (list.length > 0) {
        const cfg = list[0]; // 最新的配置
        setSavedConfigId(cfg.id);
        setProvider(cfg.provider || 'DeepSeek');
        setApiBase(cfg.apiBaseUrl || 'https://api.deepseek.com');
        setApiKey(cfg.apiKey || '');
        setModel(cfg.modelVersion || 'deepseek-v4-flash');
        if (cfg.temperature) setTemp(cfg.temperature);
        if (cfg.topP) setTopP(cfg.topP);
        if (cfg.maxTokens) setMaxTokens(cfg.maxTokens);
        // Check if model is in presets for this provider
        const models = PROVIDER_MODELS[cfg.provider];
        if (models && !models.includes(cfg.modelVersion)) setUseCustomModel(true);
      }
    }).catch(() => {});
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.aiConfigs.test({ apiBaseUrl: apiBase, apiKey, modelVersion: model });
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    }
    setTesting(false);
  };

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

  const saveAiConfig = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const payload = {
        name: `${provider} 配置`,
        provider, apiBaseUrl: apiBase, apiKey,
        modelVersion: model, temperature: temp, topP, maxTokens,
        createdBy: user.id || 1,
      };
      if (savedConfigId) {
        await api.aiConfigs.update(savedConfigId, payload);
      } else {
        const created = await api.aiConfigs.create(payload);
        setSavedConfigId(created.id);
      }
      alert('AI 配置已保存');
    } catch (e: any) { alert('保存失败：' + e.message); }
  };

  const saveSysParams = () => {
    localStorage.setItem('sys_coolingDays', String(coolingDays));
    localStorage.setItem('sys_defaultPrefix', defaultPrefix);
    localStorage.setItem('sys_diffLabels', JSON.stringify(diffLabels));
    alert('系统参数已保存');
  };

  const addDictionary = async () => {
    if (!newCode || !newName) return;
    await api.dataDictionaries.create({ code: newCode.toUpperCase(), name: newName });
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
        <h1 className="page-title">系统设置</h1>
        <p className="page-subtitle">大模型配置 · 数据字典 · 系统参数</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        {[
          { key: 'ai', label: '大模型集成' },
          { key: 'dict', label: '数据字典' },
          { key: 'sys', label: '系统参数' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent"
            style={{
              borderColor: activeTab === tab.key ? 'var(--gold)' : 'transparent',
              color: activeTab === tab.key ? 'var(--ink-800)' : 'var(--ink-300)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ai' && (
        <div className="card p-6 max-w-[600px]">
          <h3 className="section-title mb-5">大模型集成</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>API 提供商</label>
              <select value={provider} onChange={e => {
                const p = e.target.value;
                setProvider(p);
                if (p !== '自定义') {
                  setApiBase(PROVIDER_BASE[p] || apiBase);
                  const models = PROVIDER_MODELS[p];
                  if (models && !useCustomModel) setModel(models[0]);
                }
              }} className="input select">
                <option>DeepSeek</option>
                <option>Kimi (Moonshot)</option>
                <option>GLM (智谱)</option>
                <option>OpenAI</option>
                <option>自定义</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>API 地址</label>
              <input value={apiBase} onChange={e => setApiBase(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>API Key</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                  className="input" style={{ paddingRight: '40px' }} />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer flex items-center justify-center p-1 rounded"
                  style={{ color: 'var(--ink-300)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-700)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>
                  {showApiKey ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                模型版本
                {!useCustomModel && provider !== '自定义' && (
                  <button onClick={() => setUseCustomModel(true)} className="ml-2 text-[10px] bg-transparent border-none cursor-pointer"
                    style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>
                    自定义
                  </button>
                )}
                {useCustomModel && (
                  <button onClick={() => { setUseCustomModel(false); const m = PROVIDER_MODELS[provider]; if (m) setModel(m[0]); }} className="ml-2 text-[10px] bg-transparent border-none cursor-pointer"
                    style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>
                    预设模型
                  </button>
                )}
              </label>
              {!useCustomModel && PROVIDER_MODELS[provider] ? (
                <select value={model} onChange={e => setModel(e.target.value)} className="input select">
                  {PROVIDER_MODELS[provider].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={model} onChange={e => setModel(e.target.value)}
                  className="input" placeholder="输入模型名称" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>温度</label>
                <input type="number" step={0.1} value={temp} onChange={e => setTemp(Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>Top P</label>
                <input type="number" step={0.1} value={topP} onChange={e => setTopP(Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>最大 Token</label>
                <input type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} className="input" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveAiConfig} className="btn btn-ink btn-sm">保存配置</button>
              <button onClick={testConnection} disabled={testing || !apiBase || !apiKey}
                className="btn btn-outline btn-sm">
                {testing ? '测试中…' : '测试连接'}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult.success ? 'tag tag-cyan' : 'tag tag-verm'}`}>
                  {testResult.message}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>当前：{provider} · {model}</span>
            </div>
          </div>
        </div>
      )}

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
            <button onClick={addDictionary} className="btn btn-gold btn-sm">添加</button>
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
