// A real 404 for any /api path that does not exist.
//
// THE BUG THIS CLOSES. Without this, a GET to a missing API path 404s correctly, but a POST (or
// PUT/PATCH/DELETE) returns **200** with the HTML not-found page. Anything that checks `res.ok`, or
// a webhook provider that treats 2xx as delivered, reads that as success.
//
// That is not hypothetical. This was found on 2026-08-03 while confirming three deleted routes were
// really gone: they answered 200 and looked alive. One of them was /api/telegram/webhook. Had the
// Telegram webhook still pointed there after the handler moved to Supabase, Telegram would have
// recorded every delivery as successful, retried nothing, and the bot would have gone quiet with no
// error anywhere. That is the same failure shape as the outage this whole change set exists to fix:
// silence that is indistinguishable from working.
//
// A catch-all is the LAST thing Next matches: static segments beat dynamic, dynamic beats catch-all,
// so every one of the 48 real routes still wins. This only ever sees paths that matched nothing.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Deliberately JSON, not the HTML not-found page. A caller of /api wants a machine-readable body,
// and returning HTML here is how a 404 gets logged as a parse error three layers away instead of as
// a missing endpoint.
function notFound(): NextResponse {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
