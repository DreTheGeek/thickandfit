// Subscriber "You" profile hub. Profile + stats + goal (from onboarding) + menu.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getSupportEmail } from '@/lib/admin/settings';
import { YouScreen, type GoalSummary } from '@/components/profile/you-screen';
import { recomputeGamification } from '@/lib/gamification/engine';
import { prefersGentleFraming } from '@/lib/health-profile/screening';
import { deriveGoalType, effectiveGoalType, isGoalType } from '@/lib/goals/goal-type';
import { StreakBadges } from '@/components/gamification/streak-badges';
import type { GamificationSnapshot } from '@/lib/gamification/types';

export const dynamic = 'force-dynamic';

const KG_TO_LB = 2.20462;

export default async function YouPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const locale = await getLocale();
  const t = await getTranslations('app.you');
  const supabase = await createClient();

  const [{ data: profile }, { data: onb }, { count }, { data: latestWeight }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, role, created_at')
      .eq('id', ctx.userId)
      .maybeSingle(),
    supabase
      .from('onboarding_responses')
      .select('answers, goal_type')
      .eq('profile_id', ctx.userId)
      .maybeSingle(),
    supabase
      .from('workout_logs')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', ctx.userId),
    supabase
      .from('weight_entries')
      .select('weight_kg, recorded_on')
      .eq('profile_id', ctx.userId)
      .order('recorded_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const name = (profile?.full_name ?? '').trim() || (locale === 'es' ? 'Miembro' : 'Member');
  const membership = profile?.role === 'free' ? t('freeMember') : t('premiumMember');
  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(profile.created_at))
    : null;

  const answers = (onb?.answers ?? null) as {
    weightKg?: number;
    goalWeightKg?: number;
    goal?: 'lose' | 'maintain' | 'gain';
  } | null;
  const storedGoalType = (onb as { goal_type?: string | null } | null)?.goal_type ?? null;

  // Live weight (weight_entries) overrides the onboarding start as the current point on the goal.
  const lwRow = latestWeight as { weight_kg: number; recorded_on: string } | null;
  const latestLb = lwRow ? Math.round(Number(lwRow.weight_kg) * KG_TO_LB * 10) / 10 : null;

  // Recompute streak + badges on load (idempotent). Returns the snapshot and any keys earned
  // this load so the client can pop confetti exactly once.
  let gamification: GamificationSnapshot | null = null;
  let newlyEarnedKeys: string[] = [];
  if (ctx.companyId) {
    try {
      const result = await recomputeGamification(ctx.userId, ctx.companyId);
      gamification = result.snapshot;
      newlyEarnedKeys = result.newlyEarnedKeys;
    } catch (e) {
      console.error('you: recomputeGamification', e instanceof Error ? e.message : e);
    }
  }

  let goal: GoalSummary | null = null;
  let progressLbs = 0;
  if (answers?.weightKg && answers?.goalWeightKg) {
    const startLbs = Math.round(answers.weightKg * KG_TO_LB);
    const goalLbs = Math.round(answers.goalWeightKg * KG_TO_LB);
    const currentLbs = latestLb != null ? Math.round(latestLb) : startLbs;
    const span = Math.abs(startLbs - goalLbs);
    const pct = span === 0 ? 100 : Math.min(100, Math.round((Math.abs(currentLbs - startLbs) / span) * 100));
    goal = { startLbs, goalLbs, currentLbs, toGo: Math.abs(goalLbs - currentLbs), pct };
    progressLbs = currentLbs - startLbs;
  }

  const supportEmail = await getSupportEmail(ctx.companyId);
  // Members whose screen flags a difficult relationship with food get the same gentle, non-weight
  // forward framing the coach already gives them: no shrinking-number goal hero, no weight loss
  // celebrated in the success colour. One clinical definition, shared with coach-ai/context.ts.
  const gentle = ctx.companyId ? await prefersGentleFraming(ctx.userId, ctx.companyId) : false;

  // What the member is working toward. Their stored choice if set, otherwise a sensible default from
  // the calorie-math goal (never lose_weight for a gentle member). effectiveGoalType then applies the
  // gentle override for rendering, while `chosen` drives which option the selector shows as current.
  const chosenGoalType = isGoalType(storedGoalType)
    ? storedGoalType
    : deriveGoalType({ goal: answers?.goal ?? null, hasGoalWeight: Boolean(goal), gentle });
  const goalType = effectiveGoalType(chosenGoalType, gentle);

  return (
    <YouScreen
      name={name}
      membership={membership}
      memberSince={memberSince}
      supportEmail={supportEmail}
      workoutCount={count ?? 0}
      streakWeeks={gamification?.streak.currentStreak ?? 0}
      progressLbs={progressLbs}
      goal={goal}
      gentle={gentle}
      goalType={goalType}
      chosenGoalType={chosenGoalType}
      latestLb={latestLb}
      latestWeightDate={lwRow?.recorded_on ?? null}
    >
      {gamification != null && (
        <StreakBadges snapshot={gamification} newlyEarnedKeys={newlyEarnedKeys} />
      )}
    </YouScreen>
  );
}
