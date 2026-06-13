import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '墨卷 · 智能组卷系统',
  description: '面向培训机构的一站式教考分离解决方案',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
