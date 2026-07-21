// Keyless DB-backed rate limiter (no Upstash/KV needed). Counts recent hits per (identifier, bucket)
// in rate_limit_log within a sliding window; over the limit -> blocked. Best-effort: on any error it
// fails OPEN (never blocks a legitimate user because the limiter itself broke).
import 'server-only';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Prefer the platform-set x-real-ip: on Vercel this is the true client IP and a caller cannot forge
  // it. The FIRST x-forwarded-for token is client-controllable (an attacker prepends a fake IP and the
  // real one is appended last), so trusting [0] let callers rotate the header to land each request in
  // a fresh bucket and dodge every rate limit. Fall back to the LAST XFF hop (the trusted, edge-
  // appended client), never the first.
  const realIp = h.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',').map((p) => p.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return 'unknown';
}

/**
 * Returns true if the action is allowed, false if rate-limited. Records the hit when allowed.
 *
 * failClosed: by default the limiter fails OPEN (a broken limiter never blocks a legitimate user).
 * For credential and payment buckets pass `{ failClosed: true }` so a limiter outage cannot silently
 * remove the only brake on password brute-forcing or card testing: there, being unavailable should
 * deny, not wave everyone through.
 */
export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowSec: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  const onFailure = !opts.failClosed; // fail open (allow) by default; deny for sensitive buckets
  try {
    const sb = createServiceClient();
    // Atomic path: the check_rate_limit RPC (migration 0083) serializes callers per key with an
    // advisory lock, so the count-and-record is race-free.
    const { data, error } = await sb.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_bucket: bucket,
      p_limit: limit,
      p_window_sec: windowSec,
    });
    if (!error) return data === true;

    // Fallback (e.g. the RPC is not yet deployed): best-effort count-then-insert. Non-atomic, but
    // still enforces the cap and honors the fail mode on error.
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count, error: countErr } = await sb
      .from('rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('bucket', bucket)
      .gte('hit_at', since);
    if (countErr) return onFailure;
    if ((count ?? 0) >= limit) return false;
    await sb.from('rate_limit_log').insert({ identifier, bucket });
    return true;
  } catch {
    return onFailure;
  }
}
