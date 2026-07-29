// Live vendor health probes for /admin/vendors. Superset of getConnections() (env-only): we still
// key-gate on env presence, but if the key is present we hit a lightweight endpoint on the vendor
// to prove auth works, with a hard 3s timeout so one slow vendor never blocks the page.
//
// Status tiers per probe:
//   green  = 2xx and fast (<= SLOW_MS)
//   yellow = 2xx but slow (> SLOW_MS)
//   red    = 4xx/5xx, network error, or timeout
//   unset  = env keys missing (nothing to probe)
//
// Secrets NEVER appear in the detail string. Only status/latency/HTTP code.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type VendorStatus = 'green' | 'yellow' | 'red' | 'unset';

export type VendorHealth = {
  name: string;
  status: VendorStatus;
  detail: string;
  lastCheckedIso: string;
};

const TIMEOUT_MS = 3000;
const SLOW_MS = 1500;

function nowIso(): string {
  return new Date().toISOString();
}

function has(v: string | undefined | null): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// Fetch with a hard abort at TIMEOUT_MS. Never throws; returns a shape callers can classify.
async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<{ status: number | null; ms: number; err: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    return { status: res.status, ms: Date.now() - started, err: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    const isAbort = msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('aborted');
    return { status: null, ms: Date.now() - started, err: isAbort ? `timeout ${TIMEOUT_MS}ms` : msg };
  } finally {
    clearTimeout(timer);
  }
}

function classify(
  probe: { status: number | null; ms: number; err: string | null },
): { status: VendorStatus; detail: string } {
  if (probe.err) return { status: 'red', detail: probe.err };
  if (probe.status === null) return { status: 'red', detail: 'no response' };
  if (probe.status >= 400) return { status: 'red', detail: `HTTP ${probe.status} in ${probe.ms}ms` };
  if (probe.ms > SLOW_MS) return { status: 'yellow', detail: `slow (${probe.ms}ms)` };
  return { status: 'green', detail: `HTTP ${probe.status} in ${probe.ms}ms` };
}

// 1. GHL — hit /locations/{id} to prove the token authenticates against that location.
async function probeGhl(): Promise<VendorHealth> {
  const name = 'GoHighLevel';
  const at = nowIso();
  const token = process.env.GHL_API_TOKEN ?? process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const workflowId = process.env.GHL_WAITLIST_WORKFLOW_ID;
  if (!has(token) || !has(locationId)) {
    const missing = [!has(token) ? 'GHL_API_TOKEN/GHL_API_KEY' : null, !has(locationId) ? 'GHL_LOCATION_ID' : null, !has(workflowId) ? 'GHL_WAITLIST_WORKFLOW_ID' : null]
      .filter(Boolean)
      .join(', ');
    return { name, status: 'unset', detail: `missing ${missing || 'keys'}`, lastCheckedIso: at };
  }
  const probe = await timedFetch(`https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', Accept: 'application/json' },
  });
  const c = classify(probe);
  const detail = has(workflowId) ? c.detail : `${c.detail}, workflow id missing`;
  return { name, status: c.status, detail, lastCheckedIso: at };
}

// 2. Resend — GET /domains lists sending domains; 200 means the key works.
async function probeResend(): Promise<VendorHealth> {
  const name = 'Resend';
  const at = nowIso();
  const key = process.env.RESEND_API_KEY;
  if (!has(key)) return { name, status: 'unset', detail: 'missing RESEND_API_KEY', lastCheckedIso: at };
  const probe = await timedFetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const c = classify(probe);
  return { name, status: c.status, detail: c.detail, lastCheckedIso: at };
}

// 3. Stripe — /v1/account is the canonical auth check.
async function probeStripe(): Promise<VendorHealth> {
  const name = 'Stripe';
  const at = nowIso();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!has(key)) return { name, status: 'unset', detail: 'missing STRIPE_SECRET_KEY', lastCheckedIso: at };
  const probe = await timedFetch('https://api.stripe.com/v1/account', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const c = classify(probe);
  return { name, status: c.status, detail: c.detail, lastCheckedIso: at };
}

// 4. Twilio — GET Account resource; basic-auth with SID + token.
async function probeTwilio(): Promise<VendorHealth> {
  const name = 'Twilio';
  const at = nowIso();
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!has(sid) || !has(token)) {
    const missing = [!has(sid) ? 'TWILIO_ACCOUNT_SID' : null, !has(token) ? 'TWILIO_AUTH_TOKEN' : null].filter(Boolean).join(', ');
    return { name, status: 'unset', detail: `missing ${missing}`, lastCheckedIso: at };
  }
  const basic = Buffer.from(`${sid}:${token}`).toString('base64');
  const probe = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
  });
  const c = classify(probe);
  return { name, status: c.status, detail: c.detail, lastCheckedIso: at };
}

// 5. Mux — /video/v1/assets?limit=1 is the cheapest auth-gated list.
async function probeMux(): Promise<VendorHealth> {
  const name = 'Mux';
  const at = nowIso();
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!has(id) || !has(secret)) {
    const missing = [!has(id) ? 'MUX_TOKEN_ID' : null, !has(secret) ? 'MUX_TOKEN_SECRET' : null].filter(Boolean).join(', ');
    return { name, status: 'unset', detail: `missing ${missing}`, lastCheckedIso: at };
  }
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const probe = await timedFetch('https://api.mux.com/video/v1/assets?limit=1', {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
  });
  const c = classify(probe);
  return { name, status: c.status, detail: c.detail, lastCheckedIso: at };
}

// 6. OpenRouter — /api/v1/models?limit=1 is auth-gated with the API key.
async function probeOpenRouter(): Promise<VendorHealth> {
  const name = 'OpenRouter';
  const at = nowIso();
  const key = process.env.OPENROUTER_API_KEY;
  if (!has(key)) return { name, status: 'unset', detail: 'missing OPENROUTER_API_KEY', lastCheckedIso: at };
  const probe = await timedFetch('https://openrouter.ai/api/v1/models?limit=1', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const c = classify(probe);
  return { name, status: c.status, detail: c.detail, lastCheckedIso: at };
}

// 7. Supabase — cheap query against the companies table proves DB + service key.
async function probeSupabase(): Promise<VendorHealth> {
  const name = 'Supabase';
  const at = nowIso();
  if (!has(process.env.NEXT_PUBLIC_SUPABASE_URL) || !has(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return { name, status: 'unset', detail: 'missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', lastCheckedIso: at };
  }
  const started = Date.now();
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('companies').select('id', { count: 'exact', head: true }).limit(1);
    const ms = Date.now() - started;
    if (error) return { name, status: 'red', detail: `query failed: ${error.message}`, lastCheckedIso: at };
    if (ms > SLOW_MS) return { name, status: 'yellow', detail: `slow (${ms}ms)`, lastCheckedIso: at };
    return { name, status: 'green', detail: `OK in ${ms}ms`, lastCheckedIso: at };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'query threw';
    return { name, status: 'red', detail: msg, lastCheckedIso: at };
  }
}

// 8. Vercel — env presence only. VERCEL_ENV is set on the platform (production/preview/development).
function probeVercel(): VendorHealth {
  const at = nowIso();
  const env = process.env.VERCEL_ENV;
  if (has(env)) return { name: 'Vercel', status: 'green', detail: `VERCEL_ENV=${env}`, lastCheckedIso: at };
  return { name: 'Vercel', status: 'unset', detail: 'VERCEL_ENV not set (local run?)', lastCheckedIso: at };
}

// 9. Sentry — env presence only. Server DSN or public DSN counts.
function probeSentry(): VendorHealth {
  const at = nowIso();
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (has(dsn)) return { name: 'Sentry', status: 'green', detail: 'DSN configured', lastCheckedIso: at };
  return { name: 'Sentry', status: 'unset', detail: 'missing SENTRY_DSN', lastCheckedIso: at };
}

// 10. PostHog — env presence only.
function probePostHog(): VendorHealth {
  const at = nowIso();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (has(key)) return { name: 'PostHog', status: 'green', detail: 'key configured', lastCheckedIso: at };
  return { name: 'PostHog', status: 'unset', detail: 'missing NEXT_PUBLIC_POSTHOG_KEY', lastCheckedIso: at };
}

// One vendor throwing must never take out the page. Promise.allSettled fixes shape; each probe is
// already try/catch-hardened, so a rejection here is defensive.
export async function getVendorHealth(): Promise<VendorHealth[]> {
  const at = nowIso();
  const jobs: Promise<VendorHealth>[] = [
    probeGhl(),
    probeResend(),
    probeStripe(),
    probeTwilio(),
    probeMux(),
    probeOpenRouter(),
    probeSupabase(),
    Promise.resolve(probeVercel()),
    Promise.resolve(probeSentry()),
    Promise.resolve(probePostHog()),
  ];
  const settled = await Promise.allSettled(jobs);
  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const fallbackNames = ['GoHighLevel', 'Resend', 'Stripe', 'Twilio', 'Mux', 'OpenRouter', 'Supabase', 'Vercel', 'Sentry', 'PostHog'];
    const msg = r.reason instanceof Error ? r.reason.message : 'probe threw';
    return { name: fallbackNames[i] ?? 'Vendor', status: 'red' as const, detail: msg, lastCheckedIso: at };
  });
}
