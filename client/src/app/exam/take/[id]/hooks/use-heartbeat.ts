import { useEffect, useRef } from 'react';

interface HeartbeatOptions {
  examId: string | number;
  active: boolean;
  interval?: number; // 默认 30 秒
  onSessionEnd?: (message: string) => void;
  onTimeSync?: (remainingSeconds: number) => void;
  onMessages?: (messages: any[]) => void;
}

/**
 * 考试心跳 hook：定时向后端报告在线状态，接收监考指令
 */
export function useHeartbeat({ examId, active, interval = 30000, onSessionEnd, onTimeSync, onMessages }: HeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const failCountRef = useRef(0);
  const callbacksRef = useRef({ onSessionEnd, onTimeSync, onMessages });
  callbacksRef.current = { onSessionEnd, onTimeSync, onMessages };

  useEffect(() => {
    if (!active || !examId) return;
    const token = localStorage.getItem('token');

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/exams/${examId}/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { failCountRef.current++; return; }
        failCountRef.current = 0;
        const data = await res.json();

        // 会话被终止
        if (data.sessionStatus && data.sessionStatus !== 'ACTIVE') {
          callbacksRef.current.onSessionEnd?.('考试已被监考员结束');
          return;
        }
        // 同步剩余时间
        if (typeof data.remainingTime === 'number') {
          callbacksRef.current.onTimeSync?.(data.remainingTime);
        }
        // 监考消息
        if (data.messages?.length > 0) {
          callbacksRef.current.onMessages?.(data.messages);
        }
      } catch {
        failCountRef.current++;
      }
    }, interval);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, examId, interval]);

  const stop = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  return { stop, failCount: failCountRef };
}
