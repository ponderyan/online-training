'use client';

import { useEffect, useState, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

type Tab = 'import' | 'export';

const IMPORT_MODULES = [
  { value: 'students', label: '学员' },
  { value: 'questions', label: '试题' },
];

const EXPORT_MODULES = [
  { value: 'students', label: '学员列表' },
  { value: 'exam-sessions', label: '考试成绩' },
  { value: 'certificates', label: '证书列表' },
];

export default function DataManagementPage() {
  const [tab, setTab] = useState<Tab>('import');
  const [activeModule, setActiveModule] = useState('students');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'import') loadImportLogs();
  }, [tab]);

  const loadImportLogs = async () => {
    try {
      const data = await api.data.importLogs();
      setImportLogs(data.items || []);
    } catch {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/data/import/${activeModule}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      loadImportLogs();
    } catch (e: any) { setResult({ error: e.message }); }
    setImporting(false);
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
        <h1 className="page-title">📦 数据管理</h1>
        <p className="page-subtitle">导入学员/试题 · 导出数据报表</p>
      </div>

      <div className="flex gap-1 mb-5 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
        {(['import', 'export'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setResult(null); }}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: tab === t ? 'var(--paper)' : 'transparent', color: tab === t ? 'var(--fox)' : 'var(--ink-400)' }}>
            {t === 'import' ? '📥 导入' : '📤 导出'}
          </button>
        ))}
      </div>

      {tab === 'import' && (
        <div className="space-y-6">
          <div className="card p-6 max-w-lg">
            <div className="space-y-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>导入模块</label>
                <select value={activeModule} onChange={e => { setActiveModule(e.target.value); setResult(null); }} className="input select" style={{ width: 200 }}>
                  {IMPORT_MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer" style={{ borderColor: 'var(--ink-200)' }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
                <p className="text-sm" style={{ color: file ? 'var(--fox)' : 'var(--ink-300)' }}>{file ? file.name : '点击或拖拽选择 Excel 文件'}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--ink-200)' }}>支持 .xlsx .xls .csv</p>
              </div>
              {file && (
                <button onClick={handleImport} disabled={importing} className="btn btn-fox">
                  {importing ? '导入中…' : '开始导入'}
                </button>
              )}
              {result && (
                <div className="p-3 rounded-lg text-xs" style={{ background: result.error ? '#fff5f5' : '#f0faf0' }}>
                  {result.error ? <span style={{ color: '#e53935' }}>❌ {result.error}</span> : (
                    <div style={{ color: 'var(--ink-600)' }}>
                      <p>✅ 导入完成</p>
                      <p>成功：{result.successRows} 行 / 失败：{result.failRows} 行</p>
                      {result.errors?.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer" style={{ color: 'var(--fox)' }}>查看错误详情</summary>
                          <div className="mt-1 max-h-32 overflow-y-auto">
                            {result.errors.map((e: any, i: number) => <p key={i} className="text-[10px]" style={{ color: '#e53935' }}>第{e.row}行: {e.message}</p>)}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-700)' }}>导入历史</h3>
            {importLogs.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无导入记录</p>
            ) : (
              <table className="list-table">
                <thead><tr><th>时间</th><th>模块</th><th>文件名</th><th>操作人</th><th>结果</th></tr></thead>
                <tbody>
                  {importLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-xs">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                      <td><span className="tag tag-cyan text-[10px]">{log.module}</span></td>
                      <td className="text-xs">{log.fileName}</td>
                      <td className="text-xs">{log.operator?.displayName || '—'}</td>
                      <td className="text-xs">{log.successRows}/{log.totalRows} 成功</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'export' && (
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
    </AppLayout>
  );
}
