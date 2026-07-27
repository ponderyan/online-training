'use client';

import type { ReactNode } from 'react';

/**
 * 空状态组件 —— 列表无数据时的友好占位
 *
 * 用法：
 *   <EmptyState icon="📊" title="暂无待阅卷考试" />
 *   <EmptyState icon="👥" title="还没有学员" description="点击导入添加学员">
 *     <button className="btn btn-fox">导入学员</button>
 *   </EmptyState>
 */
interface EmptyStateProps {
  /** emoji 或轻量插图 */
  icon?: string;
  /** 主标题，简短、具体 */
  title?: string;
  /** 说明文字，友好、不冰冷 */
  description?: string;
  /** 可选操作区（按钮等），居中显示 */
  children?: ReactNode;
  /** 内边距，默认较大；紧凑列表可用 "small" */
  size?: 'default' | 'small';
}

export default function EmptyState({
  icon = '🦊',
  title = '暂无内容',
  description,
  children,
  size = 'default',
}: EmptyStateProps) {
  const py = size === 'small' ? 'py-8' : 'py-14';
  return (
    <div className={`flex flex-col items-center justify-center text-center ${py} px-4`}>
      <div
        style={{ fontSize: size === 'small' ? '2rem' : '2.6rem', lineHeight: 1, marginBottom: 12, opacity: 0.9 }}
        aria-hidden
      >
        {icon}
      </div>
      <p
        className="font-medium"
        style={{ color: 'var(--ink-500)', fontSize: '0.92rem', marginBottom: description ? 6 : 0 }}
      >
        {title}
      </p>
      {description && (
        <p style={{ color: 'var(--ink-300)', fontSize: '0.8rem', maxWidth: 360 }}>{description}</p>
      )}
      {children && <div className="mt-4 flex items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
