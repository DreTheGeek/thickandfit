// Leads pipeline (GHL-synced opportunities). RSC: parse URL filters -> board read -> render.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseLeadFilters, getPipelineBoard } from '@/lib/coach/leads';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { LeadsView } from '@/components/coach/leads-view';

export const dynamic = 'force-dynamic';

export default async function CoachLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  if (!ctx.companyId) {
    return <div className="p-8 text-sm text-muted">{t('noLeads')}</div>;
  }
  const filters = parseLeadFilters(await searchParams);
  const board = await getPipelineBoard(ctx.companyId, filters);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
      <Eyebrow>{t('navLeads')}</Eyebrow>
      <PageTitle className="mb-5 mt-1">{t('leadsTitle')}</PageTitle>
      <LeadsView board={board} filters={filters} locale={locale} />
    </div>
  );
}
