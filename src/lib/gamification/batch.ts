// Nightly gamification recompute. SERVER-ONLY.
// Folded into the existing generate-insights cron route (NO new cron job: the Vercel Hobby plan
// caps cron jobs at 2). Reuses listActiveSubscribers from the insight engine so we recompute
// streaks + badges for the same active-subscriber set, once a day. Recompute is idempotent, so
// this nightly pass only ever catches members who did not open the You screen that day (their
// streak would otherwise look stale until their next visit) and awards any threshold crossings.
import 'server-only';
import { listActiveSubscribers } from '@/lib/coach-ai/insights';
import { recomputeGamification } from '@/lib/gamification/engine';

export type GamificationBatchResult = {
  ok: boolean;
  subscribers: number;
  recomputed: number;
  badgesAwarded: number;
  errors: number;
};

export async function recomputeAllGamification(): Promise<GamificationBatchResult> {
  const subs = await listActiveSubscribers();
  let recomputed = 0;
  let badgesAwarded = 0;
  let errors = 0;

  for (const sub of subs) {
    try {
      const { newlyEarnedKeys } = await recomputeGamification(sub.profileId, sub.companyId);
      recomputed += 1;
      badgesAwarded += newlyEarnedKeys.length;
    } catch {
      errors += 1;
    }
  }

  return {
    ok: errors === 0,
    subscribers: subs.length,
    recomputed,
    badgesAwarded,
    errors,
  };
}
