// Store the APNs device token the iOS shell just received.
//
// Called by registerPush() in src/lib/native/bridge.ts, once per app launch. Idempotent by design:
// the same device sends the same token every time, and the unique index turns the repeat into a
// last_seen_at touch rather than a duplicate row.
//
// Storing is deliberately decoupled from sending. Sending needs an APNs key from the Apple developer
// account, which does not exist yet. Collecting tokens now means that on the day it does, everyone
// who has already opened the app is reachable, instead of every member needing to be re-prompted.
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { requireAuth } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

const Input = z.object({
  // APNs tokens are 64 hex characters today, but Apple has changed the length before and the value
  // is opaque to us. Bound it and check it is plausible rather than pinning an exact format.
  token: z.string().trim().min(32).max(400),
  platform: z.literal('ios'),
});

async function POST_h(req: NextRequest): Promise<NextResponse> {
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  // A push token is a way to reach a specific person's phone, so it is bound to the session that
  // sent it. It must never be possible to register a token against someone else's profile.
  const ctx = await requireAuth();
  if (!ctx.companyId) return NextResponse.json({ error: 'no_company' }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc.from('push_subscriptions').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      platform: 'ios',
      device_token: parsed.data.token,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,device_token' },
  );
  if (error) {
    console.error('push-token upsert:', error.message);
    // The member cannot do anything about this and is not waiting on it. Do not surface a failure
    // into an app that is otherwise working.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withApiLog(POST_h);
