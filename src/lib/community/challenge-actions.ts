'use server';

// Coach create-challenge: authors a community challenge. A challenge whose date window includes today
// is "active" and renders on the subscriber /community leaderboard (getActiveChallenge in feed.ts).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type ChallengeResult = { ok: boolean; error?: string };

export type CoachChallenge = {
  id: string;
  title: string;
  metric: string;
  goal: number | null;
  startsOn: string;
  endsOn: string;
  active: boolean;
};

const CreateInput = z.object({
  title: z.string().trim().min(2).max(120),
  metric: z.enum(['workouts', 'steps', 'water', 'points']).default('workouts'),
  goal: z.number().int().positive().max(1_000_000).nullable().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createChallengeAction(input: unknown): Promise<ChallengeResult> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  if (parsed.data.endsOn < parsed.data.startsOn) return { ok: false, error: 'bad_dates' };

  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();
  const { error } = await sb.from('challenges').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    title: parsed.data.title,
    metric: parsed.data.metric,
    goal: parsed.data.goal ?? null,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
  });
  if (error) {
    console.error('createChallengeAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach/challenges');
  revalidatePath('/community');
  return { ok: true };
}

export async function listChallenges(companyId: string): Promise<CoachChallenge[]> {
  const sb = await createClient();
  const { data } = await sb
    .from('challenges')
    .select('id, title, metric, goal, starts_on, ends_on')
    .eq('company_id', companyId)
    .order('starts_on', { ascending: false })
    .limit(50);
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as {
    id: string;
    title: string;
    metric: string;
    goal: number | null;
    starts_on: string;
    ends_on: string;
  }[]).map((c) => ({
    id: c.id,
    title: c.title,
    metric: c.metric,
    goal: c.goal,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    active: c.starts_on <= today && c.ends_on >= today,
  }));
}
