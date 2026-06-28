// Mux demo-video import (WP13). Stephanie's ~369 filmed exercise demos are NOT in the database
// (lenus.media is client chat/progress media); they arrive as an EXTERNAL manifest of {name, url}
// staged at public URLs. This module name-matches each manifest entry to an exercises row by
// name_en, POSTs the source URL to Mux create-asset-from-URL, and stages the asset->exercise mapping.
//
// CRITICAL (research Pitfall 1): a Mux asset is async (status 'preparing' at create time). The player
// at workout-player.tsx consumes video_mux_id as a PLAYBACK id, and a preparing asset 404s. So this
// module NEVER writes exercises.video_mux_id at create time. It stages the mapping in migration_log
// (dataset 'mux_asset_staged', lenus_id = asset id, target_id = exercise id) and the mux-webhook edge
// function writes video_mux_id only on video.asset.ready.
//
// Graceful without MUX_TOKEN_ID / MUX_TOKEN_SECRET: returns a clean notConfigured result, POSTs
// nothing. This module is BUILT but NOT run in WP13 (it needs the real Mux account + the 369 files).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;
const MUX_ASSETS_URL = 'https://api.mux.com/video/v1/assets';

export type DemoManifestEntry = { name: string; url: string };

export type MuxAssetResponse = {
  data?: {
    id?: string;
    status?: string;
    playback_ids?: { id: string; policy: string }[];
  };
};

export type MuxImportOutcome = {
  name: string;
  matchedExerciseId: string | null;
  assetId: string | null;
  staged: boolean;
  skipped: boolean; // already has a video / already staged
  error?: string;
};

export type MuxImportResult = {
  status: 'ok' | 'notConfigured';
  total: number;
  matched: number;
  staged: number;
  unmatched: string[];
  outcomes: MuxImportOutcome[];
};

// Normalize a name for matching (case / punctuation / whitespace insensitive).
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical qualifiers
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Basic Auth header for the Mux API (token id : token secret).
function muxAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
}

// POST one source URL to Mux. Returns the asset response, or null on failure.
async function createAsset(url: string): Promise<MuxAssetResponse | null> {
  if (!tokenId || !tokenSecret) return null;
  try {
    const res = await fetch(MUX_ASSETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: muxAuthHeader() },
      body: JSON.stringify({
        inputs: [{ url }],
        playback_policies: ['public'], // matches the current player; switch to signed if gated later
        video_quality: 'basic',
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as MuxAssetResponse;
  } catch {
    return null;
  }
}

// Import a demo manifest. Name-matches to exercises.name_en, creates Mux assets, stages the mapping.
// Idempotent: an exercise that already has video_mux_id, or already has a staged asset, is skipped.
// dryRun (default true here too) does the matching WITHOUT POSTing to Mux, so the manifest can be
// validated against the catalog before any transcode minutes are spent.
export async function importDemoVideos(
  manifest: DemoManifestEntry[],
  opts: { dryRun?: boolean; companyId?: string | null } = {},
): Promise<MuxImportResult> {
  if (!tokenId || !tokenSecret) {
    return { status: 'notConfigured', total: manifest.length, matched: 0, staged: 0, unmatched: [], outcomes: [] };
  }
  const dryRun = opts.dryRun ?? true;
  const svc = createServiceClient();

  // migration_log.company_id is NOT NULL, but the seed exercises are system rows (company_id NULL).
  // Resolve the Thick & Fit company once to stamp staged rows when the matched exercise is a system row.
  let stampCompany = opts.companyId ?? null;
  if (!stampCompany) {
    const { data: co } = await svc.from('companies').select('id').eq('slug', 'thick-and-fit').maybeSingle();
    stampCompany = (co?.id as string | null) ?? null;
  }

  // Load the catalog once; build a normalized-name -> row index.
  const { data: exercises } = await svc
    .from('exercises')
    .select('id, name_en, video_mux_id, company_id')
    .or('company_id.is.null' + (opts.companyId ? `,company_id.eq.${opts.companyId}` : ''));
  const index = new Map<string, { id: string; hasVideo: boolean; companyId: string | null }>();
  for (const ex of exercises ?? []) {
    index.set(normalize(ex.name_en as string), {
      id: ex.id as string,
      hasVideo: Boolean(ex.video_mux_id),
      companyId: (ex.company_id as string | null) ?? null,
    });
  }

  const outcomes: MuxImportOutcome[] = [];
  const unmatched: string[] = [];

  for (const entry of manifest) {
    const match = index.get(normalize(entry.name));
    if (!match) {
      unmatched.push(entry.name);
      outcomes.push({ name: entry.name, matchedExerciseId: null, assetId: null, staged: false, skipped: false, error: 'unmatched' });
      continue;
    }
    if (match.hasVideo) {
      outcomes.push({ name: entry.name, matchedExerciseId: match.id, assetId: null, staged: false, skipped: true });
      continue;
    }

    // Already staged? (a prior run created the asset but the webhook has not fired yet)
    const { data: staged } = await svc
      .from('migration_log')
      .select('id')
      .eq('dataset', 'mux_asset_staged')
      .eq('target_id', match.id)
      .maybeSingle();
    if (staged) {
      outcomes.push({ name: entry.name, matchedExerciseId: match.id, assetId: null, staged: false, skipped: true });
      continue;
    }

    if (dryRun) {
      outcomes.push({ name: entry.name, matchedExerciseId: match.id, assetId: null, staged: false, skipped: false });
      continue;
    }

    const asset = await createAsset(entry.url);
    const assetId = asset?.data?.id ?? null;
    if (!assetId) {
      outcomes.push({ name: entry.name, matchedExerciseId: match.id, assetId: null, staged: false, skipped: false, error: 'create_failed' });
      continue;
    }

    // Stage the asset -> exercise mapping; the webhook resolves it to a playback id on ready.
    // migration_log.company_id is NOT NULL: use the exercise's company for customs, else the tenant.
    await svc.from('migration_log').insert({
      company_id: match.companyId ?? stampCompany,
      lenus_id: assetId, // reuse lenus_id as the external (Mux asset) id slot
      target_id: match.id,
      dataset: 'mux_asset_staged',
      records_imported: 0,
      status: 'preparing',
    });
    outcomes.push({ name: entry.name, matchedExerciseId: match.id, assetId, staged: true, skipped: false });
  }

  return {
    status: 'ok',
    total: manifest.length,
    matched: outcomes.filter((o) => o.matchedExerciseId).length,
    staged: outcomes.filter((o) => o.staged).length,
    unmatched,
    outcomes,
  };
}
