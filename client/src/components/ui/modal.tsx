'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const widthMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, width = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handler);
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler); };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widthMap[width]} bg-[var(--paper-bright)] rounded-[var(--radius-card)] shadow-xl border border-[var(--ink-100)] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-100)]">
            <h2 className="text-lg font-semibold text-[var(--ink-800)]">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--ink-100)] text-[var(--ink-400)] hover:text-[var(--ink-700)] transition-colors bg-transparent border-none cursor-pointer">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-3 border-t border-[var(--ink-100)] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
