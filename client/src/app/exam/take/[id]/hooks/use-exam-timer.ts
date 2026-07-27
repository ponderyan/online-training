import { useEffect, useRef, useState } from 'react';

/**
 * 考试倒计时 hook
 * @param initialSeconds 初始剩余秒数
 * @param active 是否启动计时
 * @param onTimeout 时间到时的回调
 */
export function useExamTimer(initialSeconds: number, active: boolean, onTimeout: () => void) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  // 初始化/同步时间
  useEffect(() => {
    if (initialSeconds > 0) setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timeoutRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  const stop = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const syncTime = (seconds: number) => setTimeLeft(seconds);

  return { timeLeft, setTimeLeft: syncTime, stop };
}
