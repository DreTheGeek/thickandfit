// Internal REST API auth + helpers (Node runtime). Build Profile D: internal API only.
// SHA-256 key validation (never bcrypt), consistent response shape, usage logging.
import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

const KEY_PREFIX_LEN = 12;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type ApiKeyContext = { companyId: string; apiKeyId: string };

export function bearerFrom(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
}

/** Constant-time string compare (for shared secrets like CRON_SECRET). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function validateApiKey(rawKey: string | null): Promise<ApiKeyContext | null> {
  if (!rawKey) return null;
  const prefix = rawKey.slice(0, KEY_PREFIX_LEN);
  const incomingHash = sha256Hex(rawKey);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('api_keys')
    .select('id, company_id, key_hash')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const a = Buffer.from(incomingHash);
  const b = Buffer.from(data.key_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  void supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return { companyId: data.company_id, apiKeyId: data.id };
}

// --- Consistent response shape ----------------------------------------------
export function apiSuccess(data: unknown, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function apiError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

// --- Usage logging (real status + latency) ----------------------------------
export function logApiUsage(args: {
  companyId: string | null;
  apiKeyId: string | null;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
}): void {
  const supabase = createServiceClient();
  void supabase.from('api_usage_log').insert({
    company_id: args.companyId,
    api_key_id: args.apiKeyId,
    route: args.route,
    method: args.method,
    status_code: args.statusCode,
    latency_ms: args.latencyMs,
  });
}
