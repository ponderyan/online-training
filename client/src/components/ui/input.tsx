'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-[var(--ink-700)]">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={`px-3 py-2 text-sm rounded-[var(--radius-fox)] border transition-colors
            bg-[var(--paper-bright)] text-[var(--ink-800)]
            border-[var(--ink-200)] focus:border-[var(--fox)] focus:ring-1 focus:ring-[var(--fox)]/20
            placeholder:text-[var(--ink-300)] outline-none
            ${error ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20' : ''}
            ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--error)]">{error}</span>}
        {hint && !error && <span className="text-xs text-[var(--ink-400)]">{hint}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
