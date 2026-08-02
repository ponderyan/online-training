'use client';

import { type ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'fox';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--ink-100)] text-[var(--ink-600)]',
  success: 'bg-[var(--success-pale)] text-[var(--sage)]',
  error: 'bg-[var(--error-pale)] text-[var(--error)]',
  warning: 'bg-[var(--warning-pale)] text-[var(--gold)]',
  info: 'bg-[var(--info-pale)] text-[var(--info)]',
  fox: 'bg-[var(--fox-pale)] text-[var(--fox)]',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
