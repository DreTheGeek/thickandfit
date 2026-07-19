'use server';

// Food-photo diary server actions (call 2026-07-01). The browser uploads bytes directly to the
// PRIVATE 'food-photos' bucket (RLS scopes writes to the caller's profile-id folder); the server
// records the row and mints short-lived signed URLs for reads. The coach reviews via a separate
// service-client-signed read (lib/food-photos/coach.ts).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'food-photos';
const SIGNED_TTL_SECONDS = 60 * 60;

export type FoodPhoto = {
  id: string;
  storagePath: string;
  takenOn: string;
  caption: string | null;
  mealSlot: string | null;
  url: string | null;
};

const RecordInput = z.object({
  storagePath: z.string().min(1).max(512),
  takenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  caption: z.string().trim().max(200).optional(),
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});

export type RecordResult = { ok: boolean; error?: 'invalid' | 'forbidden_path' | 'insert_failed' };

export async function recordFoodPhotoAction(input: unknown): Promise<RecordResult> {
  const parsed = RecordInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { storagePath, takenOn, caption, mealSlot } = parsed.data;

  const ctx = await requireAuth();
  if (storagePath.split('/')[0] !== ctx.userId) return { ok: false, error: 'forbidden_path' };

  const sb = await createClient();
  const { error } = await sb.from('food_photos').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    storage_path: storagePath,
    taken_on: takenOn ?? new Date().toISOString().slice(0, 10),
    caption: caption && caption.length > 0 ? caption : null,
    meal_slot: mealSlot ?? null,
  });
  if (error) {
    console.error('recordFoodPhotoAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  revalidatePath('/nutrition/photos');
  return { ok: true };
}

export async function listMyFoodPhotos(): Promise<FoodPhoto[]> {
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data, error } = await sb
    .from('food_photos')
    .select('id, storage_path, taken_on, caption, meal_slot')
    .eq('profile_id', ctx.userId)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('listMyFoodPhotos:', error.message);
    return [];
  }
  const { data: signed } = await sb.storage
    .from(BUCKET)
    .createSignedUrls(data.map((r) => r.storage_path), SIGNED_TTL_SECONDS);
  const urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  return data.map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    takenOn: r.taken_on,
    caption: r.caption,
    mealSlot: r.meal_slot,
    url: urls.get(r.storage_path) ?? null,
  }));
}

const DeleteInput = z.object({ id: z.string().uuid() });
export type DeleteResult = { ok: boolean; error?: string };

export async function deleteFoodPhotoAction(input: unknown): Promise<DeleteResult> {
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data: row } = await sb
    .from('food_photos')
    .select('storage_path')
    .eq('id', parsed.data.id)
    .eq('profile_id', ctx.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  await sb.from('food_photos').delete().eq('id', parsed.data.id).eq('profile_id', ctx.userId);
  await sb.storage.from(BUCKET).remove([row.storage_path]).catch((e: unknown) => {
    // The DB row is already gone; a failed object delete just orphans storage. Log it so
    // accumulating orphans are visible instead of silent.
    console.error('food photo storage remove:', e instanceof Error ? e.message : e);
  });
  revalidatePath('/nutrition/photos');
  return { ok: true };
}
