// Meal-plan builder (edit an existing plan). Maps the stored plan to the builder's initial state -
// structured slots when present, else the 5 starter slots so the coach fills rather than builds.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getMealPlanDetail } from '@/lib/coach/meal-plans';
import { starterSlots } from '@/lib/coach/meal-plan-structured';
import { Icon } from '@/components/ui/icons';
import { MealPlanBuilder, type BuilderInitial } from '@/components/coach/meal-plan-builder';

export const dynamic = 'force-dynamic';

export default async function EditMealPlanPage({ params }: { params: Promise<{ id: string }> }): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const p = await getMealPlanDetail(ctx.companyId, id);
  if (!p) notFound();
  const t = await getTranslations('app.coach');

  const initial: BuilderInitial = {
    planId: p.id,
    name: p.name,
    goal: p.structured?.goal ?? '',
    calorieTarget: p.structured?.calorieTarget ?? p.calorieGoal,
    macros: p.structured?.macros ?? {
      proteinG: p.proteinG ?? 0,
      carbG: p.carbG ?? 0,
      fatG: p.fatG ?? 0,
    },
    notes: p.notes ?? '',
    slots: p.structured?.slots ?? starterSlots(),
  };

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <Link href={`/coach/tool/meal-plans/${p.id}`} className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToPlan')}
      </Link>
      <h1 className="tf-display mb-1 text-[26px]">{t('mbEditTitle')}</h1>
      <p className="mb-5 text-[13px] text-faint">{t('mbSubtitle')}</p>
      <MealPlanBuilder initial={initial} />
    </div>
  );
}
