import { NextResponse } from 'next/server';

// =============================================================================
//  S4 — CSP violation collector
//
//  The Content-Security-Policy-Report-Only header points `report-uri` here.
//  While CSP runs in report-only mode the browser blocks nothing, but POSTs a
//  JSON report whenever the page loads something the policy WOULD block. We log
//  those server-side so we can confirm the allow-list fits real traffic before
//  switching CSP to enforcing mode.
//
//  Intentionally:
//    - public (no auth): the browser sends these unauthenticated, and they
//      contain no secrets — only "this URI tried to load that URI".
//    - always 204: never let a reporting failure affect the user's page.
//    - size-guarded: ignore absurdly large bodies.
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text && text.length < 8192) {
      // Browsers send either {"csp-report": {...}} (report-uri) or an array of
      // reports (report-to). Log compactly either way.
      let summary = text;
      try {
        const parsed = JSON.parse(text);
        const r = parsed['csp-report'] ?? parsed;
        const blocked = r?.['blocked-uri'] ?? r?.blockedURL ?? '?';
        const directive = r?.['violated-directive'] ?? r?.effectiveDirective ?? '?';
        const doc = r?.['document-uri'] ?? r?.documentURL ?? '?';
        summary = `blocked=${blocked} directive=${directive} doc=${doc}`;
      } catch {
        /* keep raw text if not JSON */
      }
      // Goes to the PM2/stdout log; grep `[CSP-REPORT]` on the VPS during the
      // observation window.
      console.warn('[CSP-REPORT]', summary);
    }
  } catch {
    /* never throw from a reporting endpoint */
  }
  return new NextResponse(null, { status: 204 });
}

// Some browsers preflight; answer OPTIONS cleanly.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
