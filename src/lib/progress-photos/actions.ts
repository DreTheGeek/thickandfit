'use server';

// Progress-photo server actions (PRD-24, subscriber side). The browser uploads the image bytes
// directly to the PRIVATE 'progress-photos' bucket (RLS scopes the write to the caller's
// profile-id folder); the server records the row and mints short-lived signed URLs for reads.
// Nothing here ever returns a public URL: the bucket is private by design.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'progress-photos';
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour: long enough for a session, short enough to expire.
const LB_TO_KG = 0.45359237;

export type ProgressPhoto = {
  id: string;
  storagePath: string;
  takenOn: string; // ISO date (yyyy-mm-dd)
  pose: string | null;
  weightKg: number | null;
  url: string | null; // signed URL, null if signing failed
};

// ---------------------------------------------------------------------------------------------
// recordPhotoAction: called AFTER the browser has uploaded bytes to storagePath. Validates the
// path belongs to the caller, then inserts the metadata row (RLS double-checks ownership).
// ---------------------------------------------------------------------------------------------
const RecordInput = z.object({
  storagePath: z.string().min(1).max(512),
  takenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pose: z.string().trim().max(60).optional(),
  weight: z.number().positive().max(1500).optional(),
  unit: z.enum(['kg', 'lb']).optional(),
});

export type RecordResult = { ok: boolean; error?: 'invalid' | 'forbidden_path' | 'insert_failed' };

export async function recordPhotoAction(input: unknown): Promise<RecordResult> {
  const parsed = RecordInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { storagePath, takenOn, pose, weight, unit } = parsed.data;

  const ctx = await requireAuth();

  // The first path segment MUST be the caller's profile id (matches storage RLS).
  const firstSegment = storagePath.split('/')[0];
  if (firstSegment !== ctx.userId) return { ok: false, error: 'forbidden_path' };

  let weightKg: number | null = null;
  if (typeof weight === 'number') {
    const kg = (unit ?? 'lb') === 'lb' ? weight * LB_TO_KG : weight;
    const rounded = Math.round(kg * 10) / 10;
    weightKg = rounded >= 20 && rounded <= 500 ? rounded : null;
  }

  const sb = await createClient();
  const { error } = await sb.from('progress_photos').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    storage_path: storagePath,
    taken_on: takenOn ?? new Date().toISOString().slice(0, 10),
    pose: pose && pose.length > 0 ? pose : null,
    weight_kg: weightKg,
  });
  if (error) {
    console.error('recordPhotoAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  revalidatePath('/progress');
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// listPhotosAction: the gallery. Owner's rows newest-first, each with a fresh signed URL.
// ---------------------------------------------------------------------------------------------
export async function listPhotosAction(): Promise<ProgressPhoto[]> {
  const ctx = await requireAuth();
  const sb = await createClient();

  const { data, error } = await sb
    .from('progress_photos')
    .select('id, storage_path, taken_on, pose, weight_kg')
    .eq('profile_id', ctx.userId)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (error) console.error('listPhotosAction:', error.message);
    return [];
  }

  const paths = data.map((r) => r.storage_path);
  const signed = await signPaths(paths);

  return data.map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    takenOn: r.taken_on,
    pose: r.pose,
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
    url: signed.get(r.storage_path) ?? null,
  }));
}

// ---------------------------------------------------------------------------------------------
// deletePhotoAction: remove the row AND the storage object (best-effort on the object).
// ---------------------------------------------------------------------------------------------
const DeleteInput = z.object({ id: z.string().uuid() });
export type DeleteResult = { ok: boolean; error?: 'invalid' | 'not_found' | 'delete_failed' };

export async function deletePhotoAction(input: unknown): Promise<DeleteResult> {
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireAuth();
  const sb = await createClient();

  // RLS ensures only the owner's row is selectable/deletable.
  const { data: row } = await sb
    .from('progress_photos')
    .select('storage_path')
    .eq('id', parsed.data.id)
    .eq('profile_id', ctx.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };

  const { error: delErr } = await sb
    .from('progress_photos')
    .delete()
    .eq('id', parsed.data.id)
    .eq('profile_id', ctx.userId);
  if (delErr) {
    console.error('deletePhotoAction row:', delErr.message);
    return { ok: false, error: 'delete_failed' };
  }

  // Best-effort object removal; the row is already gone so a leftover object is harmless.
  const { error: objErr } = await sb.storage.from(BUCKET).remove([row.storage_path]);
  if (objErr) console.error('deletePhotoAction object:', objErr.message);

  revalidatePath('/progress');
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// signPaths: batch-mint signed URLs for a set of object keys. Used by the gallery + comparison.
// ---------------------------------------------------------------------------------------------
async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;

  const sb = await createClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL_SECONDS);
  if (error || !data) {
    if (error) console.error('signPaths:', error.message);
    return out;
  }
  for (const entry of data) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}
