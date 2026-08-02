'use client';

import { useEffect } from 'react';

/**
 * 复制保护 Hook
 * 考试期间禁止 copy/cut/paste/右键菜单
 */
export function useCopyProtection(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const preventEvent = (e: Event) => { e.preventDefault(); };
    document.addEventListener('copy', preventEvent);
    document.addEventListener('cut', preventEvent);
    document.addEventListener('paste', preventEvent);
    document.addEventListener('contextmenu', preventEvent);
    return () => {
      document.removeEventListener('copy', preventEvent);
      document.removeEventListener('cut', preventEvent);
      document.removeEventListener('paste', preventEvent);
      document.removeEventListener('contextmenu', preventEvent);
    };
  }, [active]);
}
