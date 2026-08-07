'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

interface SystemConfigItem {
  key: string;
  group: string;
  desc: string;
  inputType: 'number' | 'boolean' | 'select' | 'text' | 'password';
  value: string;
  options?: string;
  sort_order?: number;
}

type DirtyMap = Record<string, string>;

/** 分组显示名映射（未列出的 group 直接显示 key） */
const GROUP_LABELS: Record<string, string> = {
  training: '培训配置',
  exam: '考试配置',
  question: '出题配置',
  bank: '题库策略',
  cert: '证书策略',
  org: '组织编码',
  audit: '审计日志',
  notification: '通知配置',
  email: '邮件配置',
  sms: '短信配置',
};
/** 分组排序（未列出的排最后） */
const GROUP_ORDER = ['training', 'exam', 'question', 'bank', 'cert', 'org', 'audit', 'notification', 'email', 'sms'];

const FOX = 'var(--fox)';
const INK_300 = 'var(--neutral-400)';
const INK_400 = 'var(--neutral-400)';
const INK_600 = 'var(--neutral-600)';
const CARD_STYLE = { background: 'var(--paper)', border: '1px solid var(--ink-200)', borderRadius: '10px' };

export default function SystemConfigPage() {
  const [configs, setConfigs] = useState<Record<string, SystemConfigItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.systemConfig.getAll();
      setConfigs(data as Record<string, SystemConfigItem[]>);
      setDirty({});
    } catch (e: any) {
      setError(e?.message || '加载失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 动态生成 tabs（从 API 返回的分组 key 推导）
  const tabs = Object.keys(configs)
    .filter(k => (configs[k] || []).length > 0)
    .sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(k => ({ key: k, label: GROUP_LABELS[k] || k }));

  // 确保 activeTab 有效
  useEffect(() => {
    if (tabs.length > 0 && (!activeTab || !tabs.find(t => t.key === activeTab))) {
      setActiveTab(tabs[0].key);
    }
  }, [configs, activeTab]);

  const setValue = (key: string, value: string) => {
    // Find the original value from configs
    const original = Object.values(configs).flat().find((c: SystemConfigItem) => c.key === key)?.value ?? '';
    setDirty(prev => {
      if (value === original) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSave = async () => {
    const items = Object.entries(dirty);
    if (items.length === 0) {
      showToast('没有需要保存的修改');
      return;
    }
    setSaving(true);
    try {
      const res = await api.systemConfig.batchUpdate(items.map(([key, value]) => ({ key, value })));
      if (res.failCount > 0) {
        showToast(`部分保存失败（${res.successCount}成功/${res.failCount}失败）`);
      } else {
        showToast('保存成功');
      }
      // 刷新数据
      await load();
    } catch (e: any) {
      showToast('保存失败：' + (e?.message || '未知错误'));
    }
    setSaving(false);
  };

  const renderControl = (item: SystemConfigItem) => {
    const val = dirty[item.key] !== undefined ? dirty[item.key] : item.value;

    switch (item.inputType) {
      case 'number':
        return (
          <input
            type="number"
            value={val}
            onChange={e => setValue(item.key, e.target.value)}
            className="input w-[160px] text-right"
            style={{ fontSize: '13px' }}
          />
        );
      case 'boolean':
        return (
          <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={val === 'true'}
              onChange={e => setValue(item.key, e.target.checked ? 'true' : 'false')}
              style={{ display: 'none' }}
            />
            <span style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: val === 'true' ? FOX : 'var(--neutral-200)',
              position: 'relative', transition: 'background 0.2s',
              display: 'inline-block',
            }}>
              <span style={{
                position: 'absolute', top: '2px', left: val === 'true' ? '18px' : '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'var(--paper-bright)', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </span>
          </label>
        );
      case 'select': {
        const opts: string[] = (() => {
          try {
            if (!item.options) return [];
            const parsed = JSON.parse(item.options);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
        return (
          <select
            value={val}
            onChange={e => setValue(item.key, e.target.value)}
            className="input select w-[160px]"
            style={{ fontSize: '13px' }}
          >
            {opts.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      case 'password':
        return (
          <input
            type="password"
            value={val}
            onChange={e => setValue(item.key, e.target.value)}
            className="input w-[240px]"
            style={{ fontSize: '13px' }}
            placeholder="••••••••"
          />
        );
      default:
        return (
          <input
            type="text"
            value={val}
            onChange={e => setValue(item.key, e.target.value)}
            className="input w-[240px]"
            style={{ fontSize: '13px' }}
          />
        );
    }
  };

  const currentItems = (configs[activeTab] || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const dirtyCount = Object.keys(dirty).length;

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: toast.includes('失败') ? 'var(--error)' : 'var(--sage)',
          color: '#fff', padding: '10px 24px', borderRadius: '8px',
          fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'opacity 0.3s',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">配置中心</h1>
        <p className="page-subtitle">管理系统全局参数配置</p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16" style={{ color: INK_300 }}>加载中… 🦊</div>
      ) : error ? (
        <div className="text-[var(--error)] text-center py-16">
          <p className="mb-4">{error}</p>
          <button onClick={load} className="btn btn-fox btn-sm">🔄 重试</button>
        </div>
      ) : (
        <div>
          {/* Tab Bar */}
          <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid var(--ink-200)' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? FOX : INK_400,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${FOX}` : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '-1px',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Config Items */}
          {currentItems.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-4">📋</p>
              <p style={{ color: INK_300 }}>该分组暂无配置项</p>
            </div>
          ) : (
            <div style={CARD_STYLE}>
              {currentItems.map((item, idx) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: idx < currentItems.length - 1 ? '1px solid var(--ink-100)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: INK_600, marginBottom: '2px' }}>
                      {item.desc}
                      {dirty[item.key] !== undefined && (
                        <span style={{ color: FOX, fontSize: '11px', marginLeft: '8px' }}>已修改</span>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: '16px' }}>
                    {renderControl(item)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save Button */}
          {currentItems.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || dirtyCount === 0}
                className="btn btn-fox btn-sm"
              >
                {saving ? '保存中…' : '保存'}
              </button>
              {dirtyCount > 0 && (
                <span style={{ fontSize: '12px', color: INK_300 }}>
                  共 {dirtyCount} 项修改待保存
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
