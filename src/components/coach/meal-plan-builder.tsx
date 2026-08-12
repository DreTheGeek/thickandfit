'use client';

// The meal-plan BUILDER (call 2026-07-02: "start the meal plan builder"). A coach authors a full
// structured plan the client renders: kcal-budgeted slots -> recipe OPTIONS -> raw-weight ingredients,
// per-recipe macros, a tip, and steps. Controlled top-down: each level owns its immutable onChange, so
// the parent never threads deep indices. Saves via saveStructuredPlanAction. See meal-plan-method.
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveStructuredPlanAction } from '@/lib/coach/meal-plan-actions';
import { blankRecipe, blankSlot, type PlanIngredient, type PlanRecipe, type PlanSlot } from '@/lib/coach/meal-plan-structured';
import { Icon } from '@/components/ui/icons';
import { MacroPlanner } from '@/components/coach/macro-planner';
import { PlanPreview } from '@/components/coach/plan-preview';
import type { SlotTotals } from '@/lib/meal-plans/macros';

export type BuilderInitial = {
  planId: string | null;
  name: string;
  goal: string;
  calorieTarget: number | null;
  macros: { proteinG: number; carbG: number; fatG: number };
  notes: string;
  slots: PlanSlot[];
};

// Replace item i in a list immutably.
function put<T>(list: T[], i: number, next: T): T[] {
  return list.map((x, j) => (j === i ? next : x));
}
function omit<T>(list: T[], i: number): T[] {
  return list.filter((_, j) => j !== i);
}

const inputCls =
  'w-full rounded-xl border border-line bg-transparent px-3 py-2 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink';

function Field({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-faint">{label}</span>
      {children}
    </label>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
}): ReactElement {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value.trim();
        onChange(v === '' ? null : Math.max(0, Math.round(Number(v))));
      }}
      className={inputCls}
    />
  );
}

function IconBtn({ icon, label, onClick, danger = false }: { icon: 'plus' | 'x'; label: string; onClick: () => void; danger?: boolean }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'tf-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-muted hover:bg-warm',
      ].join(' ')}
    >
      <Icon name={icon} size={13} /> {label}
    </button>
  );
}

// A qty/item pair list (ingredients or spices).
function IngredientRows({
  rows,
  onChange,
  addLabel,
  qtyPh,
  itemPh,
}: {
  rows: PlanIngredient[];
  onChange: (rows: PlanIngredient[]) => void;
  addLabel: string;
  qtyPh: string;
  itemPh: string;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={r.qty}
            placeholder={qtyPh}
            onChange={(e) => onChange(put(rows, i, { ...r, qty: e.target.value }))}
            className={`${inputCls} w-24 shrink-0`}
          />
          <input
            value={r.item}
            placeholder={itemPh}
            onChange={(e) => onChange(put(rows, i, { ...r, item: e.target.value }))}
            className={inputCls}
          />
          <button
            type="button"
            aria-label="remove"
            onClick={() => onChange(omit(rows, i))}
            className="tf-press shrink-0 rounded-full p-1.5 text-faint hover:bg-warm hover:text-red-600"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <IconBtn icon="plus" label={addLabel} onClick={() => onChange([...rows, { qty: '', item: '' }])} />
    </div>
  );
}

function StepRows({
  steps,
  onChange,
  addLabel,
  stepLabel,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
  addLabel: string;
  stepLabel: string;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-2.5 w-5 shrink-0 text-center font-display text-[13px] text-accent">{i + 1}</span>
          <textarea
            value={s}
            rows={2}
            placeholder={`${stepLabel} ${i + 1}`}
            onChange={(e) => onChange(put(steps, i, e.target.value))}
            className={`${inputCls} resize-none`}
          />
          <button
            type="button"
            aria-label="remove"
            onClick={() => onChange(omit(steps, i))}
            className="tf-press mt-1 shrink-0 rounded-full p-1.5 text-faint hover:bg-warm hover:text-red-600"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <IconBtn icon="plus" label={addLabel} onClick={() => onChange([...steps, ''])} />
    </div>
  );
}

function RecipeEditor({
  recipe,
  index,
  onChange,
  onRemove,
  t,
}: {
  recipe: PlanRecipe;
  index: number;
  onChange: (r: PlanRecipe) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  const m = recipe.macros ?? { proteinG: 0, carbG: 0, fatG: 0 };
  const setM = (patch: Partial<typeof m>): void => onChange({ ...recipe, macros: { ...m, ...patch } });

  return (
    <div className="rounded-xl border border-divider bg-warm/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
          {t('mbRecipe')} {index + 1}
        </span>
        <IconBtn icon="x" label={t('mbRemoveRecipe')} onClick={onRemove} danger />
      </div>

      <Field label={t('mbRecipeTitle')}>
        <input
          value={recipe.title}
          placeholder={t('mbRecipeTitlePh')}
          onChange={(e) => onChange({ ...recipe, title: e.target.value })}
          className={inputCls}
        />
      </Field>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label={t('mbPrep')}><NumInput value={recipe.prepMin} onChange={(n) => onChange({ ...recipe, prepMin: n })} /></Field>
        <Field label={t('mbCook')}><NumInput value={recipe.cookMin} onChange={(n) => onChange({ ...recipe, cookMin: n })} /></Field>
        <Field label={t('mbKcal')}><NumInput value={recipe.kcal} onChange={(n) => onChange({ ...recipe, kcal: n })} /></Field>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label={t('mbProtein')}><NumInput value={m.proteinG} onChange={(n) => setM({ proteinG: n ?? 0 })} /></Field>
        <Field label={t('mbCarbs')}><NumInput value={m.carbG} onChange={(n) => setM({ carbG: n ?? 0 })} /></Field>
        <Field label={t('mbFat')}><NumInput value={m.fatG} onChange={(n) => setM({ fatG: n ?? 0 })} /></Field>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('mbIngredients')}</span>
        <IngredientRows
          rows={recipe.ingredients}
          onChange={(rows) => onChange({ ...recipe, ingredients: rows })}
          addLabel={t('mbAddIngredient')}
          qtyPh={t('mbQtyPh')}
          itemPh={t('mbItemPh')}
        />
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('mbSpices')}</span>
        <IngredientRows
          rows={recipe.spices}
          onChange={(rows) => onChange({ ...recipe, spices: rows })}
          addLabel={t('mbAddSpice')}
          qtyPh={t('mbQtyPh')}
          itemPh={t('mbItemPh')}
        />
      </div>

      <div className="mt-4">
        <Field label={t('mbTip')}>
          <textarea
            value={recipe.note ?? ''}
            rows={2}
            placeholder={t('mbTipPh')}
            onChange={(e) => onChange({ ...recipe, note: e.target.value || null })}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('mbMethod')}</span>
        <StepRows
          steps={recipe.steps}
          onChange={(steps) => onChange({ ...recipe, steps })}
          addLabel={t('mbAddStep')}
          stepLabel={t('mbStep')}
        />
      </div>
    </div>
  );
}

function SlotEditor({
  slot,
  onChange,
  onRemove,
  t,
}: {
  slot: PlanSlot;
  onChange: (s: PlanSlot) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-end gap-3">
        <div className="flex-1">
          <Field label={t('mbSlotName')}>
            <input
              value={slot.name}
              placeholder={t('mbSlotNamePh')}
              onChange={(e) => onChange({ ...slot, name: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="w-28">
          <Field label={t('mbSlotKcal')}>
            <NumInput value={slot.kcalTarget} onChange={(n) => onChange({ ...slot, kcalTarget: n })} />
          </Field>
        </div>
        <button
          type="button"
          aria-label={t('mbRemoveSlot')}
          onClick={onRemove}
          className="tf-press mb-1 shrink-0 rounded-full p-2 text-faint hover:bg-warm hover:text-red-600"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="space-y-3">
        {slot.recipes.map((r, ri) => (
          <RecipeEditor
            key={ri}
            recipe={r}
            index={ri}
            t={t}
            onChange={(next) => onChange({ ...slot, recipes: put(slot.recipes, ri, next) })}
            onRemove={() => onChange({ ...slot, recipes: omit(slot.recipes, ri) })}
          />
        ))}
      </div>
      <div className="mt-3">
        <IconBtn icon="plus" label={t('mbAddRecipe')} onClick={() => onChange({ ...slot, recipes: [...slot.recipes, blankRecipe()] })} />
      </div>
    </div>
  );
}

export type ForClient = {
  bmr: number | null;
  tdee: number | null;
  pal: number | null;
  allergies: string | null;
  goal: string | null;
} | null;

export function MealPlanBuilder({ initial, forClient = null }: { initial: BuilderInitial; forClient?: ForClient }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [plan, setPlan] = useState<BuilderInitial>(initial);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [pending, start] = useTransition();

  const m = plan.macros;
  const setM = (patch: Partial<typeof m>): void => setPlan({ ...plan, macros: { ...m, ...patch } });

  /**
   * What the meals she has actually written add up to.
   *
   * A recipe's calories are taken as ENTERED, not recomputed from its macros. Her own protocol is
   * 134/151/39 at a stated 1,555 kcal where 4/4/9 gives 1,491, because both figures come off food
   * labels. Deriving one from the other would report her real plan as wrong. Only when a recipe has
   * no calories at all does this fall back to Atwater, which is a genuine estimate rather than an
   * override of something she typed.
   */
  const slotTotals: SlotTotals[] = useMemo(
    () =>
      plan.slots.map((slot) =>
        slot.recipes.reduce<SlotTotals>(
          (acc, r) => ({
            proteinG: acc.proteinG + (r.macros?.proteinG ?? 0),
            carbG: acc.carbG + (r.macros?.carbG ?? 0),
            fatG: acc.fatG + (r.macros?.fatG ?? 0),
            kcal:
              acc.kcal +
              (r.kcal ??
                (r.macros ? r.macros.proteinG * 4 + r.macros.carbG * 4 + r.macros.fatG * 9 : 0)),
          }),
          { proteinG: 0, carbG: 0, fatG: 0, kcal: 0 },
        ),
      ),
    [plan.slots],
  );

  function save(): void {
    setStatus('idle');
    start(async () => {
      const res = await saveStructuredPlanAction({
        planId: plan.planId,
        name: plan.name.trim() || t('mbUntitled'),
        goal: plan.goal.trim() || null,
        calorieTarget: plan.calorieTarget,
        macros: plan.macros,
        notes: plan.notes.trim() || null,
        slots: plan.slots,
      });
      if (res.ok && res.planId) {
        setStatus('ok');
        router.push(`/coach/tool/meal-plans/${res.planId}`);
        router.refresh();
      } else {
        setStatus('error');
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Plan meta */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Field label={t('mbName')}>
          <input value={plan.name} placeholder={t('mbNamePh')} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className={inputCls} />
        </Field>
        <div className="mt-3">
          <Field label={t('mbGoal')}>
            <input value={plan.goal} placeholder={t('mbGoalPh')} onChange={(e) => setPlan({ ...plan, goal: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t('mbCalories')}><NumInput value={plan.calorieTarget} onChange={(n) => setPlan({ ...plan, calorieTarget: n })} /></Field>
          <Field label={t('mbProtein')}><NumInput value={m.proteinG} onChange={(n) => setM({ proteinG: n ?? 0 })} /></Field>
          <Field label={t('mbCarbs')}><NumInput value={m.carbG} onChange={(n) => setM({ carbG: n ?? 0 })} /></Field>
          <Field label={t('mbFat')}><NumInput value={m.fatG} onChange={(n) => setM({ fatG: n ?? 0 })} /></Field>
        </div>
        <div className="mt-3">
          <Field label={t('mbNotes')}>
            <textarea
              value={plan.notes}
              rows={2}
              placeholder={t('mbNotesPh')}
              onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <p className="mt-1 text-[12px] text-faint">{t('mbNotesHint')}</p>
        </div>
      </div>

      {/* Planning layer: splits, tolerance, and whether the meals below match the header above. */}
      <MacroPlanner
        calories={plan.calorieTarget}
        macros={plan.macros}
        slotTotals={slotTotals}
        onApply={(next) => setPlan({ ...plan, calorieTarget: next.calories, macros: next.macros })}
        slotBudgets={plan.slots.map((s) => s.kcalTarget)}
        slotNames={plan.slots.map((s) => s.name)}
        bmr={forClient?.bmr ?? null}
        tdee={forClient?.tdee ?? null}
        pal={forClient?.pal ?? null}
        allergies={forClient?.allergies ?? null}
        // The stored vocabulary is 'deficit' (225) and 'maintenance' (17), NOT lose/maintain/gain.
        // Mapping by guesswork sent all 17 maintenance clients into a 20% cut, which is the kind of
        // error that reads as a working feature. Anything unrecognised stays null rather than
        // defaulting, so an unknown goal shows no recommendation instead of a confident wrong one.
        goal={
          forClient?.goal === 'maintenance' || forClient?.goal === 'maintain'
            ? 'maintain'
            : forClient?.goal === 'surplus' || forClient?.goal === 'gain'
              ? 'gain'
              : forClient?.goal === 'deficit' || forClient?.goal === 'lose'
                ? 'lose'
                : null
        }
      />

      {/* Slots */}
      {plan.slots.map((s, si) => (
        <SlotEditor
          key={si}
          slot={s}
          t={t}
          onChange={(next) => setPlan({ ...plan, slots: put(plan.slots, si, next) })}
          onRemove={() => setPlan({ ...plan, slots: omit(plan.slots, si) })}
        />
      ))}

      <button
        type="button"
        onClick={() => setPlan({ ...plan, slots: [...plan.slots, blankSlot()] })}
        className="tf-press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-4 text-[13px] font-semibold text-muted hover:border-ink hover:text-ink"
      >
        <Icon name="plus" size={16} /> {t('mbAddSlot')}
      </button>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-end gap-3 border-t border-line bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {status === 'error' && <span className="text-[12px] text-alert-ink">{t('mbError')}</span>}
        <PlanPreview name={plan.name} slots={plan.slots} goal={plan.goal || null} calorieTarget={plan.calorieTarget} macros={plan.macros} />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="tf-press rounded-full bg-ink px-6 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          {pending ? t('mbSaving') : t('mbSave')}
        </button>
      </div>
    </div>
  );
}
