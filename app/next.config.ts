import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server actions are enabled by default in Next 15.
  experimental: {
    // Allow up to 10 MB so investor PDF uploads (10 Mo per spec) succeed.
    // Default is 1 MB.  Vercel Functions accept ~4.5 MB on Hobby/Pro free
    // tier; for larger PDFs we'll switch to @vercel/blob client-side
    // direct upload in a later activity.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Headers for security baseline
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
