// Subscriber "You" profile hub. Profile + stats + goal (from onboarding) + menu.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { YouScreen, type GoalSummary } from '@/components/profile/you-screen';

export const dynamic = 'force-dynamic';

const KG_TO_LB = 2.20462;

export default async function YouPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
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
      .select('answers')
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
  } | null;

  // Live weight (weight_entries) overrides the onboarding start as the current point on the goal.
  const lwRow = latestWeight as { weight_kg: number; recorded_on: string } | null;
  const latestLb = lwRow ? Math.round(Number(lwRow.weight_kg) * KG_TO_LB * 10) / 10 : null;

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

  return (
    <YouScreen
      name={name}
      membership={membership}
      memberSince={memberSince}
      workoutCount={count ?? 0}
      streakWeeks={0}
      progressLbs={progressLbs}
      goal={goal}
      latestLb={latestLb}
      latestWeightDate={lwRow?.recorded_on ?? null}
    />
  );
}
