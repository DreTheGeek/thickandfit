import 'server-only';
// Cloudflare Turnstile server-side verification for public high-abuse endpoints (waitlist signup
// day one, any future public form). Lazy-gated on TURNSTILE_SECRET_KEY so a preview / dev / first-
// day-of-prod deploy without the key set still lets legit signups through instead of 500'ing.
// When the key IS set, a missing or invalid client token blocks the request.
//
// Contract mirrors the project's other lazy-integration wrappers (stripe, ghl, resend): never
// throws, returns a discriminated result the caller reads defensively. Timeout is short (4s)
// because Turnstile itself is expected to answer under 500ms; a slower response is almost always
// their outage, and we'd rather 429/degrade than hang the signup for the user.
//
// Cost side: Cloudflare Turnstile is free at any volume — no rate limit worth defending against
// on our side beyond the existing 5/min IP throttle at src/app/api/funnel/signup/route.ts.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 4000;

/** Present in Vercel prod only if you actually enabled Turnstile. Absence = skip verification. */
function secretKey(): string | null {
  const k = process.env.TURNSTILE_SECRET_KEY;
  return k && k.trim().length > 0 ? k.trim() : null;
}

export type TurnstileResult =
  | { ok: true; skipped: true; reason: 'not_configured' }
  | { ok: true; skipped: false }
  | { ok: false; reason: 'missing_token' | 'invalid_token' | 'network' | 'timeout' };

/**
 * Verify a Turnstile response token against Cloudflare's siteverify endpoint.
 * @param token The `cf-turnstile-response` value the widget produced on the client.
 * @param remoteIp Optional caller IP (Turnstile uses it for their own signal aggregation).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = secretKey();
  if (!secret) return { ok: true, skipped: true, reason: 'not_configured' };
  if (!token || token.trim().length === 0) return { ok: false, reason: 'missing_token' };

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token.trim());
  if (remoteIp) form.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal,
    });
    if (!r.ok) return { ok: false, reason: 'network' };
    const j = (await r.json().catch(() => null)) as { success?: boolean; 'error-codes'?: string[] } | null;
    if (j?.success === true) return { ok: true, skipped: false };
    console.error('turnstile verify failed:', j?.['error-codes']);
    return { ok: false, reason: 'invalid_token' };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Site key for the client widget. Public — safe to expose. Absence = do not render widget. */
export function turnstileSiteKey(): string | null {
  const k = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return k && k.trim().length > 0 ? k.trim() : null;
}
