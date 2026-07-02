// Meal-plan detail: calorie goal + macro ring/split + meal groups.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getMealPlanDetail } from '@/lib/coach/meal-plans';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { MealPlanNotesEditor } from '@/components/coach/meal-plan-notes';

export const dynamic = 'force-dynamic';

export default async function CoachMealPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const p = await getMealPlanDetail(ctx.companyId, id);
  if (!p) notFound();
  const t = await getTranslations('app.coach');
  const { from } = await searchParams;
  const fromQs = Array.isArray(from) ? (from[0] ?? '') : (from ?? '');
  const backHref = fromQs ? `/coach/tool/meal-plans?${fromQs}` : '/coach/tool/meal-plans';

  const macros = [
    { l: t('macroProtein'), v: p.proteinG ?? 0, pct: p.splitProteinPct, c: 'var(--color-macro-protein)' },
    { l: t('macroCarbs'), v: p.carbG ?? 0, pct: p.splitCarbPct, c: 'var(--color-macro-carbs)' },
    { l: t('macroFat'), v: p.fatG ?? 0, pct: p.splitFatPct, c: 'var(--color-macro-fat)' },
  ];

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-7 sm:px-8">
      <Link href={backHref} className="tf-press mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToMealPlans')}
      </Link>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <MacroRing proteinG={p.proteinG ?? 0} carbG={p.carbG ?? 0} fatG={p.fatG ?? 0} kcal={p.calorieGoal ?? 0} size={100} />
          <div className="min-w-0 flex-1">
            {p.clientName && <div className="mb-1 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{p.clientName}</div>}
            <h1 className="tf-display text-[26px] leading-tight">{p.name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-muted">
              {p.macroTiming && <span>{p.macroTiming}</span>}
              {p.calorieGoal != null && <span>{p.calorieGoal} kcal {t('perDay')}</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {macros.map((m) => (
                <div key={m.l} className="rounded-xl border border-line p-3 text-center">
                  <div className="font-display text-[20px] leading-none">{Math.round(m.v)}g</div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[1px] text-faint">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.c }} /> {m.l}
                    {m.pct != null && <span>{m.pct}%</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-[18px]">{t('mealGroups')}</h2>
        {p.groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">{t('noData')}</p>
        ) : (
          <div className="flex flex-col">
            {p.groups.map((g, i) => (
              <div key={i} className="flex items-center justify-between border-b border-divider py-3 text-[14px] last:border-0">
                <span className="font-medium">{g.name || t('mealGroupUntitled')}</span>
                {g.numberOfMeals != null && <span className="text-[12px] text-faint">{t('mealOptions', { n: g.numberOfMeals })}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <MealPlanNotesEditor planId={p.id} initial={p.notes} />
    </div>
  );
}
