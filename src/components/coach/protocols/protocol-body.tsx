// The protocol itself: her rules, the fasted drink, the one fixed day, and the grocery list.
//
// Every string rendered here comes out of the protocol tables, not out of code. It is Stephanie's
// copy, transcribed verbatim, including her capitalisation, which is how she carries emphasis
// (UNCOOKED, COOKED, NO PROTEIN SHAKES OR BARS OR CHIPS, INNER FILLET, FRESH). Nothing in this file
// reformats, sentence-cases or "tidies" it, and no markup is parsed, because none is stored.
//
// The `locale` prop previews EN or ES. Falling back to English per-string is deliberate: a partly
// translated protocol must still render a complete day rather than a page with holes in it.
import type { ReactElement } from 'react';
import { COACH_COPY } from '@/lib/protocols/copy';
import { pickLocale } from '@/lib/protocols/types';
import type {
  ProtocolDrinkItem,
  ProtocolGroceryGroup,
  ProtocolLocale,
  ProtocolMeal,
  ProtocolRule,
} from '@/lib/protocols/types';

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="tf-display text-[18px] text-ink">{title}</h2>
      {note != null && <p className="mt-1 text-[12px] leading-relaxed text-faint">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProtocolRules({
  rules,
  locale,
}: {
  rules: readonly ProtocolRule[];
  locale: ProtocolLocale;
}): ReactElement {
  return (
    <Card title={COACH_COPY.rulesTitle} note={COACH_COPY.rulesNote}>
      <ol className="flex flex-col">
        {rules.map((r) => (
          <li
            key={r.sequence}
            className="flex gap-3 border-b border-divider py-2.5 text-[14px] leading-relaxed last:border-0"
          >
            <span className="w-5 shrink-0 text-right font-display text-[14px] text-faint">{r.sequence}</span>
            <span className="min-w-0 text-ink">{pickLocale(r.textEn, r.textEs, locale)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ProtocolDrink({
  title,
  note,
  items,
  locale,
}: {
  title: string;
  note: string | null;
  items: readonly ProtocolDrinkItem[];
  locale: ProtocolLocale;
}): ReactElement {
  return (
    <Card title={title} note={note ?? COACH_COPY.drinkNote}>
      <ul className="flex flex-col">
        {items.map((d) => (
          <li
            key={d.sequence}
            className="flex items-baseline justify-between gap-4 border-b border-divider py-2.5 text-[14px] last:border-0"
          >
            <span className="min-w-0 text-ink">{pickLocale(d.itemEn, d.itemEs, locale)}</span>
            <span className="shrink-0 font-display text-[14px] text-muted">
              {pickLocale(d.amountEn, d.amountEs, locale)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProtocolDay({
  meals,
  locale,
}: {
  meals: readonly ProtocolMeal[];
  locale: ProtocolLocale;
}): ReactElement {
  return (
    <Card title={COACH_COPY.dayTitle} note={COACH_COPY.dayNote}>
      <div className="flex flex-col gap-3">
        {meals.map((m) => (
          <div key={m.id} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-[16px] text-ink">
                <span className="mr-2 text-faint">{m.sequence}</span>
                {pickLocale(m.nameEn, m.nameEs, locale)}
              </h3>
              <div className="flex shrink-0 flex-wrap gap-3 text-[12px] text-muted">
                <span className="font-display text-[13px] text-ink">
                  {m.kcal} {COACH_COPY.kcal}
                </span>
                <span>
                  {m.proteinG}g {COACH_COPY.protein}
                </span>
                <span>
                  {m.carbG}g {COACH_COPY.carbs}
                </span>
                <span>
                  {m.fatG}g {COACH_COPY.fat}
                </span>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {m.items.map((i) => (
                <li key={i.sequence} className="flex gap-2 text-[14px] leading-relaxed text-ink">
                  <span aria-hidden className="text-faint">
                    &middot;
                  </span>
                  <span className="min-w-0">{pickLocale(i.textEn, i.textEs, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProtocolGrocery({
  groups,
  locale,
}: {
  groups: readonly ProtocolGroceryGroup[];
  locale: ProtocolLocale;
}): ReactElement {
  return (
    <Card title={COACH_COPY.groceryTitle} note={COACH_COPY.groceryNote}>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.categoryEn} className="rounded-xl border border-line p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
              {pickLocale(g.categoryEn, g.categoryEs, locale)}
            </div>
            <ul className="flex flex-col">
              {g.items.map((i) => (
                <li
                  key={i.sequence}
                  className="flex items-baseline justify-between gap-3 border-b border-divider py-2 text-[13px] last:border-0"
                >
                  <span className="min-w-0 text-ink">{pickLocale(i.itemEn, i.itemEs, locale)}</span>
                  {i.quantityEn != null && (
                    <span className="shrink-0 text-right text-[12px] text-muted">
                      {pickLocale(i.quantityEn, i.quantityEs, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
