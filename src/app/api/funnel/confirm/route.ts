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

  const { ok, leadId } = await confirmLeadByToken(token.trim().toLowerCase());
  const res = NextResponse.redirect(`${origin}/join/thanks?confirmed=${ok ? '1' : '0'}`);

  // Restore the lead identity in THIS browser before handing off to the thank-you page.
  //
  // The cookie is written by the signup form's client JS, so it only ever existed in the browser
  // that submitted the form. Almost nobody confirms there: the link is opened from a mail app, and
  // Gmail/Outlook on iOS use their own in-app webview with a separate cookie jar. The page then
  // found no lead and rendered "We couldn't find your waitlist entry" directly under "YOU'RE IN.",
  // which is the exact moment the member is most engaged and the only place her share link lives.
  //
  // We just proved ownership of this lead via a token mailed to that address, so setting the cookie
  // here is no weaker than the signup path that set it. httpOnly because only the server reads it
  // (the thanks and quiz pages), unlike the client-set original.
  if (leadId) {
    res.cookies.set('funnel_lead', leadId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60, // 60d, matching the signup form
    });
  }
  return res;
}

export const GET = withApiLog(GET_h);
