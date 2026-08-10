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
  // Present on the token path only; auth is settled before this parses.
  token: z.string().optional(),
  profileId: z.string().min(8),
  fullName: z.string().max(200).nullable().optional(),
  operations: z.record(z.string().max(120), z.unknown()).refine((o) => Object.keys(o).length > 0, {
    message: 'no operations',
  }),
});

/**
 * Accept both shapes the exporter can actually produce.
 *
 * The Lenus tab cannot use fetch: their CSP restricts connect-src to their own origin, and a
 * CORS-open third party is blocked too, so it is CSP and not a missing header. `form-action` is a
 * SEPARATE directive and they do not restrict it, so a form POST into a hidden iframe gets out
 * where fetch cannot. That arrives as `enctype=text/plain`, which encodes as `name=value`, so the
 * JSON is everything after the first `=`.
 */
async function readPayload(req: Request): Promise<{ body: unknown; token: string | null }> {
  const type = req.headers.get('content-type') ?? '';
  const asToken = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  if (type.startsWith('text/plain')) {
    const raw = await req.text();
    const eq = raw.indexOf('=');
    if (eq < 0) return { body: null, token: null };
    try {
      const parsed = JSON.parse(raw.slice(eq + 1).trim()) as Record<string, unknown>;
      return { body: parsed, token: asToken(parsed.token) };
    } catch {
      return { body: null, token: null };
    }
  }
  const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  return { body: json, token: asToken(json?.token) };
}

export async function POST(req: Request): Promise<NextResponse> {
  const { body, token } = await readPayload(req);

  // TWO DOORS. The bridge page is same-origin, so the coach's own session authenticates it. The
  // Lenus tab cannot send cookies cross-site, so it presents a migration token instead.
  //
  // That token is deliberately NOT CRON_SECRET. It is a single-purpose value that exists only while
  // the export runs and is deleted from the environment afterwards, because a token pasted into a
  // third party's page is a token that third party can read. All it grants is writing raw export
  // rows into a hidden schema.
  const expected = process.env.LENUS_INGEST_TOKEN;
  const viaToken = Boolean(expected && token && token === expected);

  if (!viaToken) {
    const ctx = await requireCoach().catch(() => null);
    if (!ctx?.companyId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(body);
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
