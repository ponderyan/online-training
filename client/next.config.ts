import type { NextConfig } from 'next';

// ★ 2026-08-21：后端内部地址可配（docker 环境传 http://server:3001；生产流量由 nginx 直代，此为 3000 直连兜底）
const apiBase = process.env.API_INTERNAL_BASE || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/ws/:path*', destination: `${apiBase}/ws/:path*` },
    ];
  },
};

export default nextConfig;
