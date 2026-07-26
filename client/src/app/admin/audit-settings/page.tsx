'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/app-layout';

interface ArchiveConfig {
  retentionDays: number;
  autoCleanupEnabled: boolean;
  stats: {
    total: number;
    oldestAt: string | null;
    last30Days: number;
  };
}

export default function AuditSettingsPage() {
  const [config, setConfig] = useState<ArchiveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 表单状态
  const [retentionDays, setRetentionDays] = useState(730);
  const [autoCleanup, setAutoCleanup] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/audit-logs/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ArchiveConfig = await res.json();
        setConfig(data);
        setRetentionDays(data.retentionDays);
        setAutoCleanup(data.autoCleanupEnabled);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/audit-logs/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ retentionDays, autoCleanupEnabled: autoCleanup }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setMessage({ type: 'success', text: '配置已保存' });
      } else {
        setMessage({ type: 'error', text: `保存失败 (${res.status})` });
      }
    } catch {
      setMessage({ type: 'error', text: '网络异常' });
    } finally {
      setSaving(false);
    }
  }

  async function handleManualArchive() {
    if (!confirm(`确认手动清理 ${retentionDays} 天前的审计日志？此操作不可撤销。`)) return;
    setArchiving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/audit-logs/archive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ retentionDays }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `已清理 ${data.deleted} 条超期日志` });
        fetchConfig(); // 刷新统计
      } else {
        setMessage({ type: 'error', text: `清理失败 (${res.status})` });
      }
    } catch {
      setMessage({ type: 'error', text: '网络异常' });
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return <AppLayout><div className="text-center py-16 text-[var(--ink-300)]">加载中…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title text-xl font-bold mb-6" style={{ color: 'var(--ink-700)' }}>
          📋 审计日志管理
        </h1>

        {/* 统计卡片 */}
        {config?.stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>
                {config.stats.total.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>日志总量</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--cyan)' }}>
                {config.stats.last30Days.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>近30天新增</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm font-medium" style={{ color: 'var(--ink-500)' }}>
                {config.stats.oldestAt ? new Date(config.stats.oldestAt).toLocaleDateString('zh-CN') : '—'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>最早记录</div>
            </div>
          </div>
        )}

        {/* 归档配置 */}
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>归档策略配置</h2>

          <div className="space-y-5">
            {/* 保留天数 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>日志保留天数</label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>
                  超过此天数的日志将被自动清理（范围 30~3650 天）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={30}
                  max={3650}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value) || 730)}
                  className="w-24 px-3 py-2 rounded-lg border text-sm text-center"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--paper)' }}
                />
                <span className="text-xs" style={{ color: 'var(--ink-400)' }}>天</span>
              </div>
            </div>

            {/* 快捷选项 */}
            <div className="flex gap-2">
              {[
                { label: '半年', days: 180 },
                { label: '1年', days: 365 },
                { label: '2年', days: 730 },
                { label: '3年', days: 1095 },
                { label: '5年', days: 1825 },
              ].map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setRetentionDays(opt.days)}
                  className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                  style={{
                    borderColor: retentionDays === opt.days ? 'var(--fox)' : 'var(--ink-200)',
                    background: retentionDays === opt.days ? 'var(--fox-pale)' : 'var(--paper)',
                    color: retentionDays === opt.days ? 'var(--fox)' : 'var(--ink-500)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 自动清理开关 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>自动定时清理</label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>
                  每天凌晨 3:00 自动清理超期日志
                </p>
              </div>
              <button
                onClick={() => setAutoCleanup(!autoCleanup)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: autoCleanup ? 'var(--fox)' : 'var(--ink-200)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ left: autoCleanup ? '22px' : '2px' }}
                />
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-fox btn-sm"
            >
              {saving ? '保存中…' : '保存配置'}
            </button>
            <button
              onClick={handleManualArchive}
              disabled={archiving}
              className="px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
            >
              {archiving ? '清理中…' : '立即清理'}
            </button>
          </div>
        </div>

        {/* 提示信息 */}
        {message && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: message.type === 'success' ? '#16a34a' : '#dc2626',
            }}
          >
            {message.text}
          </div>
        )}

        {/* 说明 */}
        <div className="card p-4 mt-6">
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-500)' }}>说明</h3>
          <ul className="text-xs space-y-1.5" style={{ color: 'var(--ink-400)' }}>
            <li>• 定时清理任务在每天凌晨 3:00 自动执行</li>
            <li>• 清理操作为物理删除，不可恢复，请确认保留天数满足合规要求</li>
            <li>• 建议保留期限不低于 2 年（730 天），以满足审计追溯需求</li>
            <li>• 「立即清理」使用当前配置的保留天数执行一次性清理</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
