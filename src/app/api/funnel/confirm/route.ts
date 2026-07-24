// Waitlist double-opt-in confirmation. Emailed link lands here; we verify the token, flip
// confirmed_at, tag GHL, and redirect to /join/thanks?confirmed=1 so the member sees a friendly
// "you're confirmed" state on the page they already know. Bad/expired token still lands on
// /join/thanks so the lead never sees a broken page — but with ?confirmed=0 the banner instead
// shows the "we could not confirm, try the link again" copy.
//
// Doctrine 1 unchanged: this route NEVER blocks the thank-you page from loading — a member can
// visit /join/thanks anytime and see position + share link, confirmation is a background enrichment.
import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { confirmLeadByToken } from '@/lib/funnel/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function GET_h(req: NextRequest): Promise<Response> {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get('t') ?? searchParams.get('token');

  // Loose IP throttle to blunt token-scraping while still allowing a legitimate re-click.
  if (!(await checkRateLimit(await clientIp(), 'funnel-confirm', 20, 60))) {
    return NextResponse.redirect(`${origin}/join/thanks?confirmed=0&r=rate`);
  }

  if (!token || token.trim().length < 12) {
    return NextResponse.redirect(`${origin}/join/thanks?confirmed=0&r=invalid`);
  }

  const { ok } = await confirmLeadByToken(token.trim().toLowerCase());
  return NextResponse.redirect(`${origin}/join/thanks?confirmed=${ok ? '1' : '0'}`);
}

export const GET = withApiLog(GET_h);
