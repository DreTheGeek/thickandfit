'use client';

// Client render of a STRUCTURED meal plan (the shape the builder + AI generator write). Mirrors
// Stephanie's real plan layout - kcal-budgeted slots, each with a few recipe OPTIONS, each recipe with
// raw-weight ingredients, per-recipe macros, an optional tip, and a collapsible Method - but in the
// app's design language (warm zero-border cards, green used only functionally). See meal-plan-method.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import type { PlanRecipe, PlanSlot, StructuredPlan } from '@/lib/coach/meal-plan-structured';

const MACRO_COLORS = {
  p: 'var(--color-macro-protein)',
  c: 'var(--color-macro-carbs)',
  f: 'var(--color-macro-fat)',
} as const;

export function StructuredPlanView({ plan }: { plan: StructuredPlan }): ReactElement {
  const t = useTranslations('app.nutrition');
  return (
    <div className="space-y-6">
      {plan.slots.map((slot, i) =>
        slot.recipes.length > 0 ? <SlotBlock key={i} slot={slot} t={t} /> : null,
      )}
    </div>
  );
}

function SlotBlock({
  slot,
  t,
}: {
  slot: PlanSlot;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[19px] uppercase tracking-[0.5px]">{slot.name}</h2>
        {slot.kcalTarget != null ? (
          <span className="shrink-0 text-[12px] text-faint">
            ~{slot.kcalTarget} {t('mpKcal')}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-[12px] italic text-faint">{t('mpPickOne')}</p>
      <div className="space-y-3">
        {slot.recipes.map((r, i) => (
          <RecipeCard key={i} recipe={r} t={t} />
        ))}
      </div>
    </section>
  );
}

function RecipeCard({
  recipe,
  t,
}: {
  recipe: PlanRecipe;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  const times: string[] = [];
  if (recipe.prepMin != null) times.push(`${t('mpPrep')} ${recipe.prepMin} ${t('mpMin')}`);
  if (recipe.cookMin != null) times.push(`${t('mpCook')} ${recipe.cookMin} ${t('mpMin')}`);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] leading-tight">{recipe.title}</h3>
        {recipe.kcal != null ? (
          <span className="shrink-0 rounded-full bg-warm px-2.5 py-1 text-[12px] font-semibold">
            {recipe.kcal} {t('mpKcal')}
          </span>
        ) : null}
      </div>

      {times.length > 0 ? (
        <div className="mt-1.5 text-[12px] text-faint">{times.join(' · ')}</div>
      ) : null}

      {recipe.macros ? (
        <div className="mt-3 flex gap-2">
          <MacroChip label={t('mpProtein')} value={recipe.macros.proteinG} color={MACRO_COLORS.p} />
          <MacroChip label={t('mpCarbs')} value={recipe.macros.carbG} color={MACRO_COLORS.c} />
          <MacroChip label={t('mpFat')} value={recipe.macros.fatG} color={MACRO_COLORS.f} />
        </div>
      ) : null}

      {recipe.ingredients.length > 0 ? (
        <div className="mt-4">
          <Eyebrow>{t('mpIngredients')}</Eyebrow>
          <ul className="mt-1.5 space-y-1">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="text-[14px] leading-snug">
                {ing.qty ? <span className="font-semibold">{ing.qty}</span> : null}
                {ing.qty ? ' ' : ''}
                <span className="text-soft">{ing.item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recipe.spices.length > 0 ? (
        <div className="mt-3">
          <Eyebrow>{t('mpSpices')}</Eyebrow>
          <p className="mt-1 text-[13px] text-muted">
            {recipe.spices.map((s) => [s.qty, s.item].filter(Boolean).join(' ')).join(' · ')}
          </p>
        </div>
      ) : null}

      {recipe.note ? (
        <p className="mt-3 border-l-2 border-accent bg-accent/[0.07] px-3 py-2 text-[13px] italic leading-[1.5] text-soft">
          {recipe.note}
        </p>
      ) : null}

      {recipe.steps.length > 0 ? (
        <details className="tf-details mt-3 border-t border-divider pt-3">
          <summary className="tf-press flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold uppercase tracking-[1px] text-muted">
            {t('mpMethod')}
            <Icon name="chevronRight" size={16} className="tf-details-chevron text-faint" />
          </summary>
          <ol className="mt-3 space-y-2">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-[1.55] text-soft">
                <span className="shrink-0 font-display text-[13px] text-accent">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </Card>
  );
}

function MacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): ReactElement {
  return (
    <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-warm px-2.5 py-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-semibold">{Math.round(value)}g</span>
      <span className="text-[10px] uppercase tracking-[0.5px] text-faint">{label}</span>
    </div>
  );
}

function Eyebrow({ children }: { children: string }): ReactElement {
  return <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-faint">{children}</div>;
}
