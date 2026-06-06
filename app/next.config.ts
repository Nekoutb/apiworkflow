import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Point next-intl at our request config (server-side message loader)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ---------------------------------------------------------------------------
//  S4 — Content-Security-Policy (ENFORCING)
//  Allow-list derived from what the app ACTUALLY loads (verified live against
//  the served HTML on cmipaportal.com):
//    - All assets are self-hosted: scripts/styles/fonts/images come from our
//      origin (/_next/static/...). No external origin appears in the markup.
//      Fonts are self-hosted via next/font/google — no Google-Fonts origin.
//    - script-src 'self' 'unsafe-inline': Next.js App Router emits ~14 INLINE
//      framework scripts per page (the self.__next_f RSC streaming payload +
//      hydration bootstrap) with NO nonce. A strict script-src would block
//      them and break hydration. 'unsafe-inline' is the standard, stable Next
//      App Router posture. (Nonce-based CSP is fragile here — App Router does
//      not reliably nonce the __next_f blocks.) Every OTHER directive stays
//      strict, so the policy still meaningfully constrains: no external script
//      origins, no plugins/objects, no framing, locked base-uri & form-action.
//    - style-src 'unsafe-inline': Next injects inline <style> (low risk —
//      style injection is not script execution).
//    - data:/blob: images for inline SVG icons and client-generated blobs.
//    - report-uri /api/csp-report keeps collecting violations even while
//      enforcing, so any future regression is visible in the logs.
//  Verified in report-only first (commit 8b6e018): the served HTML referenced
//  zero external/blocked assets; the only inline content was Next's own
//  framework scripts (covered by 'unsafe-inline') — hence safe to enforce.
// ---------------------------------------------------------------------------
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
          // --- S4 Stage 2: CSP ENFORCING ---
          // Validated in report-only first (commit 8b6e018): served HTML
          // referenced zero external/blocked assets; only inline content was
          // Next's own framework scripts (covered by script-src 'unsafe-inline').
          // report-uri kept so any future regression still surfaces in logs.
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
