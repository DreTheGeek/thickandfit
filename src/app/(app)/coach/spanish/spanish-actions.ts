'use server';

// Draft and approve Spanish for her movements.
//
// The translator itself (src/lib/content/es-fill.ts) has existed and been correct for months, with
// ZERO callers. Nothing in the app could reach it, so 360 of her 367 movements still show an English
// name to a member reading the app in Spanish, which is half of who this product is for.
//
// It is wired as DRAFT then APPROVE, never as a one-click bulk write, and that is her own stated
// reason rather than caution for its own sake: gym names are idiom, not prose. "Hip thrust" has a
// standard Spanish name and a literal translation, and they are different words. She speaks Spanish;
// the model gets her to a first draft in seconds and she is the one who decides.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { fillExerciseSpanish, type EsFillDraft } from '@/lib/content/es-fill';

export type DraftRow = EsFillDraft & { nameEn: string; cuesEn: string | null };

export type DraftActionResult =
  | { ok: true; rows: DraftRow[]; remaining: number }
  | { ok: false; error: 'notConfigured' | 'failed' | 'none' };

const DraftInput = z.object({ limit: z.number().int().min(1).max(40) });

export async function draftSpanishAction(input: unknown): Promise<DraftActionResult> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'failed' };
  await requireCoach();

  const res = await fillExerciseSpanish({ limit: parsed.data.limit, dryRun: true });
  if (res.status === 'notConfigured') return { ok: false, error: 'notConfigured' };
  if (res.status === 'error') return { ok: false, error: 'failed' };
  const drafts = res.drafts ?? [];
  if (drafts.length === 0) return { ok: false, error: 'none' };

  // Re-read the English beside each draft. Reviewing a Spanish name with the English out of sight is
  // not reviewing, it is proofreading Spanish, and the whole question is whether it means the same
  // movement she filmed.
  const svc = createServiceClient();
  const { data } = await svc
    .from('exercises')
    .select('id, name_en, cues_en')
    .in('id', drafts.map((d) => d.id));

  const english = new Map(
    ((data ?? []) as { id: string; name_en: string; cues_en: string | null }[]).map((r) => [r.id, r]),
  );
  const rows = drafts
    .map((d): DraftRow | null => {
      const en = english.get(d.id);
      return en ? { ...d, nameEn: en.name_en, cuesEn: en.cues_en } : null;
    })
    .filter((r): r is DraftRow => r !== null);

  return { ok: true, rows, remaining: res.remaining };
}

const ApproveInput = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().uuid(),
        name_es: z.string().trim().min(1).max(200),
        cues_es: z.string().trim().max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export type ApproveActionResult = { ok: true; written: number; remaining: number } | { ok: false };

export async function approveSpanishAction(input: unknown): Promise<ApproveActionResult> {
  const parsed = ApproveInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  await requireCoach();

  const svc = createServiceClient();
  let written = 0;
  for (const row of parsed.data.rows) {
    // The `is('name_es', null)` guard is the same one the batch writer uses: approving a second time,
    // or two people reviewing at once, must never overwrite Spanish a human already settled on.
    const { error } = await svc
      .from('exercises')
      .update({ name_es: row.name_es, cues_es: row.cues_es || null })
      .eq('id', row.id)
      .is('name_es', null);
    if (!error) written += 1;
  }

  const { count } = await svc
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .is('name_es', null);

  revalidatePath('/coach/spanish');
  revalidatePath('/coach/exercises');
  return { ok: true, written, remaining: count ?? 0 };
}
