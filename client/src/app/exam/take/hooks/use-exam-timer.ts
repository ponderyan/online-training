'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseExamTimerOptions {
  /** 初始剩余秒数 */
  initialSeconds: number;
  /** 是否激活（loading 完成、未交卷、考前须知已确认） */
  active: boolean;
  /** 时间到时的回调（自动交卷） */
  onTimeUp: () => void;
  /** 时间提醒回调 */
  onReminder?: (secondsLeft: number) => void;
}

/**
 * P3c: 考试倒计时 Hook
 * 从 page.tsx 抽取，负责：倒计时、5min/1min 提醒、时间到自动交卷
 */
export function useExamTimer({ initialSeconds, active, onTimeUp, onReminder }: UseExamTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remindedRef = useRef<Set<number>>(new Set());
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const onReminderRef = useRef(onReminder);
  onReminderRef.current = onReminder;

  // 同步服务端时间（监考延长）
  const syncTime = useCallback((serverSeconds: number) => {
    setTimeLeft(serverSeconds);
  }, []);

  useEffect(() => {
    if (!active) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onTimeUpRef.current();
          return 0;
        }
        const next = t - 1;
        if ((next === 300 || next === 60) && !remindedRef.current.has(next)) {
          remindedRef.current.add(next);
          onReminderRef.current?.(next);
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { timeLeft, setTimeLeft: syncTime, stop };
}
