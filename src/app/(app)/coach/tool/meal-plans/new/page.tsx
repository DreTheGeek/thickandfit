// Meal-plan builder (new plan). Starts from the 5 kcal-budgeted slots Stephanie uses so the coach fills
// recipes, not structure. Saves as a reusable library template (assignment to a client is separate).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { starterSlots } from '@/lib/coach/meal-plan-structured';
import { readCoachSettings } from '@/lib/coach/settings';
import { createServiceClient } from '@/lib/supabase/service';
import { Icon } from '@/components/ui/icons';
import { MealPlanBuilder, type BuilderInitial, type ForClient } from '@/components/coach/meal-plan-builder';

export const dynamic = 'force-dynamic';

export default async function NewMealPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string | string[] }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  // "Default meal plan name" (coach settings). Empty means she has not set one, in which case the
  // builder keeps its own blank field rather than inventing a name in whichever language the
  // preference happened to be typed in.
  const { defaultMealPlanName } = await readCoachSettings(ctx.companyId);

  // Optional client scope. Without ?contact= this is a library template, so the "her numbers"
  // header has nothing to say and renders nothing at all rather than a card full of dashes.
  const { contact } = await searchParams;
  const contactId = typeof contact === 'string' ? contact : null;
  let forClient: ForClient = null;
  if (contactId && ctx.companyId) {
    const { data } = await createServiceClient()
      .from('client_intake')
      .select('bmr, tdee, pal, allergies, goal_type')
      .eq('company_id', ctx.companyId)
      .eq('contact_id', contactId)
      .maybeSingle<{
        bmr: number | null;
        tdee: number | null;
        pal: number | null;
        allergies: string | null;
        goal_type: string | null;
      }>();
    if (data) {
      forClient = {
        bmr: data.bmr,
        tdee: data.tdee,
        pal: data.pal,
        allergies: data.allergies,
        goal: data.goal_type,
      };
    }
  }

  const initial: BuilderInitial = {
    planId: null,
    name: defaultMealPlanName,
    goal: '',
    calorieTarget: null,
    macros: { proteinG: 0, carbG: 0, fatG: 0 },
    notes: '',
    slots: starterSlots(),
  };

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <Link href="/coach/tool/meal-plans" className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToMealPlans')}
      </Link>
      <h1 className="tf-display mb-1 text-[26px]">{t('mbNewTitle')}</h1>
      <p className="mb-5 text-[13px] text-faint">{t('mbSubtitle')}</p>
      <MealPlanBuilder initial={initial} forClient={forClient} />
    </div>
  );
}
