// mux-webhook (Deno edge function, WP13). Receives Mux webhooks and, ONLY on video.asset.ready,
// writes the asset's PUBLIC playback id to the matching exercise's video_mux_id. The asset->exercise
// mapping was staged at import time in migration_log (dataset 'mux_asset_staged', lenus_id = asset id,
// target_id = exercise id) by src/lib/content/mux-import.ts.
//
// Why ready-only (research Pitfall 1): a Mux asset is async; at create time it is 'preparing' and a
// playback id, if present, 404s in the player. video_mux_id (a playback id, consumed by
// workout-player.tsx) is therefore written ONLY when the asset is actually playable.
//
// Security: verifies the Mux-Signature header (HMAC-SHA256 of `${t}.${rawBody}` keyed by
// MUX_WEBHOOK_SECRET), with a timestamp freshness window to blunt replay. Sanitized errors; never a
// stack trace to the caller. Graceful 503 if not configured. Copy of the craneop dual-client /
// sanitized-error / idempotent edge shape.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MUX_WEBHOOK_SECRET = Deno.env.get('MUX_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300; // 5 min replay window

type MuxEvent = {
  type?: string;
  data?: {
    id?: string; // asset id
    playback_ids?: { id: string; policy: string }[];
  };
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Constant-time string compare to avoid leaking signature bytes via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify the Mux-Signature header: format "t=<unix>,v1=<hex hmac of `${t}.${body}`>".
async function verifyMuxSignature(header: string | null, rawBody: string): Promise<boolean> {
  if (!header || !MUX_WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k.trim(), (v ?? '').trim()];
    }),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  // Freshness: reject stale timestamps (replay protection).
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MUX_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`));
  return timingSafeEqual(hex(sig), v1);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE || !MUX_WEBHOOK_SECRET) {
    return json(503, { error: 'not_configured' });
  }

  const rawBody = await req.text();
  const ok = await verifyMuxSignature(req.headers.get('Mux-Signature'), rawBody);
  if (!ok) return json(401, { error: 'invalid_signature' });

  let event: MuxEvent;
  try {
    event = JSON.parse(rawBody) as MuxEvent;
  } catch {
    return json(400, { error: 'bad_payload' });
  }

  // Only act on ready. Acknowledge everything else with 200 so Mux stops retrying.
  if (event.type !== 'video.asset.ready') return json(200, { ignored: event.type ?? 'unknown' });

  const assetId = event.data?.id ?? null;
  const playback = (event.data?.playback_ids ?? []).find((p) => p.policy === 'public');
  const playbackId = playback?.id ?? event.data?.playback_ids?.[0]?.id ?? null;
  if (!assetId || !playbackId) return json(200, { ignored: 'no_asset_or_playback' });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the staged asset -> exercise mapping written at import time.
  const { data: staged, error: stagedErr } = await supabase
    .from('migration_log')
    .select('id, target_id')
    .eq('dataset', 'mux_asset_staged')
    .eq('lenus_id', assetId)
    .maybeSingle();

  if (stagedErr) {
    console.error('mux-webhook stage lookup failed', stagedErr.message);
    return json(500, { error: 'internal_error' });
  }
  if (!staged?.target_id) return json(200, { ignored: 'no_staged_mapping' });

  // Write the playback id (idempotent: re-delivery overwrites with the same value).
  const { error: upErr } = await supabase
    // Resolves a COMMITTED exercise by id. NEVER add .is('archived_at', null) here:
    // curation (0105) must not erase history, and filtering this fails SILENTLY as an
    // untitled card with no demo rather than throwing.
    .from('exercises')
    .update({ video_mux_id: playbackId, is_own_demo: true })
    .eq('id', staged.target_id);
  if (upErr) {
    console.error('mux-webhook exercise update failed', upErr.message);
    return json(500, { error: 'internal_error' });
  }

  // Mark the staged row resolved (audit trail).
  await supabase
    .from('migration_log')
    .update({ status: 'ready', records_imported: 1 })
    .eq('id', staged.id);

  return json(200, { ok: true });
});
