// Shared types for protocols (the fixed 2-week onboarding template) and their assignments.
//
// Importable from client components: no server-only imports live in this file. The pure helpers at
// the bottom (sumMeals, groupGrocery, pickLocale, endsOnFor, dueState) are deliberately here rather
// than in the server module, so the coach UI and the server read agree on one implementation.

export type ProtocolLocale = 'en' | 'es';

/**
 * Whether the Spanish copy may be shown to a member.
 *
 * The protocol is Stephanie's intellectual property and her voice. A translation is a DRAFT until she
 * says otherwise, so this is a gate, not a label: a member-facing reader must serve Spanish only at
 * 'approved'. The coach console shows the draft regardless, because reviewing it is how it becomes
 * approved.
 */
export type ProtocolEsStatus = 'missing' | 'draft' | 'approved';

export type ProtocolAssignmentStatus = 'active' | 'completed' | 'cancelled';

export type ProtocolRule = {
  sequence: number;
  textEn: string;
  textEs: string | null;
};

export type ProtocolDrinkItem = {
  sequence: number;
  itemEn: string;
  itemEs: string | null;
  amountEn: string;
  amountEs: string | null;
};

export type ProtocolMealItem = {
  sequence: number;
  textEn: string;
  textEs: string | null;
};

export type ProtocolMeal = {
  id: string;
  sequence: number;
  nameEn: string;
  nameEs: string | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  items: ProtocolMealItem[];
};

export type ProtocolGroceryItem = {
  sequence: number;
  itemEn: string;
  itemEs: string | null;
  quantityEn: string | null;
  quantityEs: string | null;
};

export type ProtocolGroceryGroup = {
  categoryEn: string;
  categoryEs: string | null;
  items: ProtocolGroceryItem[];
};

/** Macro figures summed from the meals. Derived, never stored. */
export type MacroTotals = {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
};

/**
 * The coach's OWN stated daily target, exactly as she wrote it.
 *
 * kcal is a string because she wrote "<1600": the "<" is an instruction to the client, not a rounding
 * artefact, and an int would delete it. This is never recomputed from the meals, and the sum never
 * replaces it. Both are shown.
 */
export type StatedTotals = {
  kcalText: string;
  proteinG: number;
  carbG: number;
  fatG: number;
};

export type ProtocolSummary = {
  id: string;
  slug: string;
  nameEn: string;
  nameEs: string | null;
  purposeEn: string;
  purposeEs: string | null;
  durationDays: number;
  stated: StatedTotals;
  esStatus: ProtocolEsStatus;
  isPublished: boolean;
  ruleCount: number;
  mealCount: number;
  /** Summed from the meals. Sits NEXT TO `stated`, never in place of it. */
  summed: MacroTotals;
  activeAssignments: number;
  planDueCount: number;
};

export type ProtocolDetail = ProtocolSummary & {
  fastedDrinkTitleEn: string | null;
  fastedDrinkTitleEs: string | null;
  fastedDrinkNoteEn: string | null;
  fastedDrinkNoteEs: string | null;
  rules: ProtocolRule[];
  drink: ProtocolDrinkItem[];
  meals: ProtocolMeal[];
  grocery: ProtocolGroceryGroup[];
};

export type ProtocolAssignmentRow = {
  id: string;
  protocolId: string;
  protocolName: string;
  contactId: string;
  contactName: string;
  profileId: string | null;
  locale: ProtocolLocale;
  sentOn: string;
  endsOn: string;
  status: ProtocolAssignmentStatus;
  completedOn: string | null;
  planDeliveredOn: string | null;
  notes: string | null;
  /** Days left, inclusive of today. Negative once the window has closed. */
  daysRemaining: number;
  /** The window has closed and no personalised plan has been recorded. This is the whole point. */
  isPlanDue: boolean;
};

export type ProtocolClientOption = {
  contactId: string;
  name: string;
  language: ProtocolLocale | null;
  profileId: string | null;
};

// -------------------------------------------------------------------------------------------------
// Pure helpers. Shared by the server read and the coach UI so the two can never disagree.
// -------------------------------------------------------------------------------------------------

/** Sum the day's meals. Derived on every read; nothing writes this back to the protocol row. */
export function sumMeals(meals: readonly ProtocolMeal[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteinG: acc.proteinG + m.proteinG,
      carbG: acc.carbG + m.carbG,
      fatG: acc.fatG + m.fatG,
    }),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );
}

/**
 * The Spanish string when there is one, else the English.
 *
 * Falling back to English is correct here: a half-translated protocol must still render a complete
 * day. It is the caller's job to decide whether Spanish is allowed at all (see ProtocolEsStatus).
 */
export function pickLocale(en: string, es: string | null, locale: ProtocolLocale): string {
  if (locale === 'es' && es !== null && es.trim() !== '') return es;
  return en;
}

/** Group the flat grocery rows into consecutive category runs, preserving `sequence` order. */
export function groupGrocery(
  rows: readonly (ProtocolGroceryItem & { categoryEn: string; categoryEs: string | null })[],
): ProtocolGroceryGroup[] {
  const groups: ProtocolGroceryGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.categoryEn === row.categoryEn) {
      last.items.push(row);
      continue;
    }
    groups.push({ categoryEn: row.categoryEn, categoryEs: row.categoryEs, items: [row] });
  }
  return groups;
}

/** Parse a YYYY-MM-DD calendar date into a UTC-noon instant, which is DST-proof for day arithmetic. */
function calendarDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number(n));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The last day of the protocol, INCLUSIVE of the send date.
 *
 * A 14-day reset sent on the 9th runs the 9th through the 22nd, and step two (the personalised meal
 * plan) is due on the 23rd. Off-by-one here is a client sitting an extra day on a protocol she was
 * told was two weeks, so it lives in one function that both the server action and the UI call.
 */
export function endsOnFor(sentOnIso: string, durationDays: number): string {
  const d = calendarDate(sentOnIso);
  d.setUTCDate(d.getUTCDate() + Math.max(1, durationDays) - 1);
  return toIso(d);
}

/** Whole days from `fromIso` to `toIso`. Positive when `toIso` is later. */
export function daysBetween(fromIso: string, toIso2: string): number {
  const ms = calendarDate(toIso2).getTime() - calendarDate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}
