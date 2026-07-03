// Client meal-plan DOCUMENT: mirrors Stephanie's real Lenus plan handouts section-for-section -
// personalized header (name + daily kcal + macros), the "Dear {name}" intro letter + disclaimer,
// the structure/background section (macro % table + per-slot kcal budgets), her tips, then the
// kcal-budgeted slots with "pick one" recipe options. Printable (save-as-PDF = her old deliverable).
// Read-only, entitlement-gated.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { getClientMealPlan } from '@/lib/coach/meal-plans';
import { StructuredPlanView } from '@/components/nutrition/structured-plan-view';
import { PlanPrintButton } from '@/components/nutrition/plan-print-button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default async function ClientMealPlanPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.nutrition');
  const plan = ctx.companyId ? await getClientMealPlan(ctx.companyId, ctx.userId) : null;

  // Member first name for the document header + letter (the PDFs address the client by name).
  let firstName = '';
  {
    const svc = createServiceClient();
    const { data } = await svc.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
    const full = ((data as { full_name: string | null } | null)?.full_name ?? '').trim();
    firstName = full ? full.split(/\s+/)[0] : '';
  }

  const s = plan?.structured ?? null;
  const kcal = s?.calorieTarget ?? plan?.calorieGoal ?? null;
  const macros = {
    p: s?.macros?.proteinG ?? plan?.proteinG ?? null,
    c: s?.macros?.carbG ?? plan?.carbG ?? null,
    f: s?.macros?.fatG ?? plan?.fatG ?? null,
  };
  const split = s?.macroSplit ?? null;
  const slotBudgets = (s?.slots ?? []).filter((x) => x.kcalTarget != null);
  const isDeficit = /los|deficit|bajar|perder|cut/i.test(s?.goal ?? plan?.name ?? '');

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/nutrition"
          className="tf-press inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
        >
          <Icon name="arrowLeft" size={16} /> {t('mpBack')}
        </Link>
        {plan ? <PlanPrintButton /> : null}
      </div>

      {!plan ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <Icon name="nutrition" size={36} className="mb-3 text-line" />
          <div className="font-display text-[20px]">{t('mpEmpty')}</div>
          <p className="mt-1 max-w-[260px] text-[13px] text-faint">{t('mpEmptyHint')}</p>
        </div>
      ) : (
        <>
          {/* Document header: exactly the header band of her PDFs (name | kcal | P/C/F). */}
          <div className="mb-4 rounded-2xl bg-ink p-5 text-bg print:break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                {firstName ? <div className="font-display text-[22px] leading-none">{firstName}</div> : null}
                <div className="mt-1 text-[12px] text-bg/60">{plan.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] text-bg/80">
                  {t('mpDailyIntakeShort')}: <span className="font-semibold text-bg">{kcal ?? '--'} kcal</span>
                </div>
                <div className="mt-0.5 text-[12px] text-bg/60">
                  {t('mpProtein')}: <b className="text-bg">{Math.round(macros.p ?? 0)}g</b>{' '}
                  {t('mpCarbs')}: <b className="text-bg">{Math.round(macros.c ?? 0)}g</b>{' '}
                  {t('mpFat')}: <b className="text-bg">{Math.round(macros.f ?? 0)}g</b>
                </div>
              </div>
            </div>
          </div>

          {/* Intro letter (the "Dear {name}" page of her PDFs) + the standing disclaimer. */}
          <Card className="mb-4 p-5 print:break-inside-avoid">
            <h2 className="font-display text-[20px]">{t('mpIntroTitle')}</h2>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.65] text-soft">
              {s?.intro ?? t('mpIntroDefault', { name: firstName || t('mpFriend') })}
            </p>
            <p className="mt-3 text-[14px] leading-[1.6] text-soft">{t('mpIntroClosing')}</p>
            <p className="mt-2 text-[14px] font-semibold">{t('mpIntroSignoff')}</p>
            <p className="mt-4 border-t border-divider pt-3 text-[11px] leading-[1.6] text-faint">
              {t('mpDisclaimer')}
            </p>
          </Card>

          {/* Structure + background: the macro-distribution table and per-slot budgets of her PDFs. */}
          {(split || slotBudgets.length > 0) && (
            <Card className="mb-4 p-5 print:break-inside-avoid">
              <h2 className="font-display text-[20px]">{t('mpStructureTitle')}</h2>
              {split ? (
                <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-xl border border-line text-center text-[13px]">
                  {[
                    { l: t('mpDailyEnergy'), v: `${kcal ?? '--'} kcal` },
                    { l: t('mpProtein'), v: `${split.proteinPct}%` },
                    { l: t('mpCarbs'), v: `${split.carbPct}%` },
                    { l: t('mpFat'), v: `${split.fatPct}%` },
                  ].map((cell, i) => (
                    <div key={cell.l} className={i > 0 ? 'border-l border-line' : ''}>
                      <div className="border-b border-line bg-warm px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                        {cell.l}
                      </div>
                      <div className="px-1 py-2.5 font-semibold">{cell.v}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {slotBudgets.length > 0 ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
                    {t('mpDailyIntake')}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {slotBudgets.map((sl, i) => (
                      <li key={i} className="flex items-baseline justify-between text-[14px]">
                        <span>{sl.name}</span>
                        <span className="text-muted">{sl.kcalTarget} kcal</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-4 text-[12px] leading-[1.6] text-faint">
                {isDeficit ? `${t('mpDeficitNote')} ` : ''}
                {t('mpEnergyNote')}
              </p>
            </Card>
          )}

          {/* Coach notes (her free-veggie note). */}
          {plan.notes ? (
            <Card className="mb-4 bg-accent/10 p-5 print:break-inside-avoid">
              <div className="mb-1.5 flex items-center gap-2 text-accent">
                <Icon name="sparkles" size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-[2px]">{t('mpCoachNotes')}</span>
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-soft">{plan.notes}</p>
            </Card>
          ) : null}

          {/* Tips to help you succeed (condensed from her standard tips page). */}
          <Card className="mb-4 p-5 print:break-inside-avoid">
            <details className="tf-details">
              <summary className="tf-press flex cursor-pointer list-none items-center justify-between">
                <h2 className="font-display text-[20px]">{t('mpTipsTitle')}</h2>
                <Icon name="chevronRight" size={18} className="tf-details-chevron text-faint print:hidden" />
              </summary>
              <ul className="mt-3 space-y-2.5">
                {[t('mpTipWeigh'), t('mpTipSpices'), t('mpTipPrep'), t('mpTipWeekly')].map((tip, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-[1.6] text-soft">
                    <span className="shrink-0 font-display text-accent">{i + 1}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>

          {/* The meal slots: "pick one from this category every day". */}
          {s ? (
            <>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {t('mpMeals')}
              </div>
              <StructuredPlanView plan={s} />
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
                      <span className="text-[12px] text-faint">{t('mpMealOptions', { n: g.numberOfMeals })}</span>
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
