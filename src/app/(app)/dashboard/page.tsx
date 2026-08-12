// Subscriber "Today" home. Requires auth; SSRs the summary + greeting + week strip,
// the Today screen handles the four states client-side.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCompanyCoach } from '@/lib/tenant/owner';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { getTodayHabits, localToday } from '@/lib/habits/habits';
import { getDailyMetrics } from '@/lib/dailymetrics/daily';
import { getDiary } from '@/lib/nutrition/diary';
import { getCommunity } from '@/lib/community/feed';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { getSupportEmail } from '@/lib/admin/settings';
import { getPrediction } from '@/lib/prediction/read';
import { getMealIntelligence } from '@/lib/intelligence/meal-recs';
import { IntelligenceCard } from '@/components/dashboard/intelligence-card';
import { TodayScreen, type WeekDay, type TodayNutrition, type CatchUp } from '@/components/dashboard/today-screen';

export const dynamic = 'force-dynamic';

/** Weeks elapsed since `startedAt`, 1-based. Module scope, NOT the render body: the purity rule bans
 *  clock reads inside a component (same reason launch-runway.ts hoists daysUntil). */
function weeksSince(startedAt: string | null): number | null {
  if (!startedAt) return null;
  return Math.max(1, Math.floor((Date.now() - Date.parse(startedAt)) / (7 * 86_400_000)) + 1);
}

export default async function DashboardPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const locale = await getLocale();

  const supabase = await createClient();

  /**
   * TWO WAVES, not ten round trips.
   *
   * This is the screen she opens every day, it is force-dynamic so every load pays the full cost,
   * and half this audience is on mobile in Latin America. The reads used to run strictly one after
   * another: profile, then timezone, then support email, then summary, then habits, then metrics,
   * then diary, then community, then the goal pair, then the coach, then prediction + meals. Each
   * one waited for the previous to come back, and almost none of them care about each other.
   *
   * There are exactly two real dependencies. `today` is derived from her timezone, and the nutrition
   * and goal reads are meaningless before we know she has onboarded. So everything independent goes
   * in the first wave, and the two things that genuinely had to wait go in the second.
   */
  const [{ data: profile }, tz, supportEmail, summary, coachOwner, catchUp, prediction, meals] =
    await Promise.all([
      supabase.from('profiles').select('full_name, created_at').eq('id', ctx.userId).maybeSingle(),
      getProfileTimezone(ctx.userId),
      getSupportEmail(ctx.companyId),
      ctx.companyId
        ? getDashboardSummary(ctx.companyId, ctx.userId)
        : Promise.resolve<DashboardSummary | null>(null),
      // Coach card: the company's owner. This used to order profiles by created_at across coach AND
      // operator, which resolved to the agency operator account that predates Stephanie's by a
      // month, so a member's home screen read "Your coach: LaSean". getCompanyCoach reads the owner
      // the tenant states (0124) instead of whoever signed up first. A subscriber cannot read other
      // profiles via RLS, so it uses the service client and surfaces only the display name.
      ctx.companyId ? getCompanyCoach(ctx.companyId) : Promise.resolve(null),
      // Catch-up: newest coach broadcast + active challenge progress (best-effort; never blocks home).
      ctx.companyId
        ? getCommunity(ctx.userId)
            .then(
              (community): CatchUp => ({
                broadcast: community.broadcast
                  ? { author: community.broadcast.author.name, body: community.broadcast.body }
                  : null,
                challenge: community.challenge
                  ? {
                      title: community.challenge.title,
                      progress: community.challenge.viewerProgress,
                      goal: community.challenge.goal,
                      daysLeft: community.challenge.daysLeft,
                    }
                  : null,
              }),
            )
            .catch(() => null)
        : Promise.resolve<CatchUp | null>(null),
      // K9: goal projection (K7) + adherence-aware meal rec (K8). Both engines refuse to speak
      // without enough signal, so the card renders nothing rather than padding the screen with
      // generic advice. Neither is allowed to fail the home screen.
      ctx.companyId
        ? getPrediction(ctx.userId, ctx.companyId).catch(() => null)
        : Promise.resolve(null),
      ctx.companyId
        ? getMealIntelligence(ctx.userId, ctx.companyId).catch(() => null)
        : Promise.resolve(null),
    ]);

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] ?? '';
  const today = localToday(tz);
  const coach = coachOwner?.name ? { name: coachOwner.name } : null;
  const onboarded = Boolean(ctx.companyId && summary?.hasOnboarded);

  // Wave two: the reads that genuinely needed `today` or the onboarded flag.
  const [habits, daily, diary, goalRows] = await Promise.all([
    ctx.companyId ? getTodayHabits(ctx.userId, today) : Promise.resolve([]),
    // Move (steps) + Recover (sleep) for the mission's daily pillars, self-reported into daily_metrics.
    getDailyMetrics(ctx.userId, today),
    onboarded && ctx.companyId
      ? getDiary(ctx.userId, ctx.companyId, today).catch(() => null)
      : Promise.resolve(null),
    onboarded
      ? Promise.all([
          supabase
            .from('onboarding_responses')
            .select('answers, completed_at')
            .eq('profile_id', ctx.userId)
            .maybeSingle(),
          supabase
            .from('weight_entries')
            .select('weight_kg')
            .eq('profile_id', ctx.userId)
            .order('recorded_on', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
      : Promise.resolve(null),
  ]);

  // Today's nutrition for the home card (consumed vs. target). Only meaningful once onboarded, since
  // the pre-onboarding home shows the "build your plan" state.
  const nutrition: TodayNutrition | null = diary?.target
    ? { consumed: diary.totals, target: diary.target }
    : null;

  const KG_TO_LB = 2.20462;

  // Weight/goal progress for the Today card (start -> current -> goal), reusing the onboarding start
  // + the latest logged weight. Only once onboarded + a goal weight exists.
  let onbStartedAt: string | null = null;
  let weightGoal: { startLb: number; currentLb: number; goalLb: number; pct: number } | null = null;
  if (goalRows) {
    const [{ data: onb }, { data: lw }] = goalRows;
    onbStartedAt = ((onb as { completed_at?: string | null } | null)?.completed_at) ?? null;
    const a = (onb?.answers ?? null) as { weightKg?: number; goalWeightKg?: number } | null;
    if (a?.weightKg && a?.goalWeightKg) {
      const startLb = Math.round(a.weightKg * KG_TO_LB);
      const goalLb = Math.round(a.goalWeightKg * KG_TO_LB);
      const currentLb = lw ? Math.round(Number(lw.weight_kg) * KG_TO_LB) : startLb;
      const span = Math.abs(startLb - goalLb) || 1;
      // Directional progress: only movement TOWARD the goal counts (abs() made moving away from the
      // goal fill the bar too). Clamped 0-100.
      const toward = (currentLb - startLb) * Math.sign(goalLb - startLb);
      const pct = Math.max(0, Math.min(100, Math.round((toward / span) * 100)));
      weightGoal = { startLb, currentLb, goalLb, pct };
    }
  }

  // All date math anchors on the MEMBER's calendar day (`today` = localDay(tz), computed above),
  // never the lambda's UTC clock. The old `new Date()` version showed a US member tomorrow's date
  // from ~5pm Pacific and rolled the week strip into an empty next week on Saturday evenings.
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  }).format(new Date());

  // Anchor the member's local day as a UTC-midnight Date so day arithmetic is pure calendar math
  // (immune to the server's own zone and to DST edges).
  const [ty, tm, td] = today.split('-').map(Number);
  const anchor = new Date(Date.UTC(ty, tm - 1, td));
  const startOfWeek = new Date(anchor);
  startOfWeek.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const activeSet = new Set(summary?.activeDays ?? []);
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setUTCDate(startOfWeek.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return {
      key: String(i),
      label: narrow.format(d),
      day: d.getUTCDate(),
      isToday: iso === today,
      completed: activeSet.has(iso),
    };
  });

  // Weeks since she started, for the "Week N of your transformation" line. Anchored to her
  // onboarding completion (the real start of the plan), falling back to the profile creation date.
  // Null when neither is known, so the line is hidden rather than showing a fabricated week 1.
  const startedAt =
    onbStartedAt ?? ((profile as { created_at?: string } | null)?.created_at ?? null);
  const weeksIn = weeksSince(startedAt);

  return (
    <TodayScreen
      intelligence={<IntelligenceCard prediction={prediction} meals={meals} />}
      name={firstName}
      dateLabel={dateLabel}
      weekDays={weekDays}
      initial={summary}
      habits={habits}
      nutrition={nutrition}
      catchUp={catchUp}
      weightGoal={weightGoal}
      coach={coach}
      supportEmail={supportEmail}
      weeksIn={weeksIn}
      daily={daily}
    />
  );
}
