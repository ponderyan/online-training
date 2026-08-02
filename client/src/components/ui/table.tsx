'use client';

import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';

/* ─── Table 容器 ─── */
export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-[var(--ink-100)] ${className}`}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

/* ─── THead ─── */
export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--ink-100)] bg-[var(--neutral-50)]">{children}</tr>
    </thead>
  );
}

/* ─── TH ─── */
interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}
export function TH({ children, className = '', ...props }: THProps) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-400)] whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

/* ─── TBody ─── */
export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/* ─── TR ─── */
export function TR({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-[var(--ink-50)] transition-colors duration-150 hover:bg-[var(--fox-glow)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

/* ─── TD ─── */
interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}
export function TD({ children, className = '', ...props }: TDProps) {
  return (
    <td className={`px-4 py-3 text-[var(--ink-700)] ${className}`} {...props}>
      {children}
    </td>
  );
}

/* ─── 空行占位 ─── */
export function TableEmpty({ colSpan, message = '暂无数据' }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-[var(--ink-300)]">
        {message}
      </td>
    </tr>
  );
}
