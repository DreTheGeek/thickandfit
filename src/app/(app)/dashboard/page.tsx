// Subscriber "Today" home. Requires auth; SSRs the summary + greeting + week strip,
// the Today screen handles the four states client-side.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { getTodayHabits, localToday } from '@/lib/habits/habits';
import { getDiary } from '@/lib/nutrition/diary';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { TodayScreen, type WeekDay, type TodayNutrition } from '@/components/dashboard/today-screen';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle();
  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] ?? '';

  const tz = await getProfileTimezone(ctx.userId);
  const today = localToday(tz);
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

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      key: String(i),
      label: narrow.format(d),
      day: d.getDate(),
      isToday: d.toDateString() === now.toDateString(),
    };
  });

  return (
    <TodayScreen
      name={firstName}
      dateLabel={dateLabel}
      weekDays={weekDays}
      initial={summary}
      habits={habits}
      nutrition={nutrition}
    />
  );
}
