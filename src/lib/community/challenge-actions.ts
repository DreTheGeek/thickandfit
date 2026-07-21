'use server';

// Coach create-challenge: authors a community challenge. A challenge whose date window includes today
// is "active" and renders on the subscriber /community leaderboard (getActiveChallenge in feed.ts).
import { z } from 'zod';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { notifyNewChallenge } from '@/lib/notifications/triggers';

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
  // Only metrics challenge-progress.ts can actually compute (workouts = workout_logs count, logs =
  // distinct diary days). steps/water/points return when their data sources exist.
  metric: z.enum(['workouts', 'logs']).default('workouts'),
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
  // "Live today" uses the SAME UTC date the leaderboard visibility uses (feed.ts getActiveChallenge),
  // so a challenge is notified exactly when it becomes visible to members - never before.
  const today = new Date().toISOString().slice(0, 10);
  const startsToday = parsed.data.startsOn <= today;
  const { error } = await sb.from('challenges').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    title: parsed.data.title,
    metric: parsed.data.metric,
    goal: parsed.data.goal ?? null,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
    // Stamp now if we notify now; else leave null so the daily job notifies on the real start day.
    start_notified_at: startsToday ? new Date().toISOString() : null,
  });
  if (error) {
    console.error('createChallengeAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  // Make it "pop up" in the client portal ONLY when it is actually live (starts today). A future-
  // dated challenge is not on the leaderboard yet, so notifying "it started" would dead-end members
  // at /community; those notify on their start day via generateChallengeOpenNotices (daily cron).
  if (startsToday) {
    const companyId = ctx.companyId;
    const userId = ctx.userId;
    const title = parsed.data.title;
    try {
      after(() => notifyNewChallenge({ companyId, createdByProfileId: userId, challengeTitle: title }));
    } catch {
      void notifyNewChallenge({ companyId, createdByProfileId: userId, challengeTitle: title });
    }
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
