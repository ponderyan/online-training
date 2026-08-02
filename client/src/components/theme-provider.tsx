'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export type ThemeId = 'fox-warm' | 'modern-saas' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  desc: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'fox-warm', label: '暖调书卷', desc: '深色侧栏 · 米色纸张 · 书卷气' },
  { id: 'modern-saas', label: '现代简洁', desc: '白净克制 · 冷灰 · 企业级' },
  { id: 'dark', label: '暗色模式', desc: '深色护眼 · 夜间友好' },
];

const STORAGE_KEY = 'foxlearn-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'fox-warm',
  setTheme: () => {},
  themes: THEMES,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  if (theme === 'fox-warm') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('fox-warm');

  // 初始化：先从 localStorage 读取（即时），再从后端同步（跨设备）
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.some(t => t.id === saved)) {
      setThemeState(saved);
      applyTheme(saved);
    }
    // 异步从后端拉取偏好（跨设备同步）
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/preferences', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.theme && THEMES.some(t => t.id === data.theme) && data.theme !== localStorage.getItem(STORAGE_KEY)) {
            setThemeState(data.theme);
            applyTheme(data.theme);
            localStorage.setItem(STORAGE_KEY, data.theme);
          }
        })
        .catch(() => {});
    }
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem(STORAGE_KEY, t);
    // 异步同步到后端
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ theme: t }),
      }).catch(() => {});
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
