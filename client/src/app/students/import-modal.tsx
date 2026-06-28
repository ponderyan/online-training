'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  fail: number;
  errors: { row: number; field: string; message: string }[];
}

export default function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const HEADERS = ['姓名', '用户名', '身份证号', '手机号', '邮箱', '工作单位', '邮寄地址', '招生机构名称', '职务', '性别', '学号'];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrors([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
      if (json.length < 2) { setErrors([{ row: 0, message: '文件至少需要表头行+数据行' }]); return; }

      const rows = json.slice(1).filter((r: any) => r[0] || r[1]); // 过滤空行
      const previewRows = rows.slice(0, 10);
      setPreview(previewRows);

      // 校验
      const errs: { row: number; message: string }[] = [];
      const usernames = new Set<string>();
      rows.forEach((r: any, i: number) => {
        const rowNum = i + 2;
        if (!r[1]) errs.push({ row: rowNum, message: '用户名不能为空' });
        if (!r[0]) errs.push({ row: rowNum, message: '姓名不能为空' });
        if (r[2] && !/^\d{17}[\dXx]$/.test(String(r[2]))) errs.push({ row: rowNum, message: '身份证号格式不正确（18位）' });
        if (r[3] && !/^1\d{10}$/.test(String(r[3]))) errs.push({ row: rowNum, message: '手机号格式不正确（11位）' });
        if (r[4] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r[4]))) errs.push({ row: rowNum, message: '邮箱格式不正确' });
        if (r[1] && usernames.has(String(r[1]).trim())) errs.push({ row: rowNum, message: '用户名重复' });
        if (r[1]) usernames.add(String(r[1]).trim());
      });
      setErrors(errs);
    };
    reader.readAsArrayBuffer(f);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ['张三', 'zhangsan', '110101199001011234', '13800138000', 'zs@example.com', '某公司', '北京市朝阳区', 'XX培训中心', '工程师', '男', 'STU001']]);
    XLSX.utils.book_append_sheet(wb, ws, '学员导入');
    XLSX.writeFile(wb, '学员导入模板.xlsx');
  };

  const handleImport = async () => {
    if (!file || errors.length > 0) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('module', 'students');
    try {
      const res = await fetch('/api/data/import/students', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: formData,
      });
      const data = await res.json();
      setResult({ success: data.successRows || 0, fail: data.failRows || 0, errors: data.errors || [] });
      if (data.successRows > 0) onSuccess();
    } catch (e: any) {
      setResult({ success: 0, fail: 0, errors: [{ row: 0, field: '', message: e.message }] });
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-3xl p-6" style={{ background: 'white', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 className="text-lg font-semibold mb-4">📥 导入学员</h2>

        {/* Step 1: Download template */}
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--paper)' }}>
          <button onClick={downloadTemplate} className="btn btn-outline btn-sm">📄 下载导入模板</button>
          <span className="text-xs ml-2" style={{ color: 'var(--ink-300)' }}>.xlsx 格式，含 11 列表头</span>
        </div>

        {/* Step 2: Upload */}
        <div className="mb-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="input w-full" />
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#ef4444' }}>⚠️ 发现 {errors.length} 个问题</p>
            {errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-xs" style={{ color: '#ef4444' }}>第{e.row}行：{e.message}</p>
            ))}
            {errors.length > 5 && <p className="text-xs" style={{ color: '#ef4444' }}>…还有 {errors.length - 5} 个错误</p>}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="list-table text-xs">
              <thead><tr>{HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={errors.some(e => e.row === i + 2) ? { background: '#fef2f2' } : {}}>
                    {HEADERS.map((_, ci) => <td key={ci}>{row[ci] || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {file && <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>已解析 {preview.length} 行（前10行预览）</p>}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: result.fail > 0 ? '#fef2f2' : '#f0faf0' }}>
            <p className="text-sm">✅ 成功 {result.success} 行{result.fail > 0 ? ` · ❌ 失败 ${result.fail} 行` : ''}</p>
            {result.errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-xs" style={{ color: '#ef4444' }}>第{e.row}行：{e.message}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">关闭</button>
          {!result && (
            <button onClick={handleImport} disabled={!file || errors.length > 0 || importing}
              className="btn btn-fox btn-sm">{importing ? '导入中…' : '确认导入'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
