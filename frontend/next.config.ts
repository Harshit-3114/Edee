import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // Standalone output keeps the production Docker image small.
  output: 'standalone',

  // A stray lockfile above this directory confuses workspace-root inference;
  // pin tracing to the frontend directory as the warning itself suggests.
  outputFileTracingRoot: path.join(__dirname),

  // Optimize images – allow local images and modern formats.
  images: {
    formats: ['image/avif', 'image/webp'],
    // If you ever need remote college images, add their hostnames here:
    // remotePatterns: [{ protocol: 'https', hostname: 'example.com' }],
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
