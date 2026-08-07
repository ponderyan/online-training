'use client';

import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import * as XLSX from 'xlsx';
import type { CanvasDef, TemplateData, RenderMode } from '@/lib/canvas-renderer/types';

const VAR_FIELDS = [
  { key: 'studentName', label: '姓名' },
  { key: 'courseName', label: '课程名' },
  { key: 'certificateNo', label: '证书编号' },
  { key: 'issueDate', label: '发证日期' },
  { key: 'orgName', label: '机构名' },
  { key: 'idCard', label: '身份证(完整)' },
  { key: 'idCardMasked', label: '身份证(脱敏)' },
  { key: 'totalHours', label: '总学时' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
];

export default function BatchGeneratePage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  const toast = useToast();

  const [template, setTemplate] = useState<any>(null);
  const [canvas, setCanvas] = useState<CanvasDef | null>(null);
  const [rows, setRows] = useState<TemplateData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'load' | 'upload' | 'mapping' | 'preview' | 'generating' | 'done'>('load');
  const [progress, setProgress] = useState(0);
  const [renderMode, setRenderMode] = useState<RenderMode>('pdf');
  const [dpi, setDpi] = useState(150);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 加载模板 ──
  const loadTemplate = async () => {
    if (!templateId) { toast.error('缺少模板 ID 参数'); return; }
    try {
      const res = await fetch(`/api/certificate-templates/${templateId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('加载失败');
      const tpl = await res.json();
      setTemplate(tpl);
      setCanvas(tpl.canvasJson as CanvasDef);
      setStep('upload');
    } catch (err) { toast.error((err as Error).message); }
  };

  // ── 解析 Excel ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 }) as any[][];
        if (data.length < 2) { toast.error('Excel 至少需要 2 行（表头+数据）'); return; }

        // 第一行是中文标签，第二行是字段 key，第三行开始是数据
        // 或者第一行是字段 key，第二行开始是数据
        const firstRow = data[0] as string[];
        const secondRow = data[1] as string[];

        let fieldHeaders: string[];
        let dataRows: any[][];

        // 判断第二行是否是字段 key（英文）
        const secondRowIsKey = secondRow && secondRow.some((c: any) => VAR_FIELDS.some(f => f.key === String(c).trim()));
        if (secondRowIsKey) {
          fieldHeaders = secondRow.map((c: any) => String(c).trim());
          dataRows = data.slice(2);
        } else {
          fieldHeaders = firstRow.map((c: any) => String(c).trim());
          dataRows = data.slice(1);
        }

        setHeaders(fieldHeaders);
        // 自动映射：字段名匹配
        const autoMap: Record<string, string> = {};
        for (const f of VAR_FIELDS) {
          const idx = fieldHeaders.findIndex(h => h === f.key || h === f.label);
          if (idx >= 0) autoMap[f.key] = fieldHeaders[idx];
        }
        setMapping(autoMap);

        // 解析数据行
        const parsed: TemplateData[] = dataRows
          .filter(r => r && r.some((c: any) => c != null && c !== ''))
          .map(r => {
            const obj: TemplateData = {};
            fieldHeaders.forEach((h, i) => { obj[h] = r[i] != null ? String(r[i]) : ''; });
            return obj;
          });
        setRows(parsed);
        setStep('mapping');
      } catch (err) { toast.error('Excel 解析失败: ' + (err as Error).message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── 应用映射 → 预览 ──
  const applyMapping = () => {
    setStep('preview');
  };

  // ── 将映射后的数据转换为 TemplateData[] ──
  const getMappedRows = (): TemplateData[] => {
    return rows.map(row => {
      const mapped: TemplateData = {};
      for (const [varKey, colName] of Object.entries(mapping)) {
        if (colName) mapped[varKey] = row[colName] || '';
      }
      return mapped;
    });
  };

  // ── 批量生成 ──
  const handleGenerate = async () => {
    if (!canvas) return;
    setStep('generating');
    setProgress(0);
    try {
      const token = localStorage.getItem('token');
      const mappedRows = getMappedRows();
      const res = await fetch('/api/certificate-templates/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canvas, rows: mappedRows, mode: renderMode, dpi, filenameField: 'studentName' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || '生成失败');
      }
      setProgress(100);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template?.name || '证书'}_批量_${mappedRows.length}份.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStep('done');
      toast.success(`成功生成 ${mappedRows.length} 份证书`);
    } catch (err) {
      toast.error((err as Error).message);
      setStep('preview');
    }
  };

  // ── 下载导入模板 ──
  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/certificate-templates/batch-template?token=${token}`, '_blank');
  };

  const mappedPreview = step === 'preview' || step === 'generating' ? getMappedRows().slice(0, 3) : [];

  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>📦 批量生成证书</h2>

        {/* Step 指示器 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, fontSize: 12 }}>
          {['加载模板', '上传数据', '字段映射', '预览确认', '生成中', '完成'].map((s, i) => (
            <span key={i} style={{
              padding: '3px 10px', borderRadius: 12,
              background: ['load', 'upload', 'mapping', 'preview', 'generating', 'done'].indexOf(step) >= i ? 'var(--fox)' : 'var(--neutral-100)',
              color: ['load', 'upload', 'mapping', 'preview', 'generating', 'done'].indexOf(step) >= i ? '#fff' : 'var(--neutral-400)',
            }}>{i + 1}. {s}</span>
          ))}
        </div>

        {/* Step: 加载模板 */}
        {step === 'load' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p className="text-[var(--neutral-500)]" style={{  marginBottom: 12 }}>模板 ID: {templateId || '未指定'}</p>
            <button onClick={loadTemplate} style={btnPrimary}>加载模板</button>
            {!templateId && <p className="text-[var(--error)]" style={{  fontSize: 12, marginTop: 8 }}>请从模板列表页点击"批量生成"进入</p>}
          </div>
        )}

        {/* Step: 上传 */}
        {step === 'upload' && (
          <div style={{ padding: 20, border: '2px dashed var(--ink-200)', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ marginBottom: 8 }}>模板：<strong>{template?.name}</strong>（{rows.length === 0 ? '等待上传数据' : `${rows.length} 条数据`}）</p>
            <button onClick={() => fileRef.current?.click()} style={btnPrimary}>📂 上传 Excel 文件</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
            <div style={{ marginTop: 12 }}>
              <button onClick={downloadTemplate} className="bg-[var(--neutral-500)]" style={{ ...btnPrimary,  }}>⬇ 下载导入模板</button>
            </div>
            <p className="text-[var(--neutral-400)]" style={{ fontSize: 11,  marginTop: 8 }}>支持 .xlsx / .xls / .csv，单次上限 200 条</p>
          </div>
        )}

        {/* Step: 映射 */}
        {step === 'mapping' && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>字段映射（Excel 列 → 模板变量）</h3>
            <p className="text-[var(--neutral-500)]" style={{ fontSize: 12,  marginBottom: 12 }}>共 {rows.length} 条数据，Excel 列：{headers.join(', ')}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr className="bg-[var(--neutral-50)]">
                  <th style={thStyle}>模板变量</th>
                  <th style={thStyle}>对应 Excel 列</th>
                </tr>
              </thead>
              <tbody>
                {VAR_FIELDS.map(f => (
                  <tr key={f.key} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                    <td style={tdStyle}><code className="bg-[var(--blue-pale)]" style={{  padding: '1px 4px', borderRadius: 3 }}>{'{{' + f.key + '}}'}</code> {f.label}</td>
                    <td style={tdStyle}>
                      <select value={mapping[f.key] || ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))} style={{ padding: '3px 8px', fontSize: 12, border: '1px solid var(--ink-100)', borderRadius: 3 }}>
                        <option value="">（不映射）</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button onClick={applyMapping} style={btnPrimary}>下一步：预览</button>
              <button onClick={() => setStep('upload')} style={btnSecondary}>重新上传</button>
            </div>
          </div>
        )}

        {/* Step: 预览 */}
        {step === 'preview' && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>预览前 3 条数据</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
              <thead>
                <tr className="bg-[var(--neutral-50)]">
                  {Object.keys(mappedPreview[0] || {}).filter(k => mappedPreview[0][k]).map(k => <th key={k} style={thStyle}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {mappedPreview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                    {Object.entries(row).filter(([, v]) => v).map(([k, v]) => <td key={k} style={tdStyle}>{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <label style={{ fontSize: 12 }}>渲染模式：
                <select value={renderMode} onChange={e => setRenderMode(e.target.value as RenderMode)} style={{ marginLeft: 4, fontSize: 12, padding: '2px 6px' }}>
                  <option value="pdf">完整(含底版)</option>
                  <option value="print">打印(仅动态层)</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>分辨率：
                <select value={dpi} onChange={e => setDpi(Number(e.target.value))} style={{ marginLeft: 4, fontSize: 12, padding: '2px 6px' }}>
                  <option value={96}>96 dpi</option>
                  <option value={150}>150 dpi</option>
                  <option value={300}>300 dpi</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGenerate} className="bg-[var(--sage-light)]" style={{ ...btnPrimary,  }}>🚀 开始生成（{rows.length} 份）</button>
              <button onClick={() => setStep('mapping')} style={btnSecondary}>返回映射</button>
            </div>
          </div>
        )}

        {/* Step: 生成中 */}
        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>正在生成 {rows.length} 份证书 PDF...</p>
            <div className="bg-[var(--neutral-100)]" style={{ width: 300, height: 8,  borderRadius: 4, margin: '0 auto', overflow: 'hidden' }}>
              <div className="bg-[var(--fox)]" style={{ width: `${progress}%`, height: '100%',  transition: 'width 0.3s' }} />
            </div>
            <p className="text-[var(--neutral-400)]" style={{ fontSize: 12,  marginTop: 8 }}>请稍候，生成完成后自动下载 ZIP</p>
          </div>
        )}

        {/* Step: 完成 */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p className="text-[var(--sage-light)]" style={{ fontSize: 16,  marginBottom: 12 }}>✅ 批量生成完成！</p>
            <p className="text-[var(--neutral-500)]" style={{ fontSize: 13,  }}>共 {rows.length} 份证书已打包为 ZIP 下载</p>
            <div style={{ marginTop: 16 }}>
              <button onClick={() => { setStep('upload'); setRows([]); }} style={btnPrimary}>继续生成</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: 'var(--fox)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnSecondary: React.CSSProperties = { padding: '8px 20px', background: 'var(--neutral-50)', color: 'var(--neutral-700)', border: '1px solid var(--ink-100)', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #ddd' };
const tdStyle: React.CSSProperties = { padding: '6px 10px' };
