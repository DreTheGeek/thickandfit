'use server';
// Filming progress for her own library.
//
// She films with a videographer three times a week and tracks what is done. We gave her a checklist
// as a published document and she reported back: "when I try to input that checklist on Google
// Chrome, it doesn't show me what I've already completed ... it completely put it at 0%. It doesn't
// save what I complete."
//
// The checkbox was the lie. A document has nowhere to write to, so her ticks lived in one browser
// tab. These actions write to exercises.filmed_at (migration 0119) so the answer survives the tab,
// the device and the shoot day.
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { sharedCatalogScope } from '@/lib/tenant/shared-catalog';

export type FilmingResult = { ok: boolean; filmedAt: string | null; error?: string };

/**
 * Mark a movement filmed, or un-mark it.
 *
 * Idempotent by design: tapping "filmed" twice keeps the FIRST timestamp rather than moving it, so
 * re-confirming a row on a later shoot day does not rewrite the day it was actually shot.
 */
export async function setFilmedAction(exerciseId: string, filmed: boolean): Promise<FilmingResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, filmedAt: null, error: 'no_company' };

  const sb = createServiceClient();

  // Her 367 were imported by 0116 as SHARED rows (company_id IS NULL), not tenant-scoped ones, so
  // an `eq(company_id)` here matches nothing and every tick fails silently. But the read policy
  // spelled out verbatim would let ANY tenant flip filmed_at on her catalog, and filmed_at is a
  // single global column on a shared row. sharedCatalogScope is the one place that rule lives.
  const scope = await sharedCatalogScope(sb, ctx.companyId);
  const { data: row } = await sb
    .from('exercises')
    .select('id, filmed_at, is_coach_authored')
    .eq('id', exerciseId)
    .or(scope)
    .maybeSingle<{ id: string; filmed_at: string | null; is_coach_authored: boolean }>();

  if (!row) return { ok: false, filmedAt: null, error: 'not_found' };
  if (!row.is_coach_authored) return { ok: false, filmedAt: null, error: 'not_her_exercise' };

  // Already in the requested state: nothing to write, and do not move the original timestamp.
  if (filmed && row.filmed_at) return { ok: true, filmedAt: row.filmed_at };
  if (!filmed && !row.filmed_at) return { ok: true, filmedAt: null };

  const filmedAt = filmed ? new Date().toISOString() : null;
  const { error } = await sb
    .from('exercises')
    .update({ filmed_at: filmedAt })
    .eq('id', exerciseId)
    .eq('is_coach_authored', true)
    .or(scope);

  // Surface the failure. The whole point of this change is that she stops being told something saved
  // when it did not.
  if (error) return { ok: false, filmedAt: row.filmed_at, error: 'write_failed' };

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'exercise',
    entityId: exerciseId,
    action: filmed ? 'exercise.filmed' : 'exercise.unfilmed',
    previousState: { filmed_at: row.filmed_at },
    newState: { filmed_at: filmedAt },
  });

  revalidatePath('/coach/exercises');
  return { ok: true, filmedAt };
}

/** A note from the shoot: a retake, a cue to overlay, a variation to skip. */
export async function setFilmingNoteAction(exerciseId: string, note: string): Promise<FilmingResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, filmedAt: null, error: 'no_company' };

  const sb = createServiceClient();
  const trimmed = note.trim().slice(0, 500);
  const { error } = await sb
    .from('exercises')
    .update({ filming_note: trimmed || null })
    .eq('id', exerciseId)
    .eq('is_coach_authored', true)
    .or(await sharedCatalogScope(sb, ctx.companyId));

  if (error) return { ok: false, filmedAt: null, error: 'write_failed' };
  revalidatePath('/coach/exercises');
  return { ok: true, filmedAt: null };
}
