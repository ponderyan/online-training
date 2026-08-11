'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * 监考看板数据通道 hook（2026-08-12 抽取，大屏 board 页与监考面板页共用）
 * WebSocket 实时推送（/ws/proctoring）→ 连接失败自动降级轮询 + 指数退避重连
 */
export type WsMode = 'connecting' | 'live' | 'polling';

export function useProctoringBoard(
  examId: number,
  opts?: { pollMs?: number; onFrame?: (data: any) => void },
) {
  const pollMs = opts?.pollMs ?? 10000;
  const onFrameRef = useRef(opts?.onFrame);
  onFrameRef.current = opts?.onFrame;

  const [board, setBoard] = useState<any>(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const [wsMode, setWsMode] = useState<WsMode>('connecting');

  const applyBoard = useCallback((data: any) => {
    setBoard(data);
    setError('');
    setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    onFrameRef.current?.(data);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyBoard(await api.exams.proctoring.board(examId));
    } catch (e: any) {
      setError(e.message || '加载失败');
    }
  }, [examId, applyBoard]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const startPollingFallback = () => {
      setWsMode('polling');
      if (pollTimer) return;
      refresh();
      pollTimer = setInterval(refresh, pollMs);
    };

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/ws/proctoring`;
      try { ws = new WebSocket(url); } catch { startPollingFallback(); return; }
      setWsMode(attempts === 0 ? 'connecting' : 'polling');

      ws.onopen = () => {
        const token = localStorage.getItem('token');
        if (!token) { startPollingFallback(); return; }
        ws?.send(JSON.stringify({ event: 'auth', data: { token } }));
      };
      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.event === 'auth:ok') {
          ws?.send(JSON.stringify({ event: 'subscribe', data: { examId } }));
        } else if (msg.event === 'board:update') {
          attempts = 0;
          setWsMode('live');
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          applyBoard(msg.data);
        } else if (msg.event === 'error') {
          // 鉴权/权限失败 → 退回轮询（REST 有同样的守卫，体验一致）
          startPollingFallback();
        }
      };
      ws.onclose = () => {
        if (closed) return;
        startPollingFallback();
        attempts += 1;
        // 指数退避重连：2s → 4s → … 上限 30s
        retryTimer = setTimeout(connect, Math.min(2000 * Math.pow(2, attempts - 1), 30000));
      };
      ws.onerror = () => { ws?.close(); };
      // 心跳保活（25s < nginx 60s 超时余量充足）
      pingTimer = setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' })); }, 25000);
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (pollTimer) clearInterval(pollTimer);
      ws?.close();
    };
  }, [examId, applyBoard, refresh, pollMs]);

  return { board, error, lastRefresh, wsMode, refresh };
}
