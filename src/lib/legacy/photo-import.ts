// Legacy progress-photo import (WP13). Copies a claimed legacy client's Lenus progress photos
// (sitting at PUBLIC pub-*.r2.dev URLs in lenus.media) into the PRIVATE progress-photos bucket and
// writes the progress_photos rows the subscriber gallery reads.
//
// Reality check (from research): lenus.media has NO date column, so taken_on is left NULL-default
// (current_date) and the photos are flagged as legacy via the pose label. We do NOT fabricate a
// timeline. This is the ONLY granular per-client history that exists; weight / workout history did
// not come across in the Lenus export (only the aggregate legacy_client_snapshot).
//
// Idempotent: progress_photos has a UNIQUE index on storage_path (0032), and the storage upload uses
// a deterministic key per source photo (profileId/legacy/<r2-key-hash>.jpg), so re-running skips
// already-imported photos via upsert + on-conflict-do-nothing semantics.
import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'progress-photos';
const LEGACY_POSE = 'legacy'; // labels the photo as imported, not part of a real dated timeline
const MAX_PER_RUN = 500; // safety cap so a single client's import can never run unbounded

export type LegacyMediaRow = { r2_url: string; r2_key: string };
export type PhotoImportResult = {
  status: 'ok' | 'no_lenus_id' | 'error';
  found: number;
  imported: number;
  skipped: number;
};

// Deterministic object key for a source photo. Hashing the r2_key keeps the path stable across runs
// (idempotency) and avoids leaking the original Lenus filename.
function objectKeyFor(profileId: string, r2Key: string): string {
  const hash = createHash('sha256').update(r2Key).digest('hex').slice(0, 24);
  return `${profileId}/legacy/${hash}.jpg`;
}

// Import every Lenus progress photo for the given claimed profile. lenusId is the client's
// lenus.clients.id (== contacts.lenus_id == profiles.lenus_profile_id). limit caps a single run.
export async function importLegacyPhotos(
  profileId: string,
  companyId: string,
  lenusId: string | null,
  opts: { limit?: number } = {},
): Promise<PhotoImportResult> {
  if (!lenusId) return { status: 'no_lenus_id', found: 0, imported: 0, skipped: 0 };
  const limit = Math.min(Math.max(opts.limit ?? MAX_PER_RUN, 1), MAX_PER_RUN);
  const svc = createServiceClient();

  // Read this client's progress photos from the lenus schema (service client bypasses RLS; the lenus
  // schema is admin-only). PostgREST can reach non-public schemas via the schema() switch.
  const { data: media, error: mediaErr } = await svc
    .schema('lenus')
    .from('media')
    .select('r2_url, r2_key')
    .eq('client_id', lenusId)
    .eq('category', 'progress_photos')
    .limit(limit);

  if (mediaErr) {
    console.error('importLegacyPhotos read:', mediaErr.message);
    return { status: 'error', found: 0, imported: 0, skipped: 0 };
  }
  const rows = (media ?? []) as LegacyMediaRow[];
  if (rows.length === 0) return { status: 'ok', found: 0, imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.r2_url || !row.r2_key) {
      skipped += 1;
      continue;
    }
    const path = objectKeyFor(profileId, row.r2_key);

    // Skip if this exact object key is already recorded (fast idempotency path).
    const { data: existing } = await svc
      .from('progress_photos')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }

    // Download the public R2 bytes and upload into the private bucket under the owner's folder.
    let bytes: ArrayBuffer;
    try {
      const res = await fetch(row.r2_url);
      if (!res.ok) {
        skipped += 1;
        continue;
      }
      bytes = await res.arrayBuffer();
    } catch (e) {
      console.error('importLegacyPhotos fetch:', e instanceof Error ? e.message : 'unknown');
      skipped += 1;
      continue;
    }

    const { error: upErr } = await svc.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(bytes), { contentType: 'image/jpeg', upsert: true });
    if (upErr) {
      console.error('importLegacyPhotos upload:', upErr.message);
      skipped += 1;
      continue;
    }

    // Insert the row. taken_on defaults to current_date (no source date); pose marks it legacy.
    const { error: insErr } = await svc
      .from('progress_photos')
      .insert({ company_id: companyId, profile_id: profileId, storage_path: path, pose: LEGACY_POSE });
    if (insErr) {
      // Unique-violation = already imported in a concurrent run; treat as skip, not failure.
      if (insErr.code === '23505') {
        skipped += 1;
        continue;
      }
      console.error('importLegacyPhotos insert:', insErr.message);
      skipped += 1;
      continue;
    }
    imported += 1;
  }

  // Stamp the migration_log so the import is auditable (mirrors the import-lenus.sql convention).
  await svc.from('migration_log').insert({
    company_id: companyId,
    lenus_id: lenusId,
    dataset: 'progress_photos_subscriber',
    records_imported: imported,
    status: 'imported',
  });

  return { status: 'ok', found: rows.length, imported, skipped };
}
