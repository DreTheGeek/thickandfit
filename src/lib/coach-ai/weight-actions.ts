'use server';

// Minimal weight-log server action. Subscribers enter weight in lb (US default) or kg; we store the
// canonical kg in weight_entries. RLS scopes the insert to the caller (profile_id = auth.uid()).
// This feeds buildCoachContext (the AI coach) and the live "current weight" on the You screen.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { emitEvent } from '@/lib/events/emit';

const LB_TO_KG = 0.45359237;

const WeightInput = z.object({
  weight: z.number().positive().max(1500),
  unit: z.enum(['kg', 'lb']),
});

export type WeightLogResult = { ok: boolean; error?: 'invalid' | 'insert_failed' };

export async function logWeightAction(input: unknown): Promise<WeightLogResult> {
  const parsed = WeightInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireAuth();
  // Convert to canonical kg, clamp to a sane human range so a bad unit toggle can't poison the trend.
  const kg = parsed.data.unit === 'lb' ? parsed.data.weight * LB_TO_KG : parsed.data.weight;
  // Three decimals (one gram), not one.
  //
  // Rounding the canonical kg to 0.1 was fine for a member who weighs in kg and wrong for everyone
  // else: 0.05 kg is 0.11 lb, so a US member typing 154.4 got 70.0 kg stored and 154.3 read back.
  // Observed exactly that on a real account. Silently changing the number she just typed is a bad
  // property in any field and a worse one in a weight tracker, where the whole point is that small
  // moves are real. The column is unconstrained numeric, so the extra places cost nothing, and a
  // gram is far below the noise floor of a bathroom scale, so this is not false precision either.
  const weightKg = Math.round(kg * 1000) / 1000;
  if (weightKg < 20 || weightKg > 500) return { ok: false, error: 'invalid' };

  const sb = await createClient();
  const { data: inserted, error } = await sb
    .from('weight_entries')
    .insert({
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      weight_kg: weightKg,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) {
    console.error('logWeightAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  if (ctx.companyId && inserted) {
    emitEvent({
      companyId: ctx.companyId,
      profileId: ctx.userId,
      type: 'weight_logged',
      aggregateType: 'weight_entry',
      aggregateId: (inserted as { id: string }).id,
      payload: { weight_kg: weightKg, source: 'manual' },
    });
  }
  revalidatePath('/you');
  return { ok: true };
}
