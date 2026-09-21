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

  // Caching is split by audience, never applied globally.
  //
  // Public marketing and catalogue pages are the same for everyone, so a CDN
  // may hold them and a browser may reuse them: s-maxage lets the edge serve a
  // stored copy, stale-while-revalidate refreshes it in the background, and
  // max-age=0 keeps the browser revalidating so an edit is never stuck on
  // someone's machine.
  //
  // Everything behind a portal is one person's data. Those paths get no-store,
  // so nothing personal can be held by a CDN, a proxy, or the back button.
  async headers() {
    const PUBLIC_CACHE =
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
    // College landing pages change when an admin edits the college, so the
    // edge holds them only briefly: at most a minute stale, then revalidated
    // in the background. (The page itself renders per request and the client
    // refreshes on mount, so this is only the CDN layer.)
    const LANDING_CACHE =
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
    const publicPaths = ['/', '/about', '/why-us', '/contact', '/colleges'];

    return [
      ...publicPaths.map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }],
      })),
      {
        source: '/colleges/:slug',
        headers: [{ key: 'Cache-Control', value: LANDING_CACHE }],
      },
      {
        // Portals, plus the screens that carry an account into existence.
        source: '/:path(student|college|coaching|admin|login|signup|auth):rest(/.*)?',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },
    ];
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
