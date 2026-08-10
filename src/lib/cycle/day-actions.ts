'use server';
// Day-level cycle writes and the member's cycle settings.
//
// All member-owned and all on the RLS-bound client, matching actions.ts: the policies in 0123 are
// the real authorization, so a mistake here cannot reach another member's data.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SYMPTOMS, MOODS, CYCLE_TYPES, ENERGY_MIN, ENERGY_MAX } from '@/lib/cycle/vocab';

export type CycleDayResult = { ok: boolean; error?: string };

// The member's own local calendar day. A symptom belongs to the day she lived, not to a UTC
// instant, so the client sends the date and the server never re-derives it.
const DayInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DayLog = z.object({
  loggedOn: DayInput,
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length).default([]),
  moods: z.array(z.enum(MOODS)).max(MOODS.length).default([]),
  energy: z.number().int().min(ENERGY_MIN).max(ENERGY_MAX).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Save one day's symptoms, moods and energy.
 *
 * An upsert on (profile_id, logged_on), because logging the same day twice is an EDIT. She adds
 * bloating at lunchtime having logged cramps at breakfast, and that is one day's entry revised, not
 * a second entry.
 *
 * Clearing everything deletes the row rather than storing empty arrays: an empty day and a day she
 * never opened should read the same on the calendar, and keeping a hollow row would make the
 * "logged" count lie.
 */
export async function saveCycleDayAction(input: unknown): Promise<CycleDayResult> {
  const parsed = DayLog.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const { loggedOn, symptoms, moods, energy, notes } = parsed.data;
  const sb = await createClient();

  const empty = symptoms.length === 0 && moods.length === 0 && energy == null && !notes;
  if (empty) {
    const { error } = await sb.from('cycle_day_logs').delete().eq('profile_id', ctx.userId).eq('logged_on', loggedOn);
    if (error) {
      console.error('saveCycleDayAction clear:', error.message);
      return { ok: false, error: 'failed' };
    }
    revalidatePath('/you/cycle');
    return { ok: true };
  }

  const { error } = await sb.from('cycle_day_logs').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      logged_on: loggedOn,
      symptoms,
      moods,
      energy: energy ?? null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,logged_on' },
  );
  if (error) {
    console.error('saveCycleDayAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/you/cycle');
  return { ok: true };
}

const ProfileInput = z.object({
  cycleType: z.enum(CYCLE_TYPES).nullable().optional(),
  typicalCycleLength: z.number().int().min(15).max(90).nullable().optional(),
  typicalPeriodLength: z.number().int().min(1).max(15).nullable().optional(),
  sharesWithCoach: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
});

/**
 * Save her cycle settings, including whether her coach can see any of this.
 *
 * THE CONSENT ROW IS THE POINT of the extra write below. Sharing defaults ON, which is only
 * defensible if she was actually told; recording the capture makes "she was informed" a fact on
 * disk rather than an assumption we would be making about our own UI. It is written on every
 * change, so a later switch back to on is also on the record.
 *
 * Written with the service client because consent_captures is not a member-writable table: a member
 * must not be able to forge or delete her own consent history. Everything else here goes through
 * the RLS-bound client.
 */
export async function saveCycleProfileAction(input: unknown): Promise<CycleDayResult> {
  const parsed = ProfileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const p = parsed.data;
  const patch: Record<string, unknown> = {
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    updated_at: new Date().toISOString(),
    onboarded_at: new Date().toISOString(),
  };
  if (p.cycleType !== undefined) patch.cycle_type = p.cycleType;
  if (p.typicalCycleLength !== undefined) patch.typical_cycle_length = p.typicalCycleLength;
  if (p.typicalPeriodLength !== undefined) patch.typical_period_length = p.typicalPeriodLength;
  if (p.sharesWithCoach !== undefined) patch.shares_with_coach = p.sharesWithCoach;
  if (p.remindersEnabled !== undefined) patch.reminders_enabled = p.remindersEnabled;

  const sb = await createClient();
  const { error } = await sb.from('cycle_profiles').upsert(patch, { onConflict: 'profile_id' });
  if (error) {
    console.error('saveCycleProfileAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  if (p.sharesWithCoach !== undefined) {
    const svc = createServiceClient();
    const { error: cErr } = await svc.from('consent_captures').insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      consent_type: 'cycle_coach_sharing',
      consent_version: '2026-08',
      accepted: p.sharesWithCoach,
    });
    // A failed consent write must not silently succeed: the toggle is already saved, but the record
    // of it is the compliance artefact, so it is logged loudly rather than swallowed.
    if (cErr) console.error('saveCycleProfileAction consent:', cErr.message);
  }

  revalidatePath('/you/cycle');
  return { ok: true };
}
