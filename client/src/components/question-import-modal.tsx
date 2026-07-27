'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { TYPE_NAMES, ALL_TYPES } from './question-import-config';
import type { ParsedRow } from './question-import-config';
import { parseExcelFile, buildQuestionsPayload, generateTemplate } from './question-import-parser';

export default function QuestionImportModal({ open, onClose, subjects }: { open: boolean; onClose: () => void; subjects: any[] }) {
  const [step, setStep] = useState<'config' | 'preview' | 'result'>('config');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || 1);
  const [enabledTypes, setEnabledTypes] = useState<string[]>(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER']);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentSubject = subjects.find(s => s.id === selectedSubject);
  const subjectCode = currentSubject?.code || '';

  const reset = () => {
    setStep('config');
    setRows([]);
    setResult(null);
    setUploadStatus('idle');
    setUploadError('');
    setSelectedSubject(subjects[0]?.id || 1);
    setEnabledTypes(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER']);
  };

  const downloadTemplate = () => {
    if (enabledTypes.length === 0) { alert('请至少选择一种题型'); return; }
    generateTemplate(enabledTypes, subjectCode, currentSubject?.name || '');
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadStatus('error');
      setUploadError('请上传 .xlsx 格式的文件');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const { rows: parsed, error } = parseExcelFile(data);

      if (error) {
        setUploadStatus('error');
        setUploadError(error);
        return;
      }

      setRows(parsed);
      setUploadStatus('success');
      setTimeout(() => setStep('preview'), 600);
    } catch (e: any) {
      setUploadStatus('error');
      setUploadError('文件解析失败：' + e.message);
    }
  };

  const doImport = async () => {
    setImporting(true);
    const chapterMap: Record<string, number> = {};
    for (const s of subjects) {
      try {
        const chs = await api.chapters.list(s.id);
        chs.forEach((ch: any) => { chapterMap[ch.name] = ch.id; });
      } catch {}
    }

    const questions = buildQuestionsPayload(rows, selectedSubject, chapterMap);

    try {
      const res = await api.questions.batchCreate(questions);
      setResult(res);
      setStep('result');
    } catch (e: any) {
      alert('导入失败：' + e.message);
    }
    setImporting(false);
  };

  const toggleType = (t: string) => {
    setEnabledTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card animate-fadeSlide" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">
            {step === 'config' ? '批量导入试题' : step === 'preview' ? '预览并确认' : '导入结果'}
          </h3>
        </div>

        <div className="modal-body" style={{ minHeight: step === 'config' ? 'auto' : undefined }}>
          {/* ── Step 1: Config + Upload ── */}
          {step === 'config' && (
            <div className="flex gap-6">
              {/* Left: config panel */}
              <div className="flex-1">
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>导入科目</label>
                  <select value={selectedSubject} onChange={e => setSelectedSubject(Number(e.target.value))} className="input select" style={{ width: '100%' }}>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-500)' }}>包含题型</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_TYPES.map(t => {
                      const checked = enabledTypes.includes(t);
                      return (
                        <div key={t} onClick={() => toggleType(t)}
                          className="flex items-center gap-1.5 px-2.5 py-2 border rounded cursor-pointer text-xs transition-all"
                          style={{
                            borderColor: checked ? 'var(--gold)' : 'var(--ink-100)',
                            background: checked ? 'var(--gold-glow)' : 'transparent',
                          }}>
                          <span className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[6px] flex-shrink-0 transition-all"
                            style={{
                              borderColor: checked ? 'var(--gold)' : 'var(--ink-100)',
                              background: checked ? 'var(--gold)' : 'transparent',
                              color: checked ? '#fff' : 'transparent',
                            }}>
                            ✓
                          </span>
                          {TYPE_NAMES[t]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={downloadTemplate} className="btn btn-gold btn-sm">下载模板</button>
                </div>

                <div className="mt-4 p-3 rounded" style={{ background: 'var(--paper)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>填写说明</p>
                  <ul className="text-xs space-y-0.5" style={{ color: 'var(--ink-400)', lineHeight: '1.7' }}>
                    <li>· 每种题型独立一个 sheet 页</li>
                    <li>· 难度：易 / 较易 / 较难 / 难</li>
                    <li>· 单选填 A/B/C/D；多选用逗号分隔</li>
                    <li>· 判断填：正确 / 错误</li>
                    <li>· 填空多个答案用分号分隔</li>
                    <li>· 案例题子问题用 | 分隔</li>
                  </ul>
                </div>
              </div>

              {/* Right: upload area */}
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-500)' }}>上传填好的模板</label>
                <div
                  className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                  style={{
                    minHeight: '260px',
                    borderColor: dragOver ? 'var(--gold)' : uploadStatus === 'success' ? 'var(--cyan)' : uploadStatus === 'error' ? 'var(--verm)' : 'var(--ink-100)',
                    background: dragOver ? 'var(--gold-glow)' : uploadStatus === 'success' ? 'rgba(0,170,140,0.04)' : 'transparent',
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onMouseEnter={e => { if (uploadStatus === 'idle') e.currentTarget.style.borderColor = 'var(--gold)'; }}
                  onMouseLeave={e => { if (uploadStatus === 'idle') e.currentTarget.style.borderColor = 'var(--ink-100)'; }}>
                  {uploadStatus === 'idle' && (
                    <>
                      <span className="text-lg mb-1" style={{ color: 'var(--ink-300)' }}>⬆</span>
                      <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--ink-400)' }}>拖拽文件到此处</p>
                      <p className="text-xs" style={{ color: 'var(--ink-300)' }}>或点击选择 .xlsx 文件</p>
                    </>
                  )}
                  {uploadStatus === 'success' && (
                    <>
                      <span className="text-lg mb-1" style={{ color: 'var(--cyan)' }}>✓</span>
                      <p className="text-sm font-medium" style={{ color: 'var(--cyan)' }}>上传成功</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>正在解析…</p>
                    </>
                  )}
                  {uploadStatus === 'error' && (
                    <>
                      <span className="text-lg mb-1" style={{ color: 'var(--verm)' }}>✕</span>
                      <p className="text-sm font-medium" style={{ color: 'var(--verm)' }}>上传失败</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{uploadError}</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
                  共解析 <strong>{rows.length}</strong> 行，
                  <span style={{ color: 'var(--cyan)' }}>{rows.filter(r => r.errors.length === 0).length} 条有效</span>
                  {rows.filter(r => r.errors.length > 0).length > 0 && (
                    <span className="ml-1" style={{ color: 'var(--verm)' }}>
                      ，{rows.filter(r => r.errors.length > 0).length} 条有误
                    </span>
                  )}
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                {rows.map((r, i) => (
                  <div key={i} className={`text-xs p-2 rounded ${r.errors.length > 0 ? 'border' : ''}`}
                    style={{
                      background: r.errors.length > 0 ? 'var(--verm-glow)' : 'transparent',
                      borderColor: r.errors.length > 0 ? 'var(--verm)' : 'transparent',
                    }}>
                    <span className="font-medium mr-1.5">#{i + 1}</span>
                    <span className="tag tag-ink mr-1.5" style={{ fontSize: '10px' }}>{TYPE_NAMES[r.sheetType]}</span>
                    <span className="mr-1.5">{r.content.substring(0, 60)}{r.content.length > 60 ? '…' : ''}</span>
                    {r.errors.length > 0 && (
                      <span style={{ color: 'var(--verm)' }}> — {r.errors[0]}</span>
                    )}
                  </div>
                ))}
              </div>

              {rows.filter(r => r.errors.length > 0).length > 0 && (
                <p className="text-xs mb-3" style={{ color: 'var(--verm)' }}>
                  有错误的行将被跳过，仅导入有效数据
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 'result' && result && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ background: result.failCount === 0 ? 'var(--cyan-glow)' : result.successCount > 0 ? 'var(--gold-glow)' : 'var(--verm-glow)' }}>
                {result.failCount === 0 ? (
                  <span className="text-xl" style={{ color: 'var(--cyan)' }}>✓</span>
                ) : result.successCount > 0 ? (
                  <span className="text-lg" style={{ color: 'var(--gold)' }}>!</span>
                ) : (
                  <span className="text-lg" style={{ color: 'var(--verm)' }}>✕</span>
                )}
              </div>
              <p className="text-base font-medium mb-2">
                共 <strong>{result.total}</strong> 条，
                <span style={{ color: 'var(--cyan)' }}>成功 {result.successCount}</span>
                {result.failCount > 0 && (
                  <span className="ml-1" style={{ color: 'var(--verm)' }}>，失败 {result.failCount}</span>
                )}
              </p>
              {result.failCount > 0 && (
                <div className="mt-3 max-h-36 overflow-y-auto text-left mx-auto" style={{ maxWidth: '480px' }}>
                  {result.results.filter((r: any) => !r.success).map((r: any) => (
                    <div key={r.index} className="text-xs py-1" style={{ color: 'var(--verm)' }}>
                      # {r.index + 1}: {r.error}
                    </div>
                  ))}
                </div>
              )}
              {result.successCount > 0 && (
                <p className="text-xs mt-4" style={{ color: 'var(--ink-300)' }}>
                  导入的试题已进入题库，可在题库管理中查看
                </p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'config' && (
            <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('config'); setUploadStatus('idle'); setUploadError(''); setRows([]); }} className="btn btn-ghost btn-sm">← 返回</button>
              <button onClick={doImport} disabled={importing || rows.filter(r => r.errors.length === 0).length === 0}
                className="btn btn-gold">
                {importing ? '导入中…' : `开始批量导入试题（${rows.filter(r => r.errors.length === 0).length} 条）`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={() => { onClose(); reset(); }} className="btn btn-ink btn-sm">完成</button>
          )}
        </div>
      </div>
    </div>
  );
}
