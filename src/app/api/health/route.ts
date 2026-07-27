import { NextResponse } from 'next/server';

// Never prerendered: a cached health check reports the build, not the service.
export const dynamic = 'force-dynamic';

/**
 * Deploy liveness only. Deliberately reveals nothing — no version, no commit,
 * no database state, no environment names. PRD 14.8 wants generic responses to
 * clients with detail server-side only, and this endpoint is unauthenticated.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
