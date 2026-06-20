// Recipe detail: hero image, macro ring, ingredient list (with per-ingredient macros), procedure.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getRecipeDetail } from '@/lib/coach/recipes';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { RecipeImage } from '@/components/coach/recipe-image';

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
  const r = await getRecipeDetail(ctx.companyId, id, locale);
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
          <h1 className="tf-display text-[30px] leading-tight">{r.name || t('recipeUntitled')}</h1>
          {r.bookName && <div className="mt-1 text-[13px] text-muted">{r.bookName}</div>}

          <div className="mt-5 flex items-center gap-5 rounded-2xl border border-line bg-surface p-4">
            <MacroRing proteinG={r.proteinG} carbG={r.carbG} fatG={r.fatG} kcal={r.kcal} size={84} />
            <div className="grid flex-1 grid-cols-3 gap-2 text-center">
              {[
                { l: t('macroProtein'), v: r.proteinG, c: 'var(--color-macro-protein)' },
                { l: t('macroCarbs'), v: r.carbG, c: 'var(--color-macro-carbs)' },
                { l: t('macroFat'), v: r.fatG, c: 'var(--color-macro-fat)' },
              ].map((m) => (
                <div key={m.l}>
                  <div className="font-display text-[20px] leading-none">{Math.round(m.v)}g</div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[1px] text-faint">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.c }} /> {m.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-muted">
            {r.prepTime != null && <span>{t('prepTime')}: {r.prepTime}m</span>}
            {r.cookTime != null && <span>{t('cookTime')}: {r.cookTime}m</span>}
            <span>{t('ingredientsLabel')}: {r.ingredientCount}</span>
          </div>
        </div>
      </div>

      {/* ingredients + procedure */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-[18px]">{t('ingredientsLabel')}</h2>
          {r.ingredients.length === 0 ? (
            <p className="py-6 text-center text-sm text-faint">{t('noData')}</p>
          ) : (
            <ul className="flex flex-col">
              {r.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-divider py-2.5 text-[13px] last:border-0">
                  <span className="min-w-0">
                    <span className="font-medium">{ing.name}</span>
                    {ing.amountPrint && <span className="ml-2 text-faint">{ing.amountPrint}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">{ing.kcal} kcal</span>
                </li>
              ))}
            </ul>
          )}
          {r.spices.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('spicesLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {r.spices.map((s, i) => (
                  <span key={i} className="rounded-full bg-warm px-2.5 py-1 text-[12px] text-soft">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-[18px]">{t('procedureLabel')}</h2>
          {r.procedure ? (
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-soft">{r.procedure}</div>
          ) : (
            <p className="py-6 text-center text-sm text-faint">{t('noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
