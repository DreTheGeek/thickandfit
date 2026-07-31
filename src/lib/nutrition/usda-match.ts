// Pure USDA candidate-matching rules. No DB, no network, no `@/` imports, so this is unit-testable
// on its own (see .qa-visual/usda-brand-guard-test.mjs) and safe to import from anywhere.
//
// Split out of external-foods.ts deliberately: the two rules below decide whether a member gets the
// right restaurant's macros or a different restaurant's, and that decision deserves a test that runs
// without a network round trip or a service-role client.

export type UsdaCandidate = {
  description?: string;
  /** Present on USDA Branded rows. Absent on Foundation / SR Legacy. */
  brandOwner?: string | null;
  brandName?: string | null;
};

/**
 * The brand a USDA row belongs to, or null for a generic food.
 *
 * Two shapes to read. Branded rows carry brandOwner/brandName as fields. SR Legacy restaurant rows
 * have neither and put the chain in the description before the first comma, in caps:
 * "TACO BELL, BURRITO SUPREME with chicken". The shouting test is what keeps a generic row like
 * "Chicken, broiler or fryers, breast" from having its first segment read as a brand, which would
 * make the guard below reject the entire generic corpus.
 *
 * MAJORITY uppercase, not entirely uppercase: USDA writes "McDONALD'S" with a lowercase c, and a
 * strict check silently let every Mc-brand through as generic. Caught by the unit test, not by
 * reading the API docs. Real ratios: "McDONALD'S" 8/9, "TACO BELL" 8/8, "Chicken" 1/7, "Rice" 1/4,
 * so the threshold has a wide margin on both sides.
 */
const BRAND_UPPER_RATIO = 0.6;

export function usdaBrandOf(f: UsdaCandidate): string | null {
  const field = (f.brandOwner ?? f.brandName ?? '').trim();
  if (field) return field.toLowerCase();
  const desc = (f.description ?? '').trim();
  const head = desc.split(',')[0] ?? '';
  const letters = head.replace(/[^A-Za-z]/g, '');
  if (head.length < 3 || letters.length < 3) return null;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (upper / letters.length >= BRAND_UPPER_RATIO) return head.toLowerCase();
  return null;
}

/**
 * Does the query name a brand that this candidate contradicts?
 *
 * THE BUG THIS EXISTS TO KILL, measured against the live USDA API on 2026-07-31:
 *   query "Chipotle chicken burrito bowl" -> matched "TACO BELL, BURRITO SUPREME with chicken"
 * The scorer counted generic word overlap ("chicken" +2, "burrito" +2) and had no concept of a
 * brand, so a member logging Chipotle silently got Taco Bell's macros. A confidently wrong number is
 * worse than no answer here: the member cannot tell it is wrong, and the entire product is trust in
 * these numbers.
 *
 * Rule: if the candidate belongs to a brand and no word of that brand appears in the query, reject.
 * Fails closed in BOTH directions, so a generic query never silently resolves to a branded row
 * either, which is the same failure wearing different clothes.
 */
export function brandConflicts(query: string, f: UsdaCandidate): boolean {
  const brand = usdaBrandOf(f);
  if (!brand) return false; // generic food: nothing to contradict
  const ql = query.toLowerCase();
  const brandWords = brand.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (brandWords.length === 0) return false;
  return !brandWords.some((w) => ql.includes(w));
}

/**
 * Does an off-target penalty word actually appear in the description, as a WORD?
 *
 * The penalty list existed to stop "grilled salmon" resolving to "Fish oil, salmon", and it was
 * applied with a plain substring test. That silently wrecked the most-logged food in a fitness app:
 *
 *   "Chicken, br(oil)er or fryers, breast, skinless, boneless, meat only, cooked, grilled"
 *
 * USDA writes nearly every chicken row that way, so "oil" matched inside "broiler" and every correct
 * chicken entry took the -5 intended for cooking oil. Measured against the live API on 2026-07-31,
 * that pushed the right answer from 5.59 to 0.61 and handed the query to "Lunchmeat, chicken breast,
 * sliced" at 3.84. Same trap waits in "boiled" and "spoiled".
 *
 * Word-boundary matching keeps the original intent and drops the collateral damage.
 */
export function penaltyApplies(description: string, penaltyWord: string): boolean {
  const w = penaltyWord.trim().toLowerCase();
  if (!w) return false;
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(description);
}

/**
 * Reject rows whose macros cannot be true per 100g.
 *
 * Two jobs at once. (1) USDA Branded is partly submitted by manufacturers and carries real garbage.
 * (2) It guards a unit assumption this code cannot verify at runtime: nutrient 208 is read as
 * kcal-per-100g, correct for Foundation and SR Legacy, and if a dataset ever returned a per-SERVING
 * figure the macros would be silently wrong by multiples. Reconciling grams against calories at
 * 4/4/9 catches that whatever the cause, which is why the gate is framed as arithmetic rather than
 * as a per-dataset special case.
 *
 * Tolerance is deliberately loose (35%): fiber, sugar alcohols, and label rounding all move the sum
 * legitimately. This is a garbage filter, not a nutrition audit.
 */
export function isPlausiblePer100g(kcal: number, proteinG: number, carbG: number, fatG: number): boolean {
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 900) return false; // pure fat is ~884
  if (proteinG < 0 || carbG < 0 || fatG < 0) return false;
  if (proteinG > 100 || carbG > 100 || fatG > 100) return false;
  if (proteinG + carbG + fatG > 105) return false; // cannot exceed the 100g itself
  const implied = proteinG * 4 + carbG * 4 + fatG * 9;
  if (kcal < 20 && implied < 20) return true; // near-zero foods: the ratio test is meaningless
  const ref = Math.max(kcal, implied);
  if (ref <= 0) return false;
  return Math.abs(kcal - implied) / ref <= 0.35;
}
