import type { Metadata } from 'next';
import './globals.css';
import { SiteSettingsProvider } from '@/hooks/use-site-settings';
import DynamicBrand from '@/components/dynamic-brand';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: '狐学 · 智能在线培训考试平台',
  description: '跟着小狐狸，高效培训，精准考试',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><SiteSettingsProvider><ToastProvider><DynamicBrand />{children}</ToastProvider></SiteSettingsProvider></body>
    </html>
  );
}
