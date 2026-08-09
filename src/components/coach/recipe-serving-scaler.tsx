'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { ConfidenceDots } from '@/components/coach/confidence-dots';
import type { RecipeIngredient } from '@/lib/coach/recipes-types';
import type { IngredientDisplay } from '@/lib/coach/settings-shared';

const STEPS = [0.5, 1, 2, 3, 4] as const;
const MIN = 0.5;
const MAX = 4;

type Macros = { proteinG: number; carbG: number; fatG: number; kcal: number };

// Scales the recipe's per-serving macros + each ingredient amount by a 0.5x-4x multiplier.
// All math is client-side off the base (1x) values passed in; nothing is re-fetched.
/**
 * The household-measure half of amount_print.
 *
 * Every one of the 824 imported ingredient rows stores amount_print as "<grams>g (<measure>)", so the
 * raw string already contains the gram figure. Pasting it next to a scaled gram figure produced
 * "20 g (20g (~1/4 cup))", which is why this pulls out just the parenthesised measure. A row with no
 * parentheses is treated as being entirely the measure.
 */
function unitPhrase(amountPrint: string | null): string | null {
  if (!amountPrint) return null;
  const match = amountPrint.match(/\(([^)]+)\)\s*$/);
  const phrase = (match ? match[1] : amountPrint).trim();
  return phrase.length > 0 ? phrase : null;
}

/**
 * Render one ingredient's amount under the coach's "Display recipe ingredients in" preference.
 *
 * ONLY GRAMS SCALE. Grams are a number; "~1/4 cup" and "3 1/2 pcs" are not, and multiplying them
 * gives either "2.5 ~1/4 cup" or a silently wrong rounding. So above or below 1x the household
 * measure is dropped and the scaled gram figure stands alone, including in "Units only": a coach who
 * asked for cups is better served by an accurate gram weight than by a cup figure that is wrong.
 *
 * When the preferred form is missing for a row the other one is shown. A blank amount is not a
 * preference being honoured, it is a recipe that cannot be cooked.
 */
function amountLabel(
  ing: RecipeIngredient,
  factor: number,
  display: IngredientDisplay,
): string | null {
  const grams = ing.amountGrams == null ? null : `${Math.round(ing.amountGrams * factor)} g`;
  const measure = unitPhrase(ing.amountPrint);
  const units = factor === 1 ? measure : null;
  if (display === 'grams') return grams ?? measure;
  if (display === 'units') return units ?? grams ?? measure;
  if (grams && units) return `${grams} (${units})`;
  return grams ?? units ?? measure;
}

export function RecipeServingScaler({
  base,
  baseServings,
  ingredients,
  ingredientDisplay,
}: {
  base: Macros;
  baseServings: number;
  ingredients: RecipeIngredient[];
  ingredientDisplay: IngredientDisplay;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [factor, setFactor] = useState(1);

  const scaled = useMemo<Macros>(
    () => ({
      proteinG: base.proteinG * factor,
      carbG: base.carbG * factor,
      fatG: base.fatG * factor,
      kcal: Math.round(base.kcal * factor),
    }),
    [base, factor],
  );

  const servings = Math.round(baseServings * factor * 10) / 10;
  const fmtFactor = (f: number): string => (Number.isInteger(f) ? `${f}` : `${f}`);

  function bump(delta: number): void {
    setFactor((f) => Math.min(MAX, Math.max(MIN, Math.round((f + delta) * 2) / 2)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* macro card */}
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface p-4">
        <MacroRing proteinG={scaled.proteinG} carbG={scaled.carbG} fatG={scaled.fatG} kcal={scaled.kcal} size={84} />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          {[
            { l: t('macroProtein'), v: scaled.proteinG, c: 'var(--color-macro-protein)' },
            { l: t('macroCarbs'), v: scaled.carbG, c: 'var(--color-macro-carbs)' },
            { l: t('macroFat'), v: scaled.fatG, c: 'var(--color-macro-fat)' },
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

      {/* serving scaler */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('servingScaler')}</div>
          <div className="text-[13px] text-muted">
            {t('servingsLabel')}: <span className="font-display text-ink">{servings}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => bump(-0.5)}
            disabled={factor <= MIN}
            aria-label={t('servingDecrease')}
            className="tf-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-40"
          >
            <Icon name="minus" size={16} />
          </button>
          <div className="flex flex-1 flex-wrap justify-center gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFactor(s)}
                className={`tf-press min-w-[44px] rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  factor === s ? 'bg-ink text-bg' : 'border border-line text-soft hover:border-ink hover:text-ink'
                }`}
              >
                {fmtFactor(s)}x
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => bump(0.5)}
            disabled={factor >= MAX}
            aria-label={t('servingIncrease')}
            className="tf-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-40"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      {/* ingredients (scaled) */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[18px]">{t('ingredientsLabel')}</h2>
          {factor !== 1 && <span className="text-[11px] font-semibold text-accent">{fmtFactor(factor)}x</span>}
        </div>
        {ingredients.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">{t('noData')}</p>
        ) : (
          <ul className="flex flex-col">
            {ingredients.map((ing, i) => {
              const amount = amountLabel(ing, factor, ingredientDisplay);
              return (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-divider py-2.5 text-[13px] last:border-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ConfidenceDots
                      confidence={ing.confidence}
                      isVerified={ing.isVerified}
                      label={
                        ing.isVerified
                          ? t('ingredientVerified')
                          : t('ingredientConfidence', { pct: Math.round(ing.confidence * 100) })
                      }
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{ing.name}</span>
                      {amount && <span className="ml-2 text-faint">{amount}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">{Math.round(ing.kcal * factor)} kcal</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
