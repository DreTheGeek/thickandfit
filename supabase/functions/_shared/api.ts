// Shared API utilities for Supabase Edge Functions (Deno).
// Build Profile D: internal API. SHA-256 key hashing (never bcrypt), constant-time compare,
// rate limiting, usage logging, and sanitized responses (no stack traces to clients).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export function serviceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --- Hashing -----------------------------------------------------------------
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

const KEY_PREFIX_LEN = 12;

// --- API key validation ------------------------------------------------------
export type ApiKeyContext = { companyId: string; apiKeyId: string };

export async function validateApiKey(rawKey: string | null): Promise<ApiKeyContext | null> {
  if (!rawKey) return null;
  const prefix = rawKey.slice(0, KEY_PREFIX_LEN);
  const incomingHash = await sha256Hex(rawKey);

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, company_id, key_hash')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (!timingSafeEqual(incomingHash, data.key_hash)) return null;

  // fire-and-forget last_used_at touch
  void supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return { companyId: data.company_id, apiKeyId: data.id };
}

// --- Rate limiting (sliding window via rate_limit_log) -----------------------
export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const supabase = serviceClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('bucket', bucket)
    .gte('hit_at', since);

  if ((count ?? 0) >= limit) return false;
  void supabase.from('rate_limit_log').insert({ identifier, bucket });
  return true;
}

// --- Usage logging -----------------------------------------------------------
export function logApiUsage(args: {
  companyId: string | null;
  apiKeyId: string | null;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
}): void {
  const supabase = serviceClient();
  void supabase.from('api_usage_log').insert({
    company_id: args.companyId,
    api_key_id: args.apiKeyId,
    route: args.route,
    method: args.method,
    status_code: args.statusCode,
    latency_ms: args.latencyMs,
  });
}

// --- Sanitized responses (no stack traces ever reach the client) -------------
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function apiSuccess(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status, headers: JSON_HEADERS });
}

export function apiError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: JSON_HEADERS });
}

export function unauthorized(): Response {
  return apiError('Unauthorized', 401);
}
