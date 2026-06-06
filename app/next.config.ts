import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Point next-intl at our request config (server-side message loader)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ---------------------------------------------------------------------------
//  S4 — Content-Security-Policy
//  Allow-list derived from what the app ACTUALLY loads (verified):
//    - fonts use next/font/google → SELF-HOSTED at build time, so NO external
//      font origin is needed (stronger than a Google-Fonts allow-list).
//    - the only dangerouslySetInnerHTML usages render i18n HTML text, not
//      <script>, so script-src stays strict ('self', no 'unsafe-inline').
//    - 'unsafe-inline' for STYLE only: Next.js injects inline <style>; standard
//      and low-risk (style injection ≠ script execution).
//    - data:/blob: images for inline SVG icons and any client-generated blobs.
//    - report-uri /api/csp-report → collect violations during observation.
//  Shipped as Report-Only first (see headers()) so it blocks nothing in
//  production until we've confirmed zero false positives, then flipped to the
//  enforcing `Content-Security-Policy` key.
// ---------------------------------------------------------------------------
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'report-uri /api/csp-report',
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Allow up to 10 MB so document uploads (10 Mo per spec) succeed.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // --- already present (kept) ---
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // --- S4 Stage 1: HSTS ---
          // Force HTTPS-only for this domain for 1 year, incl. subdomains.
          // Safe: HTTPS fully working (Let's Encrypt, auto-renew). `preload`
          // omitted deliberately — hard to reverse; add later once stable.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // --- S4 Stage 2: CSP in REPORT-ONLY mode ---
          // Blocks nothing yet; the browser only POSTs violations to
          // /api/csp-report so we can confirm the policy fits real traffic
          // before switching to the enforcing `Content-Security-Policy` key.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
