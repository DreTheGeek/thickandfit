// Subscriber "Today" home. Requires auth; SSRs the summary + greeting + week strip,
// the Today screen handles the four states client-side.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { getTodayHabits, localToday } from '@/lib/habits/habits';
import { getDiary } from '@/lib/nutrition/diary';
import { getCommunity } from '@/lib/community/feed';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { getSupportEmail } from '@/lib/admin/settings';
import { TodayScreen, type WeekDay, type TodayNutrition, type CatchUp } from '@/components/dashboard/today-screen';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, created_at')
    .eq('id', ctx.userId)
    .maybeSingle();
  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] ?? '';

  const tz = await getProfileTimezone(ctx.userId);
  const today = localToday(tz);
  const supportEmail = await getSupportEmail(ctx.companyId);
  let summary: DashboardSummary | null = null;
  if (ctx.companyId) summary = await getDashboardSummary(ctx.companyId, ctx.userId);
  const habits = ctx.companyId ? await getTodayHabits(ctx.userId, today) : [];

  // Today's nutrition for the home card (consumed vs. target). Only meaningful once onboarded, since
  // the pre-onboarding home shows the "build your plan" state.
  let nutrition: TodayNutrition | null = null;
  if (ctx.companyId && summary?.hasOnboarded) {
    try {
      const diary = await getDiary(ctx.userId, ctx.companyId, today);
      if (diary.target) nutrition = { consumed: diary.totals, target: diary.target };
    } catch {
      nutrition = null;
    }
  }

  // Catch-up: newest coach broadcast + active challenge progress (best-effort; never blocks the home).
  let catchUp: CatchUp | null = null;
  if (ctx.companyId) {
    try {
      const community = await getCommunity(ctx.userId);
      catchUp = {
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
      };
    } catch {
      catchUp = null;
    }
  }

  const KG_TO_LB = 2.20462;

  // Weight/goal progress for the Today card (start -> current -> goal), reusing the onboarding start
  // + the latest logged weight. Only once onboarded + a goal weight exists.
  let onbStartedAt: string | null = null;
  let weightGoal: { startLb: number; currentLb: number; goalLb: number; pct: number } | null = null;
  if (ctx.companyId && summary?.hasOnboarded) {
    const [{ data: onb }, { data: lw }] = await Promise.all([
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
    ]);
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

  // Coach card: the company's coach (Stephanie). Service client + company scope (a subscriber can't
  // read other profiles via RLS); we only surface the display name.
  let coach: { name: string } | null = null;
  if (ctx.companyId) {
    const { data: c } = await createServiceClient()
      .from('profiles')
      .select('full_name')
      .eq('company_id', ctx.companyId)
      .in('role', ['operator', 'coach'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const nm = (c?.full_name ?? '').trim();
    if (nm) coach = { name: nm };
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
  const weeksIn = startedAt
    ? Math.max(1, Math.floor((Date.now() - Date.parse(startedAt)) / (7 * 86_400_000)) + 1)
    : null;

  return (
    <TodayScreen
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
    />
  );
}
