'use server';
// Cycle-log writes. All member-owned: these run on the RLS-bound client, so the policies in 0097 are
// the real authorization and a mistake here cannot reach another member's data.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type CycleResult = { ok: boolean; error?: string };

// YYYY-MM-DD. The client sends the member's own local day; a period start is a calendar day in her
// life, not an instant, so the server must not re-derive it from a UTC timestamp.
const DayInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Log (or re-log) the first day of a period. Idempotent per day via 0097's unique index. */
export async function logPeriodStartAction(input: unknown): Promise<CycleResult> {
  const parsed = z
    .object({
      startedOn: DayInput,
      flow: z.enum(['light', 'medium', 'heavy']).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = await createClient();
  const { error } = await sb.from('cycle_logs').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      started_on: parsed.data.startedOn,
      flow: parsed.data.flow ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,profile_id,started_on' },
  );
  if (error) {
    console.error('logPeriodStartAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/you/cycle');
  return { ok: true };
}

/** Close out the most recent period. Optional by design: plenty of people never come back to do it. */
export async function setPeriodEndAction(input: unknown): Promise<CycleResult> {
  const parsed = z.object({ id: z.string().uuid(), endedOn: DayInput }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();

  const sb = await createClient();
  // RLS scopes the update to her own rows, so no extra ownership check is needed. The CHECK
  // constraint in 0097 rejects an end before the start.
  const { error } = await sb
    .from('cycle_logs')
    .update({ ended_on: parsed.data.endedOn, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('profile_id', ctx.userId);
  if (error) {
    console.error('setPeriodEndAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/you/cycle');
  return { ok: true };
}

/** Remove a mistaken entry. A wrong start date poisons every average, so this has to be easy. */
export async function deleteCycleLogAction(id: unknown): Promise<CycleResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();

  const sb = await createClient();
  const { error } = await sb
    .from('cycle_logs')
    .delete()
    .eq('id', parsed.data)
    .eq('profile_id', ctx.userId);
  if (error) {
    console.error('deleteCycleLogAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/you/cycle');
  return { ok: true };
}
