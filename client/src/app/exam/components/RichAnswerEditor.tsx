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
    import('quill').then(({ default: Quill }) => {
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
      <div ref={editorRef} className="bg-white rounded-lg" style={{ minHeight: '160px', border: '1px solid #e5e7eb' }} />
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
          {charCount}/{maxChars} 字
        </span>
      </div>
    </div>
  );
}
