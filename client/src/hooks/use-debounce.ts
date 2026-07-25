import { useState, useEffect } from 'react';

/**
 * 防抖 hook：延迟更新值，避免频繁触发请求
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒），默认 300ms
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
