import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `/about` is gone: this release points people at the AI Hub website for
   * anything broader than the directory. A permanent redirect rather than a
   * 404 because the route was live and linked from the header and footer, so
   * shared links and any search index still land somewhere useful instead of
   * dead-ending.
   */
  async redirects() {
    return [
      {
        source: '/about',
        destination: 'https://aihubfordevelopment.org',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Design doc 5.7. The full header set — CSP, HSTS with
          // includeSubDomains, frame-ancestors, Permissions-Policy — is SP4.
          // These three cost nothing and need no GA4 compatibility work.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
