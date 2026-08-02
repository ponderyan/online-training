'use client';

import { useState, useRef } from 'react';

interface CertImageUploaderProps {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  previewStyle?: React.CSSProperties;
  round?: boolean;
}

/** 证书图片上传组件：拖拽/点击上传 + 预览 + 格式校验 */
export default function CertImageUploader({ label, hint, value, uploading, onUpload, onClear, previewStyle, round }: CertImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('格式不支持，请上传 PNG / JPG / SVG / WebP 格式的图片'); return false; }
    if (file.size > 2 * 1024 * 1024) { alert('文件过大，最大支持 2MB'); return false; }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validate(file)) onUpload(file);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validate(file)) onUpload(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative group" style={{ borderRadius: round ? '50%' : '6px', overflow: 'hidden', border: '1px solid var(--ink-100)', background: 'var(--neutral-50)', ...previewStyle }}>
            <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <button onClick={onClear}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none' }} title="移除">✕</button>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center cursor-pointer transition-colors"
            style={{ width: round ? '72px' : '160px', height: round ? '72px' : '56px', borderRadius: round ? '50%' : '8px', border: `1.5px dashed ${dragOver ? 'var(--fox)' : 'var(--ink-200)'}`, background: dragOver ? 'var(--fox-pale)' : 'var(--paper)' }}>
            {uploading ? <span className="text-[10px]" style={{ color: 'var(--fox)' }}>上传中…</span> : (
              <><span className="text-sm">📁</span><span className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>拖拽或点击</span></>
            )}
          </div>
        )}
        {value && (
          <button onClick={() => inputRef.current?.click()} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-400)' }}>
            {uploading ? '上传中…' : '更换'}
          </button>
        )}
      </div>
      <p className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{hint}</p>
      <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>支持 PNG / JPG / SVG / WebP · 最大 2MB · 图片不会变形（等比缩放）</p>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleSelect} className="hidden" />
    </div>
  );
}
