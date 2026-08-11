import type { CanvasElement } from '@/lib/canvas-renderer/types';
import { layerBtnStyle } from './editor-constants';

export function LayerPanel({ elements, selectedId, onSelect, onMove, onLock, onHidden, onToggleLayer }: {
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
