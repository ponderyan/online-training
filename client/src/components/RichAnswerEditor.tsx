'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal Quill wrapper for essay/case study questions
export default function RichAnswerEditor({
  value,
  onChange,
  maxChars = 2000,
  placeholder = '请输入你的答案...',
}: {
  value: string;
  onChange: (html: string) => void;
  maxChars?: number;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dynamic import Quill (only on client)
    import('quill').then(async ({ default: Quill }) => {
      await import('quill/dist/quill.snow.css');
      if (!editorRef.current || quillRef.current) return;

      const toolbar = [
        [{ header: [false, 1, 2, 3] }],
        [{ size: ['small', false, 'large'] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['superscript', 'subscript'],
        ['clean'],
      ];

      const quill = new Quill(editorRef.current, {
        theme: 'snow',
        modules: { toolbar },
        placeholder,
      });

      // Set initial value
      if (value) {
        quill.root.innerHTML = value;
      }

      // Handle changes
      quill.on('text-change', () => {
        // 基于纯文本长度限制，避免截断 HTML 标签
        const textLen = quill.getText().length - 1; // Quill 末尾有 

        if (textLen > maxChars) {
          quill.deleteText(maxChars, textLen - maxChars);
        }
        onChange(quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML);
      });

      quillRef.current = quill;
      setLoading(false);
    });

    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update content if value changes externally
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      if (!value) {
        quillRef.current.root.innerHTML = '<p><br></p>';
      } else {
        quillRef.current.root.innerHTML = value;
      }
    }
  }, [value]);

  const charCount = value.replace(/<[^>]*>/g, '').length;

  const pct = Math.min(100, Math.round((charCount / maxChars) * 100));

  return (
    <div>
      <style>{`
        .ql-toolbar.ql-snow {
          border: 1.5px solid var(--ink-100) !important;
          border-bottom: none !important;
          border-radius: 8px 8px 0 0;
          background: var(--paper);
          padding: 6px 8px;
        }
        .ql-container.ql-snow {
          border: 1.5px solid var(--ink-100) !important;
          border-top: none !important;
          border-radius: 0 0 8px 8px;
          font-family: 'Noto Sans SC', sans-serif;
          font-size: 14px;
        }
        .ql-toolbar.ql-snow .ql-picker-item,
        .ql-toolbar.ql-snow button {
          color: var(--ink-500);
        }
        .ql-toolbar.ql-snow .ql-picker-item.ql-selected,
        .ql-toolbar.ql-snow button.ql-active {
          color: var(--fox);
        }
        .ql-toolbar.ql-snow button:hover {
          color: var(--fox);
        }
      `}</style>
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--paper)] rounded-lg border-[1.5px] border-[var(--ink-100)]">
            <span className="text-xs text-[var(--ink-300)] animate-pulse">编辑器加载中…</span>
          </div>
        )}
        <div ref={editorRef}
          className="rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] focus-within:border-[var(--fox)] transition-colors"
          style={{ minHeight: '160px' }} />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-1 rounded-full bg-[var(--ink-100)] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-[var(--verm)]' : pct > 70 ? 'bg-[var(--gold,#f59e0b)]' : 'bg-[var(--fox)]'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs tabular-nums ${pct > 90 ? 'text-[var(--verm)]' : 'text-[var(--ink-300)]'}`}>
          {charCount}/{maxChars}
        </span>
      </div>
    </div>
  );
}
