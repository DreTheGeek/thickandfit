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

/** Returns true if the action is allowed, false if rate-limited. Records the hit when allowed. */
export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count, error } = await sb
      .from('rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('bucket', bucket)
      .gte('hit_at', since);
    if (error) return true; // fail open
    if ((count ?? 0) >= limit) return false;
    await sb.from('rate_limit_log').insert({ identifier, bucket });
    return true;
  } catch {
    return true; // fail open
  }
}
