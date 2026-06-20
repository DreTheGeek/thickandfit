// Recipe detail: hero image, macro ring, ingredient list (with per-ingredient macros), procedure.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getRecipeDetail } from '@/lib/coach/recipes';
import { Icon } from '@/components/ui/icons';
import { RecipeImage } from '@/components/coach/recipe-image';
import { RecipeServingScaler } from '@/components/coach/recipe-serving-scaler';
import { RecipeFavoriteButton } from '@/components/coach/recipe-favorite-button';
import { RecipeQualityBadge } from '@/components/coach/recipe-quality-badge';
import { RecipeSourceVideo } from '@/components/coach/recipe-source-video';

export const dynamic = 'force-dynamic';

export default async function CoachRecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const locale = await getLocale();
  const r = await getRecipeDetail(ctx.companyId, id, locale, ctx.userId);
  if (!r) notFound();
  const t = await getTranslations('app.coach');
  const { from } = await searchParams;
  const fromQs = Array.isArray(from) ? (from[0] ?? '') : (from ?? '');
  const backHref = fromQs ? `/coach/tool/recipes?${fromQs}` : '/coach/tool/recipes';

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-7 sm:px-8">
      <Link href={backHref} className="tf-press mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToRecipes')}
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[420px]">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-warm">
            <RecipeImage src={r.image} alt={r.name} sizes="420px" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {r.category && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{r.category}</div>}
          <div className="flex items-start justify-between gap-3">
            <h1 className="tf-display text-[30px] leading-tight">{r.name || t('recipeUntitled')}</h1>
            <RecipeFavoriteButton recipeId={r.id} initial={r.isFavorite} variant="button" className="mt-1 shrink-0" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RecipeQualityBadge band={r.qualityBand} score={r.qualityScore} showScore />
            {r.bookName && <span className="text-[13px] text-muted">{r.bookName}</span>}
          </div>

          <div className="mt-5">
            <RecipeServingScaler
              base={{ proteinG: r.proteinG, carbG: r.carbG, fatG: r.fatG, kcal: r.kcal }}
              baseServings={r.servings}
              ingredients={r.ingredients}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-muted">
            {r.prepTime != null && <span>{t('prepTime')}: {r.prepTime}m</span>}
            {r.cookTime != null && <span>{t('cookTime')}: {r.cookTime}m</span>}
            <span>{t('ingredientsLabel')}: {r.ingredientCount}</span>
          </div>
        </div>
      </div>

      {/* source video */}
      {r.videoUrl && (
        <div className="mt-6">
          <RecipeSourceVideo videoUrl={r.videoUrl} creatorHandle={r.creatorHandle} sourceUrl={r.sourceUrl} />
        </div>
      )}

      {/* spices + procedure */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-[18px]">{t('procedureLabel')}</h2>
          {r.procedure ? (
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-soft">{r.procedure}</div>
          ) : (
            <p className="py-6 text-center text-sm text-faint">{t('noData')}</p>
          )}
        </div>

        {r.spices.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 font-display text-[18px]">{t('spicesLabel')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {r.spices.map((s, i) => (
                <span key={i} className="rounded-full bg-warm px-2.5 py-1 text-[12px] text-soft">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
