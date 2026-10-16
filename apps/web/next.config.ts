import path from 'node:path';

import type { NextConfig } from 'next';

// Lokal dev: /api/* ni Next o'zi API'ga uzatadi. Prod'da nginx /api ni to'g'ridan-to'g'ri API'ga yuboradi.
const API_URL = process.env.API_URL ?? 'http://localhost:4600';

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // pnpm monorepo: standalone trace repo ildizidan
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      // Admin panel iframe'ga olinmasin. Mini app esa web.telegram.org da iframe ichida ochiladi — unga tegmaymiz.
      { source: '/((?!miniapp).*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ];
  },
};

export default nextConfig;
