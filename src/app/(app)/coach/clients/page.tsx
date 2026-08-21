// Premium Clients CRM list. RSC: parse URL filters -> one server read -> filter/sort/facet
// in memory -> render. All filter state lives in the URL (shareable, back-safe).
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseClientFilters, getClientsPage, getSavedSegments } from '@/lib/coach/clients';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { ClientsView } from '@/components/coach/clients-view';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { peopleTabs } from '@/lib/coach/section-tabs';

export const dynamic = 'force-dynamic';

export default async function CoachClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();

  if (!ctx.companyId) {
    return <div className="p-8 text-sm text-muted">{t('noClients')}</div>;
  }

  const filters = parseClientFilters(await searchParams);
  const [page, segments] = await Promise.all([
    getClientsPage(ctx.companyId, filters),
    getSavedSegments(ctx.companyId),
  ]);

  const sectionTabs = await peopleTabs();

  return (
    <div>
      <CoachSectionTabs tabs={sectionTabs} active="/coach/clients" />
      <Eyebrow>{t('navClients')}</Eyebrow>
      <PageTitle className="mb-5 mt-1">{t('clientsTitle')}</PageTitle>
      <ClientsView page={page} segments={segments} filters={filters} locale={locale} />
    </div>
  );
}
