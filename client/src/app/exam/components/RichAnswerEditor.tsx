'use client';

import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    // Dynamic import Quill (only on client)
    import('quill').then(async ({ default: Quill }) => {
      await import('quill/dist/quill.snow.css');
      if (!editorRef.current || quillRef.current) return;

      const toolbar = [
        [{ header: false }],
        ['bold', 'italic'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['superscript', 'subscript'],
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
        const html = quill.root.innerHTML;
        if (html.length > maxChars * 2) {
          // Rough char limit enforcement
          quill.root.innerHTML = html.slice(0, maxChars * 2);
        }
        onChange(quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML);
      });

      quillRef.current = quill;
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
      <div ref={editorRef}
        className="rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] focus-within:border-[var(--fox)] transition-colors"
        style={{ minHeight: '160px' }} />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[var(--ink-300)]">
          {charCount}/{maxChars} 字
        </span>
      </div>
    </div>
  );
}
