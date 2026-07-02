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
  const weightKg = Math.round(kg * 10) / 10;
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
