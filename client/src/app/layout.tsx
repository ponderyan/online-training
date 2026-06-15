import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FoxLearn · 狐学 — 智能组卷系统',
  description: '跟着小狐狸，高效出卷，精准组卷',
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
      <body>{children}</body>
    </html>
  );
}
