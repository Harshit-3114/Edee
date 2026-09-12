import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output keeps the production Docker image small.
  output: 'standalone',

  // A stray lockfile above this directory confuses workspace-root inference;
  // pin tracing to the frontend directory as the warning itself suggests.
  outputFileTracingRoot: path.join(__dirname),

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'cdn.simpleicons.org' },
    ],
  },

  // All API calls go to FastAPI, never to Next.js route handlers.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
