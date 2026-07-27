'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 数字从 0 递增到目标值的计数器动画
 * 用 requestAnimationFrame + easeOut 实现，卸载时自动取消
 */
export default function CountUp({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  style,
}: {
  value: number;
  duration?: number; // ms，500-800 为宜
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // 目标值变化时重新开始
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic：先快后慢
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value); // 确保终值精确
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  const formatted = display.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`count-up ${className}`} style={style}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
