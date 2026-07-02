// Meal-plan builder (new plan). Starts from the 5 kcal-budgeted slots Stephanie uses so the coach fills
// recipes, not structure. Saves as a reusable library template (assignment to a client is separate).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { starterSlots } from '@/lib/coach/meal-plan-structured';
import { Icon } from '@/components/ui/icons';
import { MealPlanBuilder, type BuilderInitial } from '@/components/coach/meal-plan-builder';

export const dynamic = 'force-dynamic';

export default async function NewMealPlanPage(): Promise<ReactElement> {
  await requireCoach();
  const t = await getTranslations('app.coach');

  const initial: BuilderInitial = {
    planId: null,
    name: '',
    goal: '',
    calorieTarget: null,
    macros: { proteinG: 0, carbG: 0, fatG: 0 },
    notes: '',
    slots: starterSlots(),
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-7 sm:px-8">
      <Link href="/coach/tool/meal-plans" className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToMealPlans')}
      </Link>
      <h1 className="tf-display mb-1 text-[26px]">{t('mbNewTitle')}</h1>
      <p className="mb-5 text-[13px] text-faint">{t('mbSubtitle')}</p>
      <MealPlanBuilder initial={initial} />
    </div>
  );
}
