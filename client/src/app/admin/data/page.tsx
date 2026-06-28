'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const EXPORT_MODULES = [
  { value: 'students', label: '学员列表' },
  { value: 'exam-sessions', label: '考试成绩' },
  { value: 'certificates', label: '证书列表' },
];

export default function DataArchivePage() {
  const [exporting, setExporting] = useState(false);
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [activeExportTab, setActiveExportTab] = useState<'export' | 'logs'>('export');

  useEffect(() => {
    if (activeExportTab === 'logs') loadExportLogs();
  }, [activeExportTab]);

  const loadExportLogs = async () => {
    try {
      const data = await api.data.exportLogs();
      setExportLogs(data.items || []);
    } catch {}
  };

  const handleExport = async (module: string) => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/data/export/${module}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('导出失败'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${module}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('导出失败'); }
    setExporting(false);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">📦 数据归档</h1>
        <p className="page-subtitle">导出数据报表 · 查看导出日志</p>
      </div>

      <div className="flex gap-1 mb-5 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {(['export', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setActiveExportTab(t)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: activeExportTab === t ? 'var(--paper)' : 'transparent', color: activeExportTab === t ? 'var(--fox)' : 'var(--ink-400)' }}>
            {t === 'export' ? '📤 导出' : '📋 导出日志'}
          </button>
        ))}
      </div>

      {activeExportTab === 'export' && (
        <div className="card p-6 max-w-lg">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>📤 导出数据</h3>
          <div className="space-y-2">
            {EXPORT_MODULES.map(m => (
              <div key={m.value} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--paper-dark)' }}>
                <span className="text-sm" style={{ color: 'var(--ink-600)' }}>{m.label}</span>
                <button onClick={() => handleExport(m.value)} disabled={exporting} className="btn btn-fox btn-xs">
                  {exporting ? '导出中…' : '导出 Excel'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeExportTab === 'logs' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>导出日志</h3>
          {exportLogs.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无导出记录</p>
          ) : (
            <table className="list-table">
              <thead><tr><th>时间</th><th>模块</th><th>导出条数</th><th>操作人</th></tr></thead>
              <tbody>
                {exportLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="text-xs">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                    <td><span className="tag tag-cyan text-[10px]">{log.module}</span></td>
                    <td className="text-xs">{log.totalRows || '—'}</td>
                    <td className="text-xs">{log.operator?.displayName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppLayout>
  );
}
