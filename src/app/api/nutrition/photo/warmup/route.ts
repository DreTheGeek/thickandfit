// Prewarm endpoint for the photo-to-macro scan. On Vercel Hobby the vision function scales to zero, so
// a cold start (large Next bundle + Supabase connection setup) added ~15s to the FIRST scan. The client
// fires this the instant the camera modal opens - the user then spends a few seconds framing the shot,
// during which this warms the EXACT Lambda + primes the DB connection, so the real POST lands hot.
// Does zero vision work (no accuracy impact); fire-and-forget from the client.
import { createServiceClient } from '@/lib/supabase/service';
import { withApiLog } from '@/lib/telemetry/request-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GET_h(): Promise<Response> {
  // Eagerly load the hot-path module + prime the Supabase connection this instance will reuse.
  void import('@/lib/nutrition/smart-scan');
  try {
    await createServiceClient().from('foods').select('id', { head: true, count: 'exact' }).limit(1);
  } catch {
    // Warmup is best-effort; never surface an error.
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export const GET = withApiLog(GET_h);
