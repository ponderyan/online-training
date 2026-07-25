import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: '/Users/ponder/projects/online-training/client',
  },
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
      { source: '/api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' },
    ];
  },
};

export default nextConfig;
