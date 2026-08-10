// Landing point for the Lenus export.
//
// WHY A ROUTE AND NOT A SCRIPT. Lenus authenticates with an httpOnly cookie, so nothing outside a
// logged-in browser tab can call their GraphQL API (proved: identical request with
// credentials:'omit' returns 400 "Not allowed to access private schema fields"). And their CSP
// restricts connect-src to their own origin, so that tab cannot POST anywhere either, not even to a
// CORS-enabled endpoint. The only channel left is postMessage to a tab on OUR origin, which is not
// governed by connect-src. That tab is /lenus-bridge; this is what it forwards to.
//
// See .planning/LENUS-EXPORT-PLAYBOOK.md for the measurements behind that.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One client's worth of operations. The bridge posts per client, which keeps a failure to one
// client rather than to the whole sweep.
const Body = z.object({
  profileId: z.string().min(8),
  fullName: z.string().max(200).nullable().optional(),
  operations: z.record(z.string().max(120), z.unknown()).refine((o) => Object.keys(o).length > 0, {
    message: 'no operations',
  }),
});

export async function POST(req: Request): Promise<NextResponse> {
  // The bridge page runs on our origin, so the coach's own session authenticates this. No shared
  // secret to leak into a third-party tab, and an operator cannot ingest into someone else's tenant.
  const ctx = await requireCoach().catch(() => null);
  if (!ctx?.companyId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }, { status: 400 });
  }
  const { profileId, fullName, operations } = parsed.data;

  const rows = Object.entries(operations).map(([operation, data]) => ({
    profile_id: profileId,
    full_name: fullName ?? null,
    operation,
    variables: { profileId },
    data,
    fetched_at: new Date().toISOString(),
  }));

  // raw_client_extract lives in the hidden `lenus` schema and its primary key is already UNIQUE on
  // (profile_id, operation), so re-running the sweep replaces rather than duplicates. That is what
  // makes a final sweep on 30 August safe to run over the top of this one.
  const sb = createServiceClient();
  const { error } = await sb
    .schema('lenus')
    .from('raw_client_extract')
    .upsert(rows, { onConflict: 'profile_id,operation' });

  if (error) {
    console.error('[lenus-ingest]', profileId, error.message);
    return NextResponse.json({ ok: false, error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: rows.length });
}
