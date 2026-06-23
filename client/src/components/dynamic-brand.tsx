'use client';

import { useEffect } from 'react';
import { useSiteSettings } from '@/hooks/use-site-settings';

export default function DynamicBrand() {
  const settings = useSiteSettings();

  useEffect(() => {
    if (settings?.siteTitle) {
      document.title = settings.siteTitle;
    }
    if (settings?.favicon) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = settings.favicon;
    }
  }, [settings]);

  return null;
}
