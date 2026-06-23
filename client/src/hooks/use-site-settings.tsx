'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface SiteSettings {
  siteName: string;
  siteTitle: string;
  siteLogo?: string;
  favicon?: string;
  footerText?: string;
  icpBeian?: string;
  publicRegistration: boolean;
}

const defaultSettings: SiteSettings = {
  siteName: 'FoxLearn',
  siteTitle: 'FoxLearn · 狐学',
  footerText: '跟着小狐狸，知识不迷路 🐾',
  publicRegistration: false,
};

const SiteSettingsContext = createContext<SiteSettings>(defaultSettings);

export function SiteSettingsProvider({ children, initial }: { children: React.ReactNode; initial?: SiteSettings }) {
  const [settings, setSettings] = useState<SiteSettings>(initial || defaultSettings);
  const [loaded, setLoaded] = useState(!!initial);

  useEffect(() => {
    if (initial) return;
    fetch('/api/site-settings')
      .then(r => r.json())
      .then((data: SiteSettings) => {
        setSettings({ ...defaultSettings, ...data });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [initial]);

  if (!loaded) return null;
  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
