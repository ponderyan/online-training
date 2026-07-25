import type { Metadata } from 'next';
import { Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { SiteSettingsProvider } from '@/hooks/use-site-settings';
import DynamicBrand from '@/components/dynamic-brand';
import { ToastProvider } from '@/components/Toast';

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif-sc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '狐学 · 智能在线培训考试平台',
  description: '跟着小狐狸，高效培训，精准考试',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={notoSerifSC.variable}>
      <body><SiteSettingsProvider><ToastProvider><DynamicBrand />{children}</ToastProvider></SiteSettingsProvider></body>
    </html>
  );
}
