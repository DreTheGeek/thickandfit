'use server';

// Log a body-measurement entry. Subscribers enter circumferences in cm or in (US default); we store
// canonical cm. body_fat is a plain %. At least one field must be present. RLS scopes the insert to
// the caller (profile_id = auth.uid()). Feeds the /progress Body tab (getBodyStats).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const IN_TO_CM = 2.54;

const MeasureInput = z.object({
  unit: z.enum(['cm', 'in']),
  recordedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  waist: z.number().positive().max(400).optional(),
  hips: z.number().positive().max(400).optional(),
  chest: z.number().positive().max(400).optional(),
  arms: z.number().positive().max(200).optional(),
  thighs: z.number().positive().max(300).optional(),
  bodyFat: z.number().positive().max(80).optional(),
});

export type MeasureLogResult = { ok: boolean; error?: 'invalid' | 'empty' | 'insert_failed' };

export async function logMeasurementAction(input: unknown): Promise<MeasureLogResult> {
  const parsed = MeasureInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { unit, recordedOn, waist, hips, chest, arms, thighs, bodyFat } = parsed.data;

  // Circumferences convert to canonical cm; body fat is a raw %.
  const toCm = (v: number | undefined): number | null =>
    v === undefined ? null : Math.round((unit === 'in' ? v * IN_TO_CM : v) * 10) / 10;

  const row = {
    waist_cm: toCm(waist),
    hips_cm: toCm(hips),
    chest_cm: toCm(chest),
    arms_cm: toCm(arms),
    thighs_cm: toCm(thighs),
    body_fat_pct: bodyFat === undefined ? null : Math.round(bodyFat * 10) / 10,
  };
  if (Object.values(row).every((v) => v === null)) return { ok: false, error: 'empty' };

  const ctx = await requireAuth();
  const sb = await createClient();
  const { error } = await sb.from('body_measurements').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    source: 'manual',
    ...(recordedOn ? { recorded_on: recordedOn } : {}),
    ...row,
  });
  if (error) {
    console.error('logMeasurementAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  revalidatePath('/progress');
  return { ok: true };
}
