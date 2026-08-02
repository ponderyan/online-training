'use client';

import { type ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex items-center gap-1 border-b border-[var(--ink-100)] ${className}`}>
      {items.map(item => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`
              relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
              transition-colors duration-200 border-b-2 -mb-px
              ${isActive
                ? 'border-[var(--fox)] text-[var(--fox)]'
                : 'border-transparent text-[var(--ink-400)] hover:text-[var(--ink-700)] hover:border-[var(--ink-200)]'
              }
            `}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span className={`
                ml-1 px-1.5 py-0.5 text-xs rounded-full
                ${isActive
                  ? 'bg-[var(--fox-pale)] text-[var(--fox)]'
                  : 'bg-[var(--neutral-100)] text-[var(--ink-400)]'
                }
              `}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
