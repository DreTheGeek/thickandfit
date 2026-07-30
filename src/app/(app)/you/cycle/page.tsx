// Cycle tracking. Member-only surface: 0097's RLS means a coach cannot browse this, and the coach
// assistant only sees a phase line once she has actually logged a period.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { loadCycleSummary } from '@/lib/cycle/data';
import { PageTitle } from '@/components/ui/section';
import { CycleScreen } from '@/components/cycle/cycle-screen';

export const dynamic = 'force-dynamic';

export default async function CyclePage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const t = await getTranslations('app.cycle');
  // The clock is read HERE, once, in the server component, and the day is passed down. Phase math is
  // pure and never reads a clock itself (the project's render-purity rule).
  const today = new Date().toISOString().slice(0, 10);
  const summary = await loadCycleSummary(ctx.userId, today);

  return (
    <div className="px-[22px] pb-28 pt-3">
      <PageTitle>{t('title')}</PageTitle>
      <p className="mb-1 mt-2 text-[14px] leading-[1.55] text-soft">{t('intro')}</p>
      <p className="mb-7 text-[12px] text-faint">{t('privacy')}</p>
      <CycleScreen summary={summary} today={today} />
    </div>
  );
}
