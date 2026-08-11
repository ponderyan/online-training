import type { CanvasElement } from '@/lib/canvas-renderer/types';
import { VAR_LABELS } from './editor-constants';

/** 变量芯片渲染：将 {{var}} 显示为彩色标签 */
export function renderVariableChips(template: string) {
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

export function renderElementPreview(el: CanvasElement) {
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
