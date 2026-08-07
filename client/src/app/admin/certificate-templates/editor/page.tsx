'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { renderCanvasToHtml } from '@/lib/canvas-renderer/renderer';
import type { CanvasDef, CanvasElement, TemplateData, RenderMode, ElementLayer } from '@/lib/canvas-renderer/types';
import Moveable from 'react-moveable';

// ── 默认画布 ──
const DEFAULT_CANVAS: CanvasDef = {
  width: 1123, height: 794, background: 'var(--paper-50)',
  elements: [
    { id: 'border', type: 'rect', x: 30, y: 30, width: 1063, height: 734, name: '边框', props: { fill: 'transparent', stroke: 'var(--fox-dark)', strokeWidth: 3, radius: 8 } },
    { id: 'title', type: 'text', x: 360, y: 80, width: 400, height: 60, name: '标题', props: { content: '结业证书', fontSize: 42, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: 'var(--fox-dark)', textAlign: 'center' } },
    { id: 'body', type: 'variable-text', x: 150, y: 250, width: 820, height: 120, name: '正文', props: { template: '兹证明 {{studentName}} 同志参加 {{courseName}} 培训课程，经考核成绩合格，特发此证。', fontSize: 22, fontFamily: 'SimSun, serif', color: 'var(--neutral-700)', lineHeight: 1.8 } },
    { id: 'date', type: 'auto-field', x: 700, y: 650, width: 300, height: 30, name: '发证日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'SimSun, serif', color: 'var(--neutral-500)', textAlign: 'right' } },
    { id: 'divider1', type: 'divider', x: 150, y: 420, width: 820, height: 0, name: '分割线', props: { style: 'solid', color: 'var(--neutral-200)', thickness: 1 } },
  ],
};

const DEFAULT_DATA: TemplateData = { studentName: '张三', courseName: '人工智能应用', certificateNo: 'CERT-2026-001', issueDate: '2026-07-30', orgName: '示例机构' };

const AVAILABLE_VARS = [
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

let idCounter = 200;
function genId() { return `el_${++idCounter}_${Date.now().toString(36)}`; }
const clampScale = (s: number) => Math.min(2, Math.max(0.2, Math.round(s * 100) / 100));

// ── Undo/Redo Hook ──
function useHistory<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const history = useRef<T[]>([initial]);
  const idx = useRef(0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState(prev => {
      const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      history.current = history.current.slice(0, idx.current + 1);
      history.current.push(val);
      if (history.current.length > 50) history.current.shift();
      idx.current = history.current.length - 1;
      return val;
    });
  }, []);

  const undo = useCallback(() => {
    if (idx.current > 0) { idx.current--; setState(history.current[idx.current]); }
  }, []);

  const redo = useCallback(() => {
    if (idx.current < history.current.length - 1) { idx.current++; setState(history.current[idx.current]); }
  }, []);

  const canUndo = idx.current > 0;
  const canRedo = idx.current < history.current.length - 1;

  return { state, set, undo, redo, canUndo, canRedo };
}

export default function CertificateTemplateEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  const toast = useToast();

  const { state: canvas, set: setCanvas, undo, redo, canUndo, canRedo } = useHistory<CanvasDef>(DEFAULT_CANVAS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<TemplateData>(DEFAULT_DATA);
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(0.65);
  const [rightPanel, setRightPanel] = useState<'props' | 'layers'>('props');
  const [showPreviewVars, setShowPreviewVars] = useState(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const [splitHover, setSplitHover] = useState(false);
  const [templateName, setTemplateName] = useState('未命名模板');
  const [renderMode, setRenderMode] = useState<RenderMode>('preview');
  const [exportDpi, setExportDpi] = useState(150);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── 缩放控制 ──
  const zoomIn = useCallback(() => setScale(s => clampScale(s + 0.1)), []);
  const zoomOut = useCallback(() => setScale(s => clampScale(s - 0.1)), []);
  const zoomFit = useCallback(() => {
    const el = canvasAreaRef.current;
    if (!el) { setScale(0.65); return; }
    const pad = 60;
    setScale(clampScale(Math.min((el.clientWidth - pad) / canvas.width, (el.clientHeight - pad) / canvas.height)));
  }, [canvas.width, canvas.height]);

  // ── 加载已有模板 ──
  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/certificate-templates/${templateId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(tpl => {
      if (tpl.canvasJson) setCanvas(tpl.canvasJson as CanvasDef);
      if (tpl.name) setTemplateName(tpl.name);
    }).catch(() => toast.error('加载模板失败'));
  }, [templateId]);

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          deleteSelected();
        }
      }
      // 缩放快捷键
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoomFit(); }
      // 方向键微调（Shift=10px）
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId
          && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => {
          if (el.id !== selectedId) return el;
          if (e.key === 'ArrowUp') return { ...el, y: el.y - d } as CanvasElement;
          if (e.key === 'ArrowDown') return { ...el, y: el.y + d } as CanvasElement;
          if (e.key === 'ArrowLeft') return { ...el, x: el.x - d } as CanvasElement;
          if (e.key === 'ArrowRight') return { ...el, x: el.x + d } as CanvasElement;
          return el;
        }) }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, undo, redo, zoomIn, zoomOut, zoomFit]);

  // ── Ctrl/Cmd + 滚轮缩放 ──
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(s => clampScale(s + (e.deltaY < 0 ? 0.08 : -0.08)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── 右栏宽度拖拽 ──
  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelWidth(Math.min(480, Math.max(240, Math.round(rect.right - e.clientX))));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // ── 元素操作 ──
  const addElement = (type: 'text' | 'rect' | 'variable-text' | 'divider' | 'image' | 'qrcode' | 'seal' | 'barcode') => {
    const id = genId();
    let newEl: CanvasElement;
    const cx = Math.round(canvas.width / 2 - 100);
    const cy = Math.round(canvas.height / 2 - 20);
    switch (type) {
      case 'text':
        newEl = { id, type: 'text', x: cx, y: cy, width: 200, height: 40, name: '文本', props: { content: '新文本', fontSize: 18, fontFamily: 'sans-serif', color: 'var(--neutral-700)', textAlign: 'left' } };
        break;
      case 'rect':
        newEl = { id, type: 'rect', x: cx, y: cy, width: 200, height: 100, name: '矩形', props: { fill: 'var(--neutral-100)', stroke: 'var(--neutral-400)', strokeWidth: 1, radius: 4 } };
        break;
      case 'variable-text':
        newEl = { id, type: 'variable-text', x: cx, y: cy, width: 400, height: 60, name: '变量文本', props: { template: '{{studentName}}', fontSize: 18, fontFamily: 'sans-serif', color: 'var(--neutral-700)', textAlign: 'left' } };
        break;
      case 'divider':
        newEl = { id, type: 'divider', x: 100, y: cy, width: canvas.width - 200, height: 0, name: '分割线', props: { style: 'solid', color: 'var(--neutral-200)', thickness: 1 } };
        break;
      case 'image':
        newEl = { id, type: 'image', x: cx, y: cy, width: 120, height: 120, name: '图片', props: { src: '', fit: 'contain' } };
        break;
      case 'qrcode':
        newEl = { id, type: 'qrcode', x: cx, y: cy, width: 100, height: 100, name: '二维码', props: { dataTemplate: 'https://verify.example.com/{{certificateNo}}', label: '扫码验证', labelFontSize: 10 } };
        break;
      case 'seal':
        newEl = { id, type: 'seal', x: cx, y: cy, width: 120, height: 120, name: '印章', props: { shape: 'circle', text: '培训认证专用章', subText: '★', color: 'var(--error)', fontSize: 12 } };
        break;
      case 'barcode':
        newEl = { id, type: 'barcode', x: cx, y: cy, width: 200, height: 50, name: '条形码', props: { dataTemplate: '{{certificateNo}}', format: 'CODE128', color: 'var(--ink-900)', showText: true } };
        break;
      default:
        return;
    }
    setCanvas(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setCanvas(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== selectedId) }));
    setSelectedId(null);
  };

  const moveLayer = (id: string, dir: 'up' | 'down') => {
    setCanvas(prev => {
      const els = [...prev.elements];
      const i = els.findIndex(e => e.id === id);
      if (i < 0) return prev;
      const j = dir === 'up' ? i + 1 : i - 1;
      if (j < 0 || j >= els.length) return prev;
      [els[i], els[j]] = [els[j], els[i]];
      return { ...prev, elements: els };
    });
  };

  const toggleLock = (id: string) => {
    setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, locked: !el.locked } : el) }));
  };

  const toggleHidden = (id: string) => {
    setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, hidden: !el.hidden } : el) }));
  };

  // ── 保存 ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body = { name: templateName, canvasJson: canvas };
      const url = templateId ? `/api/certificate-templates/${templateId}` : '/api/certificate-templates';
      const method = templateId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('保存失败');
      const saved = await res.json();
      if (!templateId) router.replace(`/admin/certificate-templates/editor?id=${saved.id}`);
      toast.success('已保存');
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  };

  // ── 导出 PDF ──
  const exportPdf = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/certificate-templates/render-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canvas, data: previewData, filename: `${templateName}.pdf`, mode: renderMode, dpi: exportDpi }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${templateName}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error('导出失败: ' + (err as Error).message); }
    finally { setExporting(false); }
  };

  // ── 底版图上传 ──
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 PNG/JPG/SVG/WebP 格式');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('底版图片不能超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCanvas(prev => ({ ...prev, backgroundImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearBgImage = () => {
    setCanvas(prev => ({ ...prev, backgroundImage: undefined }));
  };

  // ── 图层归属切换 ──
  const toggleLayer = (id: string) => {
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== id) return el;
        const newLayer: ElementLayer = el.layer === 'design' ? 'dynamic' : 'design';
        return { ...el, layer: newLayer } as CanvasElement;
      }),
    }));
  };

  // ── 属性更新 ──
  const selectedEl = canvas.elements.find(el => el.id === selectedId);
  const updateProp = (key: string, value: any) => {
    if (!selectedId) return;
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== selectedId) return el;
        if (['x', 'y', 'width', 'height', 'rotation', 'opacity'].includes(key)) return { ...el, [key]: value } as CanvasElement;
        return { ...el, props: { ...el.props, [key]: value } } as CanvasElement;
      }),
    }));
  };

  // ── 对齐到画布 ──
  const alignToCanvas = (align: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
    if (!selectedId) return;
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== selectedId) return el;
        switch (align) {
          case 'left': return { ...el, x: 0 } as CanvasElement;
          case 'centerH': return { ...el, x: Math.round((prev.width - el.width) / 2) } as CanvasElement;
          case 'right': return { ...el, x: prev.width - el.width } as CanvasElement;
          case 'top': return { ...el, y: 0 } as CanvasElement;
          case 'centerV': return { ...el, y: Math.round((prev.height - el.height) / 2) } as CanvasElement;
          case 'bottom': return { ...el, y: prev.height - el.height } as CanvasElement;
          default: return el;
        }
      }),
    }));
  };


  // ── 吸附参考线（其他元素 DOM 节点） ──
  const elementGuidelines = useMemo(() => {
    if (!canvasRef.current || !selectedId) return [];
    return Array.from(canvasRef.current.querySelectorAll('[data-el-id]'))
      .filter(n => n.getAttribute('data-el-id') !== selectedId) as HTMLElement[];
  }, [selectedId, canvas.elements]);

  // ── Moveable target ref ──
  const getTargetEl = useCallback((): HTMLElement | null => {
    if (!selectedId || !canvasRef.current) return null;
    return canvasRef.current.querySelector(`[data-el-id="${selectedId}"]`) as HTMLElement;
  }, [selectedId]);

  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setMoveableTarget(getTargetEl()); }, [selectedId, canvas.elements.length, getTargetEl]);

  return (
    <AppLayout fullBleed>
      <div className="bg-[var(--neutral-50)]" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',  }}>
        {/* ═══ 顶栏 ═══ */}
        <div className="bg-[var(--paper-bright)]" style={{ padding: '6px 12px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, rowGap: 4,  fontSize: 13 }}>
          <button onClick={() => router.push('/admin/certificate-templates')} title="返回模板列表" style={{ ...toolBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}>← 返回</button>
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <input value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ border: 'none', fontSize: 14, fontWeight: 600, width: 180, outline: 'none' }} />
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <button onClick={undo} disabled={!canUndo} title="撤销 (⌘Z)" style={toolBtnStyle}>↩</button>
          <button onClick={redo} disabled={!canRedo} title="重做 (⌘Z)" style={toolBtnStyle}>↪</button>
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <button onClick={() => addElement('text')} style={toolBtnStyle}>T 文本</button>
          <button onClick={() => addElement('variable-text')} style={toolBtnStyle}>{'{{}'} 变量</button>
          <button onClick={() => addElement('rect')} style={toolBtnStyle}>□ 矩形</button>
          <button onClick={() => addElement('divider')} style={toolBtnStyle}>— 线</button>
          <button onClick={() => addElement('image')} style={toolBtnStyle}>🖼 图</button>
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <button onClick={deleteSelected} disabled={!selectedId} style={{ ...toolBtnStyle, color: selectedId ? 'var(--error)' : 'var(--neutral-200)' }}>🗑</button>
          {selectedId && <>
            <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
            <span className="text-[var(--neutral-400)]" style={{ fontSize: 10,  }}>对齐</span>
            <button onClick={() => alignToCanvas('left')} style={toolBtnStyle} title="左对齐">⇤</button>
            <button onClick={() => alignToCanvas('centerH')} style={toolBtnStyle} title="水平居中">⇔</button>
            <button onClick={() => alignToCanvas('right')} style={toolBtnStyle} title="右对齐">⇥</button>
            <button onClick={() => alignToCanvas('top')} style={toolBtnStyle} title="顶对齐">⤒</button>
            <button onClick={() => alignToCanvas('centerV')} style={toolBtnStyle} title="垂直居中">⇕</button>
            <button onClick={() => alignToCanvas('bottom')} style={toolBtnStyle} title="底对齐">⤓</button>
          </>}
          <div style={{ flex: 1 }} />
          <button onClick={zoomOut} style={toolBtnStyle} title="缩小 (⌘-)">−</button>
          <span className="text-[var(--neutral-500)]" style={{ fontSize: 11,  width: 40, textAlign: 'center', cursor: 'pointer' }} onClick={zoomFit} title="点击适应窗口 (⌘0)">{(scale * 100).toFixed(0)}%</span>
          <button onClick={zoomIn} style={toolBtnStyle} title="放大 (⌘+)">＋</button>
          <button onClick={zoomFit} style={toolBtnStyle} title="适应窗口 (⌘0)">⤢</button>
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <button onClick={() => bgFileRef.current?.click()} style={toolBtnStyle} title="上传底版图片">🖼 底版</button>
          <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
          {canvas.backgroundImage && <button onClick={clearBgImage} className="text-[var(--error)]" style={{ ...toolBtnStyle,  }} title="清除底版">✕底版</button>}
          <div className="bg-[var(--neutral-200)]" style={{ width: 1, height: 20,  }} />
          <select value={renderMode} onChange={e => setRenderMode(e.target.value as RenderMode)} style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--ink-100)', borderRadius: 3 }} title="渲染模式">
            <option value="preview">预览(全部)</option>
            <option value="print">打印(动态层)</option>
            <option value="pdf">PDF(全部)</option>
          </select>
          <select value={exportDpi} onChange={e => setExportDpi(Number(e.target.value))} style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--ink-100)', borderRadius: 3 }} title="导出分辨率">
            <option value={96}>96dpi</option>
            <option value={150}>150dpi</option>
            <option value={300}>300dpi</option>
          </select>
          <button onClick={() => setShowPreview(!showPreview)} style={toolBtnStyle}>{showPreview ? '✏️ 编辑' : '👁 预览'}</button>
          <button onClick={exportPdf} disabled={exporting} className="bg-[var(--neutral-50)]" style={{ ...toolBtnStyle,  }}>{exporting ? '...' : '📄 PDF'}</button>
          <button onClick={handleSave} disabled={saving} className="bg-[var(--fox)] text-[#fff]" style={{ padding: '4px 14px',   border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>{saving ? '保存中' : '💾 保存'}</button>
        </div>

        {/* ═══ 主体 ═══ */}
        <div ref={bodyRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 画布区 */}
          <div ref={canvasAreaRef} className="bg-[var(--neutral-200)]" style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 30,  }}>
            {showPreview ? (
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} dangerouslySetInnerHTML={{ __html: renderCanvasToHtml(canvas, previewData, { mode: renderMode }) }} />
            ) : (
              <div style={{ position: 'relative', transform: `scale(${scale})`, transformOrigin: 'top center' }}>
                <div
                  ref={canvasRef}
                  onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
                  style={{ position: 'relative', width: canvas.width, height: canvas.height, background: canvas.background, backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined, backgroundSize: canvas.backgroundImageFit || 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', boxShadow: '0 2px 16px rgba(0,0,0,0.15)', overflow: 'hidden' }}
                >
                  {canvas.elements.map(el => (
                    <div
                      key={el.id}
                      data-el-id={el.id}
                      onClick={e => { e.stopPropagation(); if (!el.locked) setSelectedId(el.id); }}
                      style={{
                        position: 'absolute', left: el.x, top: el.y, width: el.width,
                        height: Math.max(el.height, el.type === 'divider' ? 6 : el.height),
                        cursor: el.locked ? 'not-allowed' : 'move',
                        opacity: el.hidden ? 0.2 : (el.layer === 'design' && renderMode === 'print' ? 0.15 : (el.opacity ?? 1)),
                        outline: selectedId === el.id ? '2px solid #1976d2' : (el.layer === 'design' ? '1px dashed #ff9800' : 'none'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', userSelect: 'none',
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      }}
                    >
                      {renderElementPreview(el)}
                    </div>
                  ))}
                </div>
                {/* Moveable */}
                {moveableTarget && selectedEl && !selectedEl.locked && (
                  <Moveable
                    ref={moveableRef as any}
                    target={moveableTarget}
                    draggable={true}
                    resizable={true}
                    rotatable={true}
                    snappable={true}
                    snapThreshold={6}
                    isDisplaySnapDigit={true}
                    elementGuidelines={elementGuidelines}
                    verticalGuidelines={[0, canvas.width / 2, canvas.width]}
                    horizontalGuidelines={[0, canvas.height / 2, canvas.height]}
                    bounds={{ left: 0, top: 0, right: canvas.width, bottom: canvas.height }}
                    edge={false}
                    throttleDrag={1}
                    throttleResize={1}
                    throttleRotate={1}
                    renderDirections={['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']}
                    onDrag={e => {
                      setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedId ? { ...el, x: Math.round(e.left), y: Math.round(e.top) } as CanvasElement : el) }));
                    }}
                    onResize={e => {
                      setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedId ? { ...el, width: Math.round(e.width), height: Math.round(e.height), x: Math.round(e.drag.left), y: Math.round(e.drag.top) } as CanvasElement : el) }));
                    }}
                    onRotate={e => {
                      setCanvas(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedId ? { ...el, rotation: Math.round(e.rotate) } as CanvasElement : el) }));
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* 可拖拽分割线（调整右栏宽度，双击复位） */}
          <div
            onMouseDown={() => setDragging(true)}
            onMouseEnter={() => setSplitHover(true)}
            onMouseLeave={() => setSplitHover(false)}
            onDoubleClick={() => setPanelWidth(300)}
            title="拖拽调整宽度，双击复位"
            style={{ width: 5, flexShrink: 0, cursor: 'col-resize', borderLeft: '1px solid var(--ink-100)', background: dragging ? 'var(--color-fox)' : splitHover ? 'rgba(232,122,48,0.35)' : 'transparent', transition: dragging ? 'none' : 'background .15s' }}
          />

          {/* ═══ 右侧面板 ═══ */}
          <div className="bg-[var(--paper-bright)]" style={{ width: panelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',  }}>
            {/* Tab 切换 */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-100)' }}>
              <button onClick={() => setRightPanel('props')} style={tabStyle(rightPanel === 'props')}>属性</button>
              <button onClick={() => setRightPanel('layers')} style={tabStyle(rightPanel === 'layers')}>图层</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 10, fontSize: 12 }}>
              {rightPanel === 'props' ? (
                selectedEl ? <PropertyPanel el={selectedEl} updateProp={updateProp} onToggleLayer={toggleLayer} /> : <p className="text-[var(--neutral-400)]" style={{  textAlign: 'center', marginTop: 40 }}>选择元素查看属性</p>
              ) : (
                <LayerPanel elements={canvas.elements} selectedId={selectedId} onSelect={setSelectedId} onMove={moveLayer} onLock={toggleLock} onHidden={toggleHidden} onToggleLayer={toggleLayer} />
              )}
            </div>

            {/* 预览数据（可折叠，默认收起以释放属性/图层空间） */}
            <div style={{ borderTop: '1px solid var(--ink-100)', fontSize: 12 }}>
              <button onClick={() => setShowPreviewVars(v => !v)} className="text-[var(--neutral-500)]" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',  }}>
                <span>🧪 预览变量</span>
                <span className="text-[var(--neutral-300)]" style={{  fontSize: 10 }}>{showPreviewVars ? '▾' : '▸'}</span>
              </button>
              {showPreviewVars && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <PropRow label="姓名"><input value={previewData.studentName || ''} onChange={e => setPreviewData(d => ({ ...d, studentName: e.target.value }))} style={inputStyle} /></PropRow>
                  <PropRow label="课程"><input value={previewData.courseName || ''} onChange={e => setPreviewData(d => ({ ...d, courseName: e.target.value }))} style={inputStyle} /></PropRow>
                  <PropRow label="日期"><input value={previewData.issueDate || ''} onChange={e => setPreviewData(d => ({ ...d, issueDate: e.target.value }))} style={inputStyle} /></PropRow>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════

/** 变量芯片渲染：将 {{var}} 显示为彩色标签 */
const VAR_LABELS: Record<string, string> = { studentName: '姓名', courseName: '课程', certificateNo: '编号', issueDate: '日期', orgName: '机构', idCard: '身份证', idCardMasked: '身份证(脱敏)', totalHours: '学时', startDate: '开始', endDate: '结束', verificationCode: '验证码' };
function renderVariableChips(template: string) {
  const parts = template.split(/(\{\{\s*\w+\s*\}\})/g);
  return parts.map((part, i) => {
    const m = part.match(/\{\{\s*(\w+)\s*\}\}/);
    if (m) {
      const label = VAR_LABELS[m[1]] || m[1];
      return <span key={i} className="bg-[var(--blue-pale)] text-[var(--blue)]" style={{   padding: '0 4px', borderRadius: 3, fontSize: '0.9em', fontWeight: 500 }}>[{label}]</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderElementPreview(el: CanvasElement) {
  const p = el.props as any;
  switch (el.type) {
    case 'text': return <span style={{ fontSize: p.fontSize, color: p.color, fontWeight: p.fontWeight, whiteSpace: 'pre-wrap' }}>{p.content}</span>;
    case 'variable-text': return <span style={{ fontSize: p.fontSize, color: p.color, whiteSpace: 'pre-wrap' }}>{renderVariableChips(p.template)}</span>;
    case 'rect': return <div style={{ width: '100%', height: '100%', background: p.fill || 'transparent', border: `${p.strokeWidth || 1}px ${p.borderStyle || 'solid'} ${p.stroke || 'var(--neutral-200)'}`, borderRadius: p.radius || 0 }} />;
    case 'divider': return <div style={{ width: '100%', borderTop: `${p.thickness}px ${p.style} ${p.color}` }} />;
    case 'auto-field': return <span style={{ fontSize: p.fontSize, color: p.color }}>[{p.field}]</span>;
    case 'image': return p.src ? <img src={p.src} style={{ width: '100%', height: '100%', objectFit: p.fit || 'contain' }} alt="" /> : <span className="text-[var(--neutral-200)]" style={{  fontSize: 11 }}>🖼 图片</span>;
    case 'qrcode': return <div className="bg-[var(--neutral-50)]" style={{ width: '100%', height: '100%', border: '1px dashed #999', display: 'flex', alignItems: 'center', justifyContent: 'center',  flexDirection: 'column' as const }}><span style={{ fontSize: 20 }}>⊞</span><span className="text-[var(--neutral-400)]" style={{ fontSize: 9,  }}>QR</span></div>;
    case 'seal': return <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid ' + (p.color || 'var(--error)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color || 'var(--error)', fontSize: 10, textAlign: 'center' as const }}>{p.text || '印章'}</div>;
    case 'barcode': return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)' }}><span className="bg-[var(--paper-bright)]" style={{  padding: '0 4px', fontSize: 9 }}>{p.dataTemplate}</span></div>;
    default: return <span className="text-[var(--neutral-400)]" style={{  fontSize: 11 }}>[{el.type}]</span>;
  }
}

function PropertyPanel({ el, updateProp, onToggleLayer }: { el: CanvasElement; updateProp: (k: string, v: any) => void; onToggleLayer: (id: string) => void }) {
  const p = el.props as any;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <PropRow label="名称"><input value={el.name || ''} onChange={e => updateProp('name', e.target.value)} style={inputStyle} /></PropRow>
      <PropRow label="图层">
        <button onClick={() => onToggleLayer(el.id)} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid ' + (el.layer === 'design' ? 'var(--fox-light)' : 'var(--sage-light)'), borderRadius: 3, background: el.layer === 'design' ? 'var(--fox-pale)' : 'var(--success-pale)', cursor: 'pointer' }}>
          {el.layer === 'design' ? '🎨 底版层' : '🖨 打印层'}
        </button>
        <span className="text-[var(--neutral-400)]" style={{ fontSize: 10,  marginLeft: 4 }}>{el.layer === 'design' ? '打印时跳过' : '打印时输出'}</span>
      </PropRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <PropRow label="X"><input type="number" value={el.x} onChange={e => updateProp('x', Number(e.target.value))} style={inputStyle} /></PropRow>
        <PropRow label="Y"><input type="number" value={el.y} onChange={e => updateProp('y', Number(e.target.value))} style={inputStyle} /></PropRow>
        <PropRow label="W"><input type="number" value={el.width} onChange={e => updateProp('width', Number(e.target.value))} style={inputStyle} /></PropRow>
        <PropRow label="H"><input type="number" value={el.height} onChange={e => updateProp('height', Number(e.target.value))} style={inputStyle} /></PropRow>
      </div>
      {el.rotation !== undefined && <PropRow label="旋转"><input type="number" value={el.rotation} onChange={e => updateProp('rotation', Number(e.target.value))} style={inputStyle} />°</PropRow>}
      {p.content !== undefined && <PropRow label="内容"><textarea value={p.content} onChange={e => updateProp('content', e.target.value)} style={{ ...inputStyle, height: 50, resize: 'vertical' }} /></PropRow>}
      {p.template !== undefined && <div><PropRow label="模板"><textarea value={p.template} onChange={e => updateProp('template', e.target.value)} style={{ ...inputStyle, height: 50, resize: 'vertical' }} /></PropRow><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>{AVAILABLE_VARS.map(v => <button key={v.key} onClick={() => updateProp('template', p.template + '{{' + v.key + '}}')} className="bg-[var(--neutral-50)]" style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--ink-100)', borderRadius: 3,  cursor: 'pointer' }} title={'{{' + v.key + '}}'}>{v.label}</button>)}</div></div>}
      {p.fontSize !== undefined && <PropRow label="字号"><input type="number" value={p.fontSize} onChange={e => updateProp('fontSize', Number(e.target.value))} style={{ ...inputStyle, width: 60 }} /></PropRow>}
      {p.fontFamily !== undefined && <PropRow label="字体"><input value={p.fontFamily} onChange={e => updateProp('fontFamily', e.target.value)} style={inputStyle} /></PropRow>}
      {p.color !== undefined && <PropRow label="颜色"><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="color" value={p.color} onChange={e => updateProp('color', e.target.value)} style={{ width: 28, height: 22, border: 'none', padding: 0 }} /><input value={p.color} onChange={e => updateProp('color', e.target.value)} style={{ ...inputStyle, flex: 1 }} /></div></PropRow>}
      {p.textAlign !== undefined && <PropRow label="对齐"><select value={p.textAlign} onChange={e => updateProp('textAlign', e.target.value)} style={inputStyle}><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></PropRow>}
      {p.stroke !== undefined && <PropRow label="边框色"><input type="color" value={p.stroke} onChange={e => updateProp('stroke', e.target.value)} style={{ width: 28, height: 22, border: 'none' }} /></PropRow>}
      {p.strokeWidth !== undefined && <PropRow label="边框宽"><input type="number" value={p.strokeWidth} onChange={e => updateProp('strokeWidth', Number(e.target.value))} style={{ ...inputStyle, width: 50 }} /></PropRow>}
      {p.fill !== undefined && <PropRow label="填充"><input value={p.fill} onChange={e => updateProp('fill', e.target.value)} style={inputStyle} /></PropRow>}
      {p.src !== undefined && <PropRow label="URL"><input value={p.src} onChange={e => updateProp('src', e.target.value)} style={inputStyle} placeholder="图片地址" /></PropRow>}
    </div>
  );
}

function LayerPanel({ elements, selectedId, onSelect, onMove, onLock, onHidden, onToggleLayer }: {
  elements: CanvasElement[]; selectedId: string | null;
  onSelect: (id: string) => void; onMove: (id: string, dir: 'up' | 'down') => void;
  onLock: (id: string) => void; onHidden: (id: string) => void; onToggleLayer: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[...elements].reverse().map(el => (
        <div
          key={el.id}
          onClick={() => onSelect(el.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
            background: selectedId === el.id ? 'var(--blue-pale)' : 'transparent',
            opacity: el.hidden ? 0.4 : 1,
            borderLeft: el.layer === 'design' ? '3px solid #ff9800' : '3px solid transparent',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {el.layer === 'design' && <span title="底版层" style={{ marginRight: 2 }}>🎨</span>}
            {el.name || el.type}
          </span>
          <button onClick={e => { e.stopPropagation(); onToggleLayer(el.id); }} title={el.layer === 'design' ? '切换为打印层' : '切换为底版层'} style={layerBtnStyle}>{el.layer === 'design' ? '🎨' : '🖨'}</button>
          <button onClick={e => { e.stopPropagation(); onHidden(el.id); }} title={el.hidden ? '显示' : '隐藏'} style={layerBtnStyle}>{el.hidden ? '👁‍' : ''}</button>
          <button onClick={e => { e.stopPropagation(); onLock(el.id); }} title={el.locked ? '解锁' : '锁定'} style={layerBtnStyle}>{el.locked ? '🔒' : '🔓'}</button>
          <button onClick={e => { e.stopPropagation(); onMove(el.id, 'up'); }} style={layerBtnStyle}>↑</button>
          <button onClick={e => { e.stopPropagation(); onMove(el.id, 'down'); }} style={layerBtnStyle}>↓</button>
        </div>
      ))}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="text-[var(--neutral-500)]" style={{ width: 36,  flexShrink: 0 }}>{label}</span>{children}</div>;
}

// ── 样式常量 ──
const toolBtnStyle: React.CSSProperties = { padding: '3px 8px', background: 'none', border: '1px solid var(--ink-100)', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const inputStyle: React.CSSProperties = { flex: 1, padding: '2px 6px', border: '1px solid var(--ink-100)', borderRadius: 3, fontSize: 12, minWidth: 0 };
const layerBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '0 2px' };
function tabStyle(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '6px 0', border: 'none', background: active ? '#fff' : 'var(--neutral-50)', borderBottom: active ? '2px solid #e87d30' : '2px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400 };
}
