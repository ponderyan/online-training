'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseTabSwitchOptions {
  /** 是否激活 */
  active: boolean;
  /** 最大允许切屏次数 */
  maxSwitches: number;
  /** 达到警告阈值时的回调 */
  onWarn: (count: number, max: number) => void;
  /** 达到上限时的回调（强制交卷） */
  onExceed: () => void;
}

interface TabSwitchLog {
  time: string;
  duration: number;
  type?: string;
}

/**
 * P3c: 切屏检测 Hook
 * 从 page.tsx 抽取，负责：visibilitychange 监听、计数、日志记录
 */
export function useTabSwitch({ active, maxSwitches, onWarn, onExceed }: UseTabSwitchOptions) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const tabSwitchLogRef = useRef<TabSwitchLog[]>([]);
  const tabSwitchStartRef = useRef<number | null>(null);
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;
  const onExceedRef = useRef(onExceed);
  onExceedRef.current = onExceed;
  const maxRef = useRef(maxSwitches);
  maxRef.current = maxSwitches;

  useEffect(() => {
    if (!active) return;
    const warnThreshold = Math.max(1, maxRef.current - 2);

    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchStartRef.current = Date.now();
        setTabSwitchCount(prev => {
          const next = prev + 1;
          if (next >= maxRef.current) {
            setTimeout(() => onExceedRef.current(), 100);
            return next;
          }
          if (next >= warnThreshold) {
            onWarnRef.current(next, maxRef.current);
          }
          return next;
        });
      } else if (tabSwitchStartRef.current !== null) {
        const duration = Math.round((Date.now() - tabSwitchStartRef.current) / 1000);
        tabSwitchLogRef.current = [...tabSwitchLogRef.current, {
          time: new Date(tabSwitchStartRef.current).toISOString(),
          duration,
        }];
        tabSwitchStartRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active]);

  const addManualLog = useCallback((type: string) => {
    tabSwitchLogRef.current = [...tabSwitchLogRef.current, {
      time: new Date().toISOString(),
      duration: 0,
      type,
    }];
  }, []);

  const getLog = useCallback(() => tabSwitchLogRef.current, []);

  return { tabSwitchCount, getLog, addManualLog };
}
