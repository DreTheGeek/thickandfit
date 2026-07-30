// Shopping list from a meal plan. PURE: no DB, no clock, no server-only, so it is unit-testable and
// the plan screen can call it directly.
//
// Asked for on the 2026-07-01 call ("shopping-list servings"). The scaling is the whole point: her
// plans are written per-serving, and a member cooking for a household needs the grocery amounts, not
// the plate amounts.
//
// Two decisions that shape the output:
//
// 1. A slot offers SEVERAL recipes (Breakfast has two options). Summing them all would tell her to
//    buy ingredients for meals she is not cooking, so the caller passes only the recipes she picked.
//
// 2. Quantities are free text written for a human: "150g", "1-2 tsp", "1/2-1 handful", "2-3 pc".
//    Anything we cannot parse is PASSED THROUGH as its own line rather than guessed at or dropped.
//    A shopping list that silently loses an ingredient is worse than one with an odd-looking row.
//    For ranges we take the UPPER bound, because you shop for the most you might use.

export type Ingredient = { qty: string; item: string };

export type ShoppingLine = {
  item: string;
  /** Combined display, e.g. "410 g" or "1-2 tsp, 3 pc" when units could not be merged. */
  display: string;
  /** True when at least one source quantity could not be parsed and is shown verbatim. */
  approximate: boolean;
};

export type ShoppingList = {
  /** Real groceries: the things she has to buy. */
  ingredients: ShoppingLine[];
  /** Spices, oils and staples, kept separate because most kitchens already have them. */
  pantry: ShoppingLine[];
};

type Parsed = { amount: number; unit: string } | null;

/** "1/2" -> 0.5, "3" -> 3. Returns NaN for anything else. */
function num(token: string): number {
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  return Number(token);
}

/**
 * Parse a human quantity into an amount + unit.
 * Ranges resolve to their UPPER bound: "1-2 tsp" -> 2 tsp, because under-buying is the failure that
 * ruins dinner and over-buying by a teaspoon costs nothing.
 */
export function parseQty(qty: string): Parsed {
  const raw = (qty ?? '').trim().toLowerCase();
  if (!raw) return null;

  // "1-2 tsp" / "1/2-1 handful" / "30-60 ml": take the number after the dash.
  const range = raw.match(/^([\d/\s]+)\s*[-–]\s*([\d/\s]+)\s*([a-z]*)$/);
  if (range) {
    const upper = num(range[2].trim());
    if (Number.isFinite(upper)) return { amount: upper, unit: (range[3] || 'x').trim() };
    return null;
  }

  const single = raw.match(/^([\d/\s.]+)\s*([a-z]*)$/);
  if (single) {
    const amount = num(single[1].trim());
    if (Number.isFinite(amount)) return { amount, unit: (single[2] || 'x').trim() };
  }
  return null;
}

/** Round to something a person would write: whole numbers for grams, one decimal for small units. */
function tidy(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

// Units that mean "this is a pantry staple", used to split the list. Matching on the UNIT rather than
// the item name keeps it language-agnostic: a spice is measured in tsp/tbsp, groceries in g/ml.
const PANTRY_UNITS = new Set(['tsp', 'tbsp', 'pinch', 'handful', 'sec', 'x']);

function normalizeItem(item: string): string {
  return item.trim().toLowerCase();
}

/**
 * Build the list.
 *
 * @param recipes  the recipes she actually chose to cook
 * @param servings how many servings of each (1 = the plan as written)
 */
export function buildShoppingList(
  recipes: { ingredients?: Ingredient[]; spices?: Ingredient[] }[],
  servings = 1,
): ShoppingList {
  const mult = Math.max(1, Math.floor(servings));

  // item -> unit -> amount, plus any unparseable strings kept verbatim.
  const buckets = new Map<
    string,
    { label: string; byUnit: Map<string, number>; verbatim: string[]; pantryHint: boolean }
  >();

  const add = (ing: Ingredient, pantryHint: boolean): void => {
    if (!ing?.item) return;
    const key = normalizeItem(ing.item);
    let b = buckets.get(key);
    if (!b) {
      b = { label: ing.item.trim(), byUnit: new Map(), verbatim: [], pantryHint };
      buckets.set(key, b);
    }
    b.pantryHint = b.pantryHint || pantryHint;

    const parsed = parseQty(ing.qty ?? '');
    if (!parsed) {
      // Unparseable: repeat it once per serving so the total is still honest.
      for (let i = 0; i < mult; i++) b.verbatim.push((ing.qty ?? '').trim() || '?');
      return;
    }
    b.byUnit.set(parsed.unit, (b.byUnit.get(parsed.unit) ?? 0) + parsed.amount * mult);
  };

  for (const r of recipes) {
    for (const i of r.ingredients ?? []) add(i, false);
    for (const s of r.spices ?? []) add(s, true);
  }

  const ingredients: ShoppingLine[] = [];
  const pantry: ShoppingLine[] = [];

  for (const b of buckets.values()) {
    const parts: string[] = [];
    for (const [unit, amount] of b.byUnit) {
      parts.push(unit === 'x' ? tidy(amount) : `${tidy(amount)} ${unit}`);
    }
    // Collapse duplicate verbatim strings ("1 pinch x2") rather than repeating the row.
    const counts = new Map<string, number>();
    for (const v of b.verbatim) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const [v, n] of counts) parts.push(n > 1 ? `${v} x${n}` : v);

    const line: ShoppingLine = {
      item: b.label,
      display: parts.join(', ') || '?',
      approximate: b.verbatim.length > 0,
    };

    // Pantry if it came from the spices list, or if every unit it uses is a pantry unit.
    const allPantryUnits =
      b.byUnit.size > 0 && [...b.byUnit.keys()].every((u) => PANTRY_UNITS.has(u));
    (b.pantryHint || allPantryUnits ? pantry : ingredients).push(line);
  }

  const byName = (a: ShoppingLine, b: ShoppingLine): number => a.item.localeCompare(b.item);
  return { ingredients: ingredients.sort(byName), pantry: pantry.sort(byName) };
}

/** Plain-text export, for the share sheet or a paste into Notes. */
export function shoppingListToText(list: ShoppingList, headings: { groceries: string; pantry: string }): string {
  const section = (title: string, lines: ShoppingLine[]): string =>
    lines.length ? `${title}\n${lines.map((l) => `- ${l.item}: ${l.display}`).join('\n')}` : '';
  return [section(headings.groceries, list.ingredients), section(headings.pantry, list.pantry)]
    .filter(Boolean)
    .join('\n\n');
}
