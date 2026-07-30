'use client';
// Shopping list for a meal plan. Asked for on the 2026-07-01 call, specifically WITH servings.
//
// The interaction that matters: each slot in her plans offers a "pick one" choice between recipes, so
// a list that summed every option would send her shopping for meals she is not cooking. She picks one
// per slot (defaulted to the first), sets how many servings she is making, and gets exactly that.
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { buildShoppingList, shoppingListToText, type Ingredient } from '@/lib/nutrition/shopping';

export type PlanRecipe = { title: string; ingredients?: Ingredient[]; spices?: Ingredient[] };
export type PlanSlot = { name: string; recipes?: PlanRecipe[] };

export function ShoppingList({ slots }: { slots: PlanSlot[] }): ReactElement | null {
  const t = useTranslations('app.shopping');
  // One chosen recipe index per slot; first option by default, which is how the plans are written.
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [servings, setServings] = useState(1);
  const [copied, setCopied] = useState(false);

  const chosen = useMemo(
    () =>
      slots
        .map((s, i) => s.recipes?.[picked[i] ?? 0])
        .filter((r): r is PlanRecipe => Boolean(r)),
    [slots, picked],
  );

  const list = useMemo(() => buildShoppingList(chosen, servings), [chosen, servings]);

  if (!slots.length) return null;

  const copy = async (): Promise<void> => {
    const text = shoppingListToText(list, { groceries: t('groceries'), pantry: t('pantry') });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, http). Silent: the list is still on screen to read.
    }
  };

  return (
    <section className="mt-8">
      <h2 className="tf-display text-[24px]">{t('title')}</h2>
      <p className="mb-4 mt-1 text-[13px] leading-[1.5] text-soft">{t('intro')}</p>

      {/* Servings. The whole reason this was asked for. */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">{t('servings')}</span>
          <span className="inline-flex items-center gap-3">
            <button
              type="button"
              aria-label={t('fewer')}
              onClick={() => setServings((n) => Math.max(1, n - 1))}
              className="tf-press h-9 w-9 rounded-full border border-line text-[18px] leading-none"
            >
              -
            </button>
            <span className="min-w-[2ch] text-center font-display text-[20px]">{servings}</span>
            <button
              type="button"
              aria-label={t('more')}
              onClick={() => setServings((n) => Math.min(12, n + 1))}
              className="tf-press h-9 w-9 rounded-full border border-line text-[18px] leading-none"
            >
              +
            </button>
          </span>
        </div>
      </Card>

      {/* Which option she is actually cooking, per slot. Only shown where there IS a choice. */}
      {slots.some((s) => (s.recipes?.length ?? 0) > 1) ? (
        <div className="mt-4 flex flex-col gap-3">
          {slots.map((slot, i) =>
            (slot.recipes?.length ?? 0) > 1 ? (
              <div key={slot.name + i}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                  {slot.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {slot.recipes?.map((r, ri) => (
                    <button
                      key={r.title + ri}
                      type="button"
                      aria-pressed={(picked[i] ?? 0) === ri}
                      onClick={() => setPicked((p) => ({ ...p, [i]: ri }))}
                      className={[
                        'tf-press rounded-full px-3.5 py-2 text-left text-[12px] leading-tight',
                        (picked[i] ?? 0) === ri
                          ? 'border-[1.5px] border-ink font-semibold text-ink'
                          : 'border border-line text-soft',
                      ].join(' ')}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-5">
        <ListBlock title={t('groceries')} lines={list.ingredients} empty={t('empty')} />
        {list.pantry.length ? (
          <ListBlock title={t('pantry')} lines={list.pantry} hint={t('pantryHint')} empty={t('empty')} />
        ) : null}
      </div>

      <button
        type="button"
        onClick={copy}
        className="tf-press mt-5 w-full border border-line py-3 text-[12px] font-semibold uppercase tracking-[2px]"
      >
        {copied ? t('copied') : t('copy')}
      </button>
    </section>
  );
}

function ListBlock({
  title,
  lines,
  hint,
  empty,
}: {
  title: string;
  lines: { item: string; display: string; approximate: boolean }[];
  hint?: string;
  empty: string;
}): ReactElement {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{title}</div>
      {hint ? <p className="mb-2 text-[12px] text-faint">{hint}</p> : null}
      {lines.length === 0 ? (
        <p className="text-[13px] text-faint">{empty}</p>
      ) : (
        <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-divider bg-divider">
          {lines.map((l) => (
            <div key={l.item} className="flex items-baseline justify-between gap-3 bg-surface px-4 py-2.5">
              <span className="text-[14px]">{l.item}</span>
              {/* tabular-nums so the quantity column lines up down the list */}
              <span className="shrink-0 text-[13px] tabular-nums text-muted">{l.display}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
