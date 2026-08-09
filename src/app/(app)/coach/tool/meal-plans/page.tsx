// Meal-plans Library (per-client plans imported from Lenus). RSC list with search/sort.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseMealPlanFilters, getMealPlansPage } from '@/lib/coach/meal-plans';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
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
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>{t('bucketNutrition')}</Eyebrow>
          <PageTitle className="mb-5 mt-1">{t('toolMealPlans')}</PageTitle>
        </div>
        <Link
          href="/coach/tool/meal-plans/new"
          className="tf-press mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-bg"
        >
          <Icon name="plus" size={14} /> {t('mbNewPlan')}
        </Link>
      </div>
      <MealPlansView page={page} filters={filters} />
    </div>
  );
}
