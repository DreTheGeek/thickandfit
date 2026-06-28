// Subscriber food diary (Phase 2 nutrition engine). Replaces the ComingSoon stub: search the
// shared food corpus, log to today's diary, see intake vs target.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { getDiary, localToday } from '@/lib/nutrition/diary';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { DiaryScreen } from '@/components/nutrition/diary-screen';

export const dynamic = 'force-dynamic';

export default async function NutritionPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const tz = await getProfileTimezone(ctx.userId);
  const date = localToday(tz);
  const diary = await getDiary(ctx.userId, ctx.companyId, date);
  return <DiaryScreen diary={diary} />;
}
