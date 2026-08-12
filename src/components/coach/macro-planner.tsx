'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import {
  SPLIT_TEMPLATES,
  FLEX_MIN,
  FLEX_MAX,
  splitToGrams,
  gramsToSplit,
  flexRange,
  reconcile,
  kcalFromMacros,
  recommendIntake,
  ACTIVITY_LEVELS,
  MIN_SAFE_KCAL,
  type ActivityKey,
  type Macros,
  type SlotTotals,
} from '@/lib/meal-plans/macros';

/**
 * The planning layer above the meal slots.
 *
 * The builder had raw P/C/F number inputs and nothing else, so a coach had to do the arithmetic in
 * her head and had no way to see whether the meals she then wrote actually added up. Everything
 * here is presentation over lib/meal-plans/macros.ts, which is pure and tested.
 *
 * THE RECONCILIATION STRIP IS THE POINT. Lenus lets a plan be saved whose meals do not sum to its
 * own header and says nothing, which is how a client ends up eating to a number her coach never
 * intended. Showing the signed difference makes the gap a decision instead of an accident.
 */
export function MacroPlanner({
  calories,
  macros,
  slotTotals,
  onApply,
  bmr,
  tdee,
  pal,
  allergies,
  avoid,
  goal,
}: {
  calories: number | null;
  macros: Macros;
  /** What the written meals actually add up to, each carrying its own kcal. */
  slotTotals: SlotTotals[];
  onApply: (next: { calories: number; macros: Macros }) => void;
  bmr?: number | null;
  tdee?: number | null;
  pal?: number | null;
  allergies?: string | null;
  avoid?: string[];
  /** Her stored goal, so a recommendation cuts or builds in the right direction. */
  goal?: 'lose' | 'maintain' | 'gain' | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [flex, setFlex] = useState(5);
  const [activity, setActivity] = useState<ActivityKey | null>(null);

  const target = calories ?? 0;
  // Only once she has picked a multiplier. Defaulting to 'moderate' would put a number on screen
  // that looks derived from the client's data when half of it is our assumption.
  const rec = useMemo(() => {
    if (bmr == null || activity == null) return null;
    const level = ACTIVITY_LEVELS.find((a) => a.key === activity);
    if (!level || goal == null) return null;
    return recommendIntake(bmr, level.pal, goal);
  }, [bmr, activity, goal]);
  const split = useMemo(() => gramsToSplit(macros), [macros]);
  const recon = useMemo(() => reconcile(macros, target, slotTotals, flex), [macros, target, slotTotals, flex]);

  // Atwater on the grams, shown beside her stated target rather than replacing it. Her own protocol
  // is 1,555 stated against 1,491 from the macros, because both come from labels and labels round.
  // The tool reports both and never silently "fixes" one to match the other.
  const fromMacros = kcalFromMacros(macros);

  const row = (label: string, value: string): ReactElement => (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-faint">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      {/* What her body needs, when we know it. Pulled from the intake she already answered, so the
          coach is not looking it up on another screen while writing the plan. */}
      {(bmr != null || tdee != null || allergies || (avoid?.length ?? 0) > 0) && (
        <div className="flex flex-col gap-1.5 border-b border-divider pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t('mpHerNumbers')}</div>
          {bmr != null && row(t('mpBmr'), `${Math.round(bmr)} kcal`)}
          {tdee != null && row(t('mpTdee'), `${Math.round(tdee)} kcal${pal != null ? ` · PAL ${pal.toFixed(2)}` : ''}`)}
          {allergies && row(t('mpAllergies'), allergies)}
          {(avoid?.length ?? 0) > 0 && row(t('mpAvoid'), (avoid ?? []).join(', '))}

          {/* Recommendation, derived from BMR rather than TDEE.
              265 of her clients have a BMR and exactly ONE has a TDEE, because the Lenus intake
              never asked an activity question we can score. Keying this off TDEE would leave it
              blank for 264 people. The multiplier is HER pick, not our guess: how active a client
              really is, is a coaching judgement. */}
          {bmr != null && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_LEVELS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setActivity(a.key)}
                    aria-pressed={activity === a.key}
                    className={[
                      'tf-press rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                      activity === a.key ? 'border-ink bg-ink text-bg' : 'border-line text-soft',
                    ].join(' ')}
                  >
                    {t(`mpActivity_${a.key}`)}
                  </button>
                ))}
              </div>
              {rec && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-muted">
                    {t('mpRecommends', { tdee: rec.tdee, target: rec.target })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onApply({ calories: rec.target, macros: splitToGrams(rec.target, SPLIT_TEMPLATES[0]) })}
                    className="tf-press rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-bg"
                  >
                    {t('mpUseThis')}
                  </button>
                  {/* Said out loud when it happens. A silently raised target is a coach thinking she
                      prescribed something she did not. */}
                  {rec.flooredToMinimum && (
                    <span className="text-[11px] text-alert-ink">{t('mpFloored', { min: MIN_SAFE_KCAL })}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t('mpSplit')}</div>
        <div className="flex flex-wrap gap-2">
          {SPLIT_TEMPLATES.map((tpl) => {
            // Highlighted when the current grams already sit on this template, within a point of
            // rounding, so she can see which one a hand-typed plan corresponds to.
            const on =
              Math.abs(split.protein - tpl.protein) <= 1 &&
              Math.abs(split.carb - tpl.carb) <= 1 &&
              Math.abs(split.fat - tpl.fat) <= 1;
            return (
              <button
                key={tpl.key}
                type="button"
                // Disabled without a calorie target: applying a split to nothing would silently zero
                // her macros, which reads as the tool having eaten the plan.
                disabled={target <= 0}
                onClick={() => onApply({ calories: target, macros: splitToGrams(target, tpl) })}
                className={[
                  'tf-press rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40',
                  on ? 'border-ink bg-ink text-bg' : 'border-line text-soft hover:border-ink hover:text-ink',
                ].join(' ')}
              >
                {t(`mpSplit_${tpl.key}`)}{' '}
                <span className={on ? 'text-bg/60' : 'text-faint'}>
                  {tpl.protein}/{tpl.carb}/{tpl.fat}
                </span>
              </button>
            );
          })}
        </div>
        {target <= 0 && <p className="mt-2 text-[12px] text-faint">{t('mpNeedCalories')}</p>}
      </div>

      {/* Flexibility. Strict is a competitor peaking; flexible is someone who will otherwise give up
          on a Tuesday. The gram ranges are what the member is actually told to hit. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t('mpFlex')}</span>
          <span className="text-[12px] font-semibold tabular-nums text-ink">±{flex}%</span>
        </div>
        <input
          type="range"
          min={FLEX_MIN}
          max={FLEX_MAX}
          value={flex}
          onChange={(e) => setFlex(Number(e.target.value))}
          aria-label={t('mpFlex')}
          className="w-full accent-[var(--color-ink)]"
        />
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ['mbProtein', macros.proteinG],
              ['mbCarbs', macros.carbG],
              ['mbFat', macros.fatG],
            ] as const
          ).map(([key, grams]) => {
            const r = flexRange(grams, flex);
            return (
              <div key={key} className="rounded-xl bg-warm px-2 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">{t(key)}</div>
                <div className="text-[13px] font-semibold tabular-nums text-ink">
                  {r.min}-{r.max}g
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Does the plan she wrote match the plan she set? */}
      <div className="border-t border-divider pt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t('mpCheck')}</div>
        {slotTotals.length === 0 ? (
          <p className="text-[12px] text-faint">{t('mpNoMeals')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(
              [
                ['mbCalories', recon.actual.kcal, target, recon.delta.kcal, 'kcal'],
                ['mbProtein', recon.actual.proteinG, macros.proteinG, recon.delta.proteinG, 'g'],
                ['mbCarbs', recon.actual.carbG, macros.carbG, recon.delta.carbG, 'g'],
                ['mbFat', recon.actual.fatG, macros.fatG, recon.delta.fatG, 'g'],
              ] as const
            ).map(([key, actual, goal, delta, unit]) => (
              <div key={key} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-faint">{t(key)}</span>
                <span className="tabular-nums">
                  <span className="font-medium text-ink">
                    {actual}
                    {unit}
                  </span>
                  <span className="text-faint"> / {goal}{unit}</span>
                  {/* Bracketed, and the unit is not repeated. Without the brackets "1555kcal -1555kcal"
                      reads as a RANGE rather than a shortfall, which is the opposite of the message. */}
                  {delta !== 0 && (
                    <span className="ml-1.5 text-alert-ink">
                      ({delta > 0 ? '+' : '−'}
                      {Math.abs(delta)})
                    </span>
                  )}
                </span>
              </div>
            ))}
            <p className={`mt-1 text-[12px] ${recon.withinTolerance ? 'text-accent' : 'text-alert-ink'}`}>
              {recon.withinTolerance ? t('mpInTolerance', { flex }) : t('mpOutOfTolerance', { flex })}
            </p>
          </div>
        )}
        {/* Stated vs Atwater, both shown. Never reconciled for her: see macros.ts. */}
        {target > 0 && Math.abs(fromMacros - target) > 0 && (
          <p className="mt-2 text-[11px] leading-[1.5] text-faint">
            {t('mpAtwaterNote', { fromMacros, target })}
          </p>
        )}
      </div>
    </div>
  );
}
