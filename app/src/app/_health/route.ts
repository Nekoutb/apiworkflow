import { NextResponse } from 'next/server';

/**
 * Lightweight health check used by:
 *  - nginx (short-circuits to this endpoint)
 *  - vps-deploy.sh (post-restart probe)
 *  - GitHub Actions smoke test
 *
 * Returns 200 with a small JSON payload. Does NOT touch the database
 * (we don't want a transient DB blip to cause deploy rollbacks).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'cmipaportal',
      ts: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
