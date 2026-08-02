'use client';

import { useEffect } from 'react';

interface UseNavigationGuardOptions {
  active: boolean;
  timeMode?: 'FIXED' | 'FLEXIBLE';
  /** 离开前保存答案 */
  onBeforeUnload?: () => void;
  /** FIXED 模式硬拦截时的提示 */
  onFixedBlock?: () => void;
  /** FLEXIBLE 模式用户确认离开 */
  onManualLeave?: () => void;
}

/**
 * 导航守卫 Hook
 * 负责：beforeunload 兜底保存 + 浏览器后退/前进拦截
 */
export function useNavigationGuard({ active, timeMode, onBeforeUnload, onFixedBlock, onManualLeave }: UseNavigationGuardOptions) {
  // beforeunload: localStorage 兜底
  useEffect(() => {
    if (!active) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      onBeforeUnload?.();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active, onBeforeUnload]);

  // popstate: 拦截后退/前进
  useEffect(() => {
    if (!active) return;
    const isFIXED = timeMode === 'FIXED';
    const currentUrl = window.location.href;
    window.history.pushState({ exam: true }, '', currentUrl);

    const handlePopState = () => {
      if (isFIXED) {
        window.history.pushState({ exam: true }, '', currentUrl);
        onFixedBlock?.();
      } else {
        const confirmLeave = window.confirm('考试正在进行中，确定要离开吗？离开后考试不会自动交卷，回来后可继续作答。');
        if (!confirmLeave) {
          window.history.pushState({ exam: true }, '', currentUrl);
        } else {
          onManualLeave?.();
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [active, timeMode, onFixedBlock, onManualLeave]);
}
