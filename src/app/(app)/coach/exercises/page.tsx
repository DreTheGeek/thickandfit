// Coach exercise browser. RSC: parse URL filters -> one read of the shared corpus -> filter / facet
// in memory -> render. Search + muscle-group filter, mirroring the Clients CRM filter pattern.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseExerciseFilters, getExercisesPage } from '@/lib/coach/exercises';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { ExercisesView } from '@/components/coach/exercises-view';

export const dynamic = 'force-dynamic';

export default async function CoachExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();

  if (!ctx.companyId) {
    return <div className="p-8 text-sm text-muted">{t('exercisesEmpty')}</div>;
  }

  const filters = parseExerciseFilters(await searchParams);
  const page = await getExercisesPage(ctx.companyId, filters, locale);

  return (
    <div className="w-full px-5 py-8 sm:px-8 lg:py-10">
      <Eyebrow>{t('bucketTraining')}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{t('toolExercises')}</PageTitle>
      <p className="mb-5 max-w-2xl text-[13px] text-muted">{t('exercisesSubtitle')}</p>
      <ExercisesView page={page} filters={filters} />
    </div>
  );
}
