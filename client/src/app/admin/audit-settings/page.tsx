'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import Link from 'next/link';

interface ArchiveStats {
  total: number;
  oldestAt: string | null;
  last30Days: number;
}

export default function AuditSettingsPage() {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/audit-logs/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function handleManualArchive() {
    if (!confirm('确认执行清理？此操作将删除超期日志，不可恢复。')) return;
    setArchiving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/audit-logs/archive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `清理完成，共删除 ${data.deleted} 条日志` });
        fetchStats();
      } else {
        setMessage({ type: 'error', text: data.message || '清理失败' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '清理失败' });
    }
    setArchiving(false);
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title text-xl font-bold mb-6" style={{ color: 'var(--ink-700)' }}>
          📋 审计日志管理
        </h1>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>
                {stats.total.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>日志总量</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--cyan)' }}>
                {stats.last30Days.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>近30天新增</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm font-medium" style={{ color: 'var(--ink-500)' }}>
                {stats.oldestAt ? new Date(stats.oldestAt).toLocaleDateString('zh-CN') : '—'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>最早记录</div>
            </div>
          </div>
        )}

        {/* 操作区 */}
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ink-600)' }}>归档操作</h2>
          
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--fox-pale)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>立即清理超期日志</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                根据配置中心「审计日志」分组的保留天数执行清理
              </p>
            </div>
            <button
              onClick={handleManualArchive}
              disabled={archiving}
              className="px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{ borderColor: '#fca5a5', color: 'var(--error)', background: 'var(--error-pale)' }}
            >
              {archiving ? '清理中…' : '🗑 立即清理'}
            </button>
          </div>

          {/* 配置入口 */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--ink-400)' }}>归档策略配置（保留天数、自动清理开关）：</p>
            <Link 
              href="/admin/system-config"
              className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--fox)', background: 'var(--fox-pale)' }}
            >
              ⚙️ 前往配置中心 → 审计日志
            </Link>
          </div>
        </div>

        {/* 提示信息 */}
        {message && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: message.type === 'success' ? 'var(--success-pale)' : 'var(--error-pale)',
              border: `1px solid ${message.type === 'success' ? '#bbf7d0' : 'var(--error-pale)'}`,
              color: message.type === 'success' ? 'var(--sage)' : 'var(--error)',
            }}
          >
            {message.text}
          </div>
        )}

        {/* 说明 */}
        <div className="card p-4 mt-6">
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-500)' }}>说明</h3>
          <ul className="text-xs space-y-1.5" style={{ color: 'var(--ink-400)' }}>
            <li>• 定时清理任务在每天凌晨 3:00 自动执行（需在配置中心启用）</li>
            <li>• 清理操作为物理删除，不可恢复，请确认保留天数满足合规要求</li>
            <li>• 建议保留期限不低于 2 年（730 天），以满足审计追溯需求</li>
            <li>• 「立即清理」使用配置中心的保留天数执行一次性清理</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
