import type { CanvasElement } from '@/lib/canvas-renderer/types';
import { AVAILABLE_VARS, inputStyle } from './editor-constants';

export function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="text-[var(--neutral-500)]" style={{ width: 36,  flexShrink: 0 }}>{label}</span>{children}</div>;
}

export function PropertyPanel({ el, updateProp, onToggleLayer }: { el: CanvasElement; updateProp: (k: string, v: any) => void; onToggleLayer: (id: string) => void }) {
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
      {p.src !== undefined && <div>
        <PropRow label="图片源"><input value={p.src} onChange={e => updateProp('src', e.target.value)} style={inputStyle} placeholder="图片地址 或 {{机构变量}}" /></PropRow>
        {/* ★ 2026-08-13 机构图片变量芯片：点击追加到 src，支持 {{orgLogoDataUrl}}/{{orgSealDataUrl}} */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
          {[{ key: 'orgLogoDataUrl', label: '机构Logo' }, { key: 'orgSealDataUrl', label: '机构印章' }].map(v => (
            <button key={v.key} onClick={() => updateProp('src', p.src + '{{' + v.key + '}}')} className="bg-[var(--neutral-50)]" style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--ink-100)', borderRadius: 3, cursor: 'pointer' }} title={'{{' + v.key + '}}'}>{v.label}</button>
          ))}
        </div>
      </div>}
    </div>
  );
}
