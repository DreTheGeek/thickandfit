// Manual trigger for the legacy (Lenus) client invite batch. The invite lib existed with NO
// trigger; this internal route is the wire. Deliberately NOT in any cron: inviting 256 real client
// inboxes is a human-initiated launch action.
//
// POST { dryRun?: boolean, limit?: number }  (dryRun defaults TRUE at every layer - a real send
// requires an explicit dryRun:false AND a verified Resend domain AND RESEND_API_KEY.)
// Auth: CRON_SECRET bearer (operator-run via curl/console, same trust as the other internal jobs).
import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { inviteLegacyClients } from '@/lib/legacy/invite';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z
  .object({
    dryRun: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    /** Invite ONE named legacy client instead of the batch. */
    email: z.string().email().optional(),
  })
  .strict();

async function POST_h(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // empty body -> defaults (dryRun true)
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 422 });

  const svc = createServiceClient();
  const { data: company } = await svc
    .from('companies')
    .select('id')
    .eq('slug', 'thick-and-fit')
    .maybeSingle();
  if (!company) return NextResponse.json({ error: 'no company' }, { status: 500 });

  const origin = req.nextUrl.origin;
  const result = await inviteLegacyClients((company as { id: string }).id, origin, {
    dryRun: parsed.data.dryRun ?? true,
    // A single-email invite must not also be capped by a batch limit meant for the sweep.
    limit: parsed.data.email ? 1000 : (parsed.data.limit ?? 50),
    email: parsed.data.email,
  });

  void logCronRun('invite-legacy-manual', 'success', {
    dryRun: result.dryRun,
    total: result.total,
    linked: result.linked,
    sent: result.sent,
  });

  // Return the summary + outcomes (operator reads this from the curl response).
  return NextResponse.json({ ok: true, ...result });
}

export const POST = withApiLog(POST_h);
