import { useEffect, useRef, useState } from 'react';

interface TabSwitchOptions {
  active: boolean;
  maxSwitches?: number;
  onSwitch?: (count: number) => void;
  onMaxExceeded?: (count: number) => void;
}

/**
 * 切屏检测 hook：监听 visibilitychange，记录切屏次数和日志
 */
export function useTabSwitch({ active, maxSwitches = 5, onSwitch, onMaxExceeded }: TabSwitchOptions) {
  const [switchCount, setSwitchCount] = useState(0);
  const switchStartRef = useRef<number | null>(null);
  const logRef = useRef<{ time: string; duration: number; type?: string }[]>([]);
  const callbacksRef = useRef({ onSwitch, onMaxExceeded });
  callbacksRef.current = { onSwitch, onMaxExceeded };

  useEffect(() => {
    if (!active) return;

    const handleVisibility = () => {
      if (document.hidden) {
        switchStartRef.current = Date.now();
      } else {
        if (switchStartRef.current) {
          const duration = Math.round((Date.now() - switchStartRef.current) / 1000);
          logRef.current.push({
            time: new Date().toISOString(),
            duration,
            type: 'TAB_SWITCH',
          });
          switchStartRef.current = null;
          setSwitchCount(prev => {
            const next = prev + 1;
            callbacksRef.current.onSwitch?.(next);
            if (next >= maxSwitches) {
              callbacksRef.current.onMaxExceeded?.(next);
            }
            return next;
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active, maxSwitches]);

  return { switchCount, log: logRef };
}
