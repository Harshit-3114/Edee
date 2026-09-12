import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output keeps the production Docker image small.
  output: 'standalone',

  // A stray lockfile above this directory confuses workspace-root inference;
  // pin tracing to the frontend directory as the warning itself suggests.
  outputFileTracingRoot: path.join(__dirname),

  // No remote images: college artwork arrives as college-supplied URLs and
  // renders on plain <img>, never through the optimizer.

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
