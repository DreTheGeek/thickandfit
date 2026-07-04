// Request telemetry: wrap an API route handler to log method/path/status/latency/user to
// api_request_log. Fire-and-forget via after() so it never adds latency and survives the frozen
// serverless lambda. Powers the admin command-center dashboards (usage, errors, latency, consumers).
import 'server-only';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveAuth } from '@/lib/auth/session';

// Collapse ids so paths group (e.g. /forms/<uuid>/submit -> /forms/:id/submit).
function normalizePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{20,}/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:n');
}

function ipOf(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

async function writeLog(req: Request, status: number, durationMs: number, error: string | null): Promise<void> {
  try {
    const url = new URL(req.url);
    // Resolve the caller AFTER the response is sent, so auth lookup never adds latency.
    let userId: string | null = null;
    let companyId: string | null = null;
    try { const auth = await resolveAuth(); userId = auth?.userId ?? null; companyId = auth?.companyId ?? null; } catch { /* anon */ }
    let email: string | null = null;
    const svc = createServiceClient();
    if (userId) {
      const { data } = await svc.from('profiles').select('email').eq('id', userId).maybeSingle();
      email = (data as { email: string | null } | null)?.email ?? null;
    }
    await svc.from('api_request_log').insert({
      company_id: companyId,
      method: req.method,
      path: normalizePath(url.pathname),
      raw_path: url.pathname.slice(0, 300),
      status,
      duration_ms: durationMs,
      user_id: userId,
      user_email: email,
      error: error ? error.slice(0, 400) : null,
      ip: ipOf(req),
    });
  } catch {
    // telemetry must never break a request
  }
}

// Variadic + generic so it preserves ANY Next route-handler signature ((req), (req, {params}), ()).
export function withApiLog<A extends unknown[]>(
  handler: (...args: A) => Promise<Response> | Response,
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const req = args[0] as Request;
    const start = Date.now();
    let res: Response;
    let error: string | null = null;
    try {
      res = await handler(...args);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      res = new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const dur = Date.now() - start;
    const status = res.status;
    try { after(() => writeLog(req, status, dur, error)); } catch { void writeLog(req, status, dur, error); }
    return res;
  };
}
