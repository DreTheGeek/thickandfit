// Subscriber "Today" home. Requires auth; SSRs the summary + greeting + week strip,
// the Today screen handles the four states client-side.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { getTodayHabits, localToday } from '@/lib/habits/habits';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { TodayScreen, type WeekDay } from '@/components/dashboard/today-screen';

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
  let summary: DashboardSummary | null = null;
  if (ctx.companyId) summary = await getDashboardSummary(ctx.companyId, ctx.userId);
  const habits = ctx.companyId ? await getTodayHabits(ctx.userId, localToday(tz)) : [];

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
    />
  );
}
