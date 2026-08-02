'use client';

import { useEffect, useRef } from 'react';

interface UseInactiveDetectionOptions {
  active: boolean;
  /** 无操作警告时间（ms），默认 5 分钟 */
  warnMs?: number;
  /** 无操作自动交卷时间（ms），默认 7 分钟 */
  submitMs?: number;
  onWarn: () => void;
  onSubmit: () => void;
}

/**
 * 无操作检测 Hook
 * 5分钟无操作警告，再2分钟自动交卷
 */
export function useInactiveDetection({ active, warnMs = 5 * 60 * 1000, submitMs = 7 * 60 * 1000, onWarn, onSubmit }: UseInactiveDetectionOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const warnedRef = useRef(false);
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (!active) return;
    const resetActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(evt => document.addEventListener(evt, resetActivity, { passive: true }));

    const checker = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= submitMs) {
        clearInterval(checker);
        onSubmitRef.current();
      } else if (idle >= warnMs && !warnedRef.current) {
        warnedRef.current = true;
        onWarnRef.current();
      }
      if (idle < warnMs) warnedRef.current = false;
    }, 10000);

    return () => {
      events.forEach(evt => document.removeEventListener(evt, resetActivity));
      clearInterval(checker);
    };
  }, [active, warnMs, submitMs]);
}
