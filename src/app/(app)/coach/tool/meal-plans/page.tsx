// Meal-plans Library (per-client plans imported from Lenus). RSC list with search/sort.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseMealPlanFilters, getMealPlansPage } from '@/lib/coach/meal-plans';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { MealPlansView } from '@/components/coach/meal-plans-view';

export const dynamic = 'force-dynamic';

export default async function CoachMealPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('noMealPlans')}</div>;
  const filters = parseMealPlanFilters(await searchParams);
  const page = await getMealPlansPage(ctx.companyId, filters);

  return (
    <div className="w-full px-5 py-8 sm:px-8 lg:py-10">
      <Eyebrow>{t('bucketNutrition')}</Eyebrow>
      <PageTitle className="mb-5 mt-1">{t('toolMealPlans')}</PageTitle>
      <MealPlansView page={page} filters={filters} />
    </div>
  );
}
