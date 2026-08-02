'use client';

import { useEffect, useState, useCallback } from 'react';

interface UseFullscreenGuardOptions {
  active: boolean;
  onExit?: () => void;
}

/**
 * 全屏守卫 Hook
 * 负责：监测全屏退出 → 尝试重新进入 → 失败则显示遮罩
 */
export function useFullscreenGuard({ active, onExit }: UseFullscreenGuardOptions) {
  const [fullscreenOverlay, setFullscreenOverlay] = useState(false);

  useEffect(() => {
    if (!active) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          setFullscreenOverlay(true);
          onExit?.();
        });
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [active, onExit]);

  const reenterFullscreen = useCallback(() => {
    return document.documentElement.requestFullscreen()
      .then(() => setFullscreenOverlay(false))
      .catch(() => { throw new Error('全屏被阻止'); });
  }, []);

  return { fullscreenOverlay, setFullscreenOverlay, reenterFullscreen };
}
