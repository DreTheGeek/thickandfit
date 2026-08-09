// Recipe Library browser. RSC: parse URL filters -> one read -> filter/sort/facet -> grid.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { parseRecipeFilters, getRecipesPage } from '@/lib/coach/recipes';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { RecipesView } from '@/components/coach/recipes-view';

export const dynamic = 'force-dynamic';

export default async function CoachRecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('noRecipes')}</div>;
  const filters = parseRecipeFilters(await searchParams);
  const page = await getRecipesPage(ctx.companyId, filters, locale, ctx.userId);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>{t('bucketToolbox')}</Eyebrow>
          <PageTitle className="mt-1">{t('toolRecipes')}</PageTitle>
        </div>
        <Link
          href="/coach/tool/recipe-books"
          className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
        >
          <Icon name="book" size={14} /> {t('toolRecipeBooks')}
        </Link>
      </div>
      <RecipesView page={page} filters={filters} />
    </div>
  );
}
