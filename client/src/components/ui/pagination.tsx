'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, onChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  // 生成页码列表（含省略号）
  const pages: (number | '...')[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= delta) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className={`flex items-center justify-center gap-1.5 mt-6 ${className}`}>
      {/* 上一页 */}
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md
          border border-[var(--ink-100)] text-[var(--ink-600)]
          hover:bg-[var(--ink-50)] disabled:opacity-30 disabled:cursor-not-allowed
          transition-colors duration-150"
      >
        <ChevronLeft size={14} />
        上一页
      </button>

      {/* 页码 */}
      {pages.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-[var(--ink-300)]">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`
              min-w-[32px] h-8 px-2 text-xs font-medium rounded-md transition-colors duration-150
              ${p === page
                ? 'bg-[var(--fox)] text-white shadow-sm'
                : 'text-[var(--ink-600)] hover:bg-[var(--ink-50)] border border-[var(--ink-100)]'
              }
            `}
          >
            {p}
          </button>
        )
      )}

      {/* 下一页 */}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md
          border border-[var(--ink-100)] text-[var(--ink-600)]
          hover:bg-[var(--ink-50)] disabled:opacity-30 disabled:cursor-not-allowed
          transition-colors duration-150"
      >
        下一页
        <ChevronRight size={14} />
      </button>

      {/* 总数 */}
      {total != null && (
        <span className="ml-3 text-xs text-[var(--ink-300)]">共 {total} 条</span>
      )}
    </div>
  );
}
