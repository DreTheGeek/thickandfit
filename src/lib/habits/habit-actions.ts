'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { localToday } from '@/lib/habits/habits';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';

export type HabitResult = { ok: boolean; error?: string };

const Id = z.string().uuid();

// Subscriber checks/unchecks today's completion for one of their own habits.
export async function toggleHabitAction(habitId: unknown, done: boolean): Promise<HabitResult> {
  const parsed = Id.safeParse(habitId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();
  // Ownership check (RLS also enforces it).
  const { data: habit } = await sb
    .from('habits')
    .select('id')
    .eq('id', parsed.data)
    .eq('profile_id', ctx.userId)
    .maybeSingle();
  if (!habit) return { ok: false, error: 'not_found' };

  // Toggle TODAY in the user's local timezone (not UTC), matching how the dashboard reads the day.
  const tz = await getProfileTimezone(ctx.userId);
  const { error } = await sb.from('habit_logs').upsert(
    {
      company_id: ctx.companyId,
      habit_id: parsed.data,
      profile_id: ctx.userId,
      logged_date: localToday(tz),
      done,
    },
    { onConflict: 'habit_id,logged_date' },
  );
  if (error) {
    console.error('toggleHabitAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/dashboard');
  return { ok: true };
}

const AssignInput = z.object({
  profileId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(40).optional(),
});

// Coach assigns a habit to a client.
export async function assignHabitAction(input: unknown): Promise<HabitResult> {
  const parsed = AssignInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();
  const { error } = await sb.from('habits').insert({
    company_id: ctx.companyId,
    profile_id: parsed.data.profileId,
    title: parsed.data.title,
    icon: parsed.data.icon ?? 'check',
  });
  if (error) {
    console.error('assignHabitAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach');
  return { ok: true };
}
