'use server';

// Log today's Move (steps) or Recover (sleep). One row per member per LOCAL day (member timezone),
// upserted so re-logging replaces the value and leaves the other metric untouched. RLS scopes the
// write to the caller (profile_id = auth.uid()).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localToday } from '@/lib/habits/habits';

const Input = z.object({
  kind: z.enum(['steps', 'sleep']),
  // steps: a count. sleep: total minutes. Clamped to the same sane ranges the DB check enforces.
  value: z.number().int().min(0).max(200000),
});

export type DailyMetricResult = { ok: boolean; error?: 'invalid' | 'save_failed' };

export async function logDailyMetricAction(input: unknown): Promise<DailyMetricResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { kind, value } = parsed.data;
  if (kind === 'sleep' && value > 1440) return { ok: false, error: 'invalid' };

  const ctx = await requireAuth();
  const tz = await getProfileTimezone(ctx.userId);
  const onDate = localToday(tz);

  const sb = await createClient();
  const { error } = await sb.from('daily_metrics').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      on_date: onDate,
      ...(kind === 'steps' ? { steps: value } : { sleep_minutes: value }),
      source: 'manual',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,profile_id,on_date' },
  );
  if (error) {
    console.error('logDailyMetricAction:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  revalidatePath('/dashboard');
  return { ok: true };
}
