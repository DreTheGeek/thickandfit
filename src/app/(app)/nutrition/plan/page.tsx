// Client meal-plan view: the plan the coach built - daily targets, meal groups, and the coach's
// notes (Stephanie's "feel free to add spinach/onions" note). Read-only, entitlement-gated.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getClientMealPlan } from '@/lib/coach/meal-plans';
import { StructuredPlanView } from '@/components/nutrition/structured-plan-view';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function ClientMealPlanPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.nutrition');
  const plan = ctx.companyId ? await getClientMealPlan(ctx.companyId, ctx.userId) : null;

  return (
    <div className="px-[22px] pb-7 pt-3">
      <Link
        href="/nutrition"
        className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> {t('mpBack')}
      </Link>

      {!plan ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <Icon name="nutrition" size={36} className="mb-3 text-line" />
          <div className="font-display text-[20px]">{t('mpEmpty')}</div>
          <p className="mt-1 max-w-[260px] text-[13px] text-faint">{t('mpEmptyHint')}</p>
        </div>
      ) : (
        <>
          <PageTitle className="mb-4">{plan.name}</PageTitle>

          {/* Daily targets */}
          <Card className="mb-4 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('mpTargets')}
            </div>
            <div className="mt-1.5 font-display text-[34px] leading-none">
              {plan.structured?.calorieTarget ?? plan.calorieGoal ?? '--'}
              <span className="ml-1.5 text-[13px] text-muted">{t('mpKcalDay')}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { l: t('mpProtein'), v: plan.structured?.macros?.proteinG ?? plan.proteinG, c: 'var(--color-macro-protein)' },
                { l: t('mpCarbs'), v: plan.structured?.macros?.carbG ?? plan.carbG, c: 'var(--color-macro-carbs)' },
                { l: t('mpFat'), v: plan.structured?.macros?.fatG ?? plan.fatG, c: 'var(--color-macro-fat)' },
              ].map((m) => (
                <div key={m.l} className="rounded-xl bg-warm p-3 text-center">
                  <div className="font-display text-[20px] leading-none">{Math.round(m.v ?? 0)}g</div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[1px] text-faint">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.c }} />
                    {m.l}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Coach notes (the headline of this feature) */}
          {plan.notes ? (
            <Card className="mb-4 bg-accent/10 p-5">
              <div className="mb-1.5 flex items-center gap-2 text-accent">
                <Icon name="sparkles" size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-[2px]">
                  {t('mpCoachNotes')}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-soft">{plan.notes}</p>
            </Card>
          ) : null}

          {/* Meals: the full structured plan (built/generated in-app), else the legacy group list. */}
          {plan.structured ? (
            <>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {t('mpMeals')}
              </div>
              <StructuredPlanView plan={plan.structured} />
            </>
          ) : plan.groups.length > 0 ? (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {t('mpMeals')}
              </div>
              <Card className="divide-y divide-divider p-0">
                {plan.groups.map((g, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-[15px] font-medium">{g.name || t('mpMealUntitled')}</span>
                    {g.numberOfMeals != null ? (
                      <span className="text-[12px] text-faint">
                        {t('mpMealOptions', { n: g.numberOfMeals })}
                      </span>
                    ) : null}
                  </div>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
