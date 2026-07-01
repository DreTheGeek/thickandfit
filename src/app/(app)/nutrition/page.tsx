// Subscriber food diary (Phase 2 nutrition engine). Search / scan / log; intake vs target; browse any
// past day via ?date=YYYY-MM-DD (never a future day). getDiary already takes a date.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { getDiary, localToday } from '@/lib/nutrition/diary';
import { getRecentFoods, getFavorites } from '@/lib/nutrition/foods';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { getLocale } from 'next-intl/server';
import { DiaryScreen } from '@/components/nutrition/diary-screen';

export const dynamic = 'force-dynamic';

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const locale = await getLocale();
  const tz = await getProfileTimezone(ctx.userId);
  const todayStr = localToday(tz);
  const sp = await searchParams;
  const requested = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayStr;
  const date = requested > todayStr ? todayStr : requested; // never a future day
  const [diary, recents, favorites] = await Promise.all([
    getDiary(ctx.userId, ctx.companyId, date),
    getRecentFoods(ctx.userId, locale),
    getFavorites(ctx.userId, locale),
  ]);
  return (
    <DiaryScreen
      diary={diary}
      recents={recents}
      favorites={favorites}
      favoriteIds={favorites.map((f) => f.id)}
      date={date}
      prevDate={addDays(date, -1)}
      nextDate={date < todayStr ? addDays(date, 1) : null}
      isToday={date === todayStr}
    />
  );
}
