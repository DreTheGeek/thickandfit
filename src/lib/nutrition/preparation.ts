/**
 * How a food was PREPARED, read off its name, and whether two names agree about it.
 *
 * WHY THIS EXISTS. A member photographed a KFC plate. gpt-5 read it correctly and returned
 * "fried chicken thigh, cooked, breaded". The app logged her **Chicken, feet, boiled**.
 *
 * Every stage of the resolution pipeline was throwing the preparation away:
 *
 *   1. `photo.ts` lists `fried`, `boiled`, `grilled`, `roasted`, `baked`, `steamed` as STOPWORDS,
 *      stripped before the corpus is searched. That is right for "cooked white rice" and ruinous
 *      for a protein, where the method IS the macro. The search became "chicken".
 *   2. Ties were broken by SHORTEST `search_text`, a proxy for "most generic". The shortest row in
 *      the corpus containing "chicken" is `chicken, feet, boiled`, so that is what she got.
 *   3. A bad local match is still a match, so the USDA fallback (which has the right rows, KFC's
 *      own among them) never ran.
 *   4. Even reaching USDA, the ranker preferred `meat only, cooked, fried` (218 kcal, 10.3g fat)
 *      over `meat and skin and breading` (274 kcal, 18.1g fat), because "meat only" is shorter and
 *      happens to also contain the word "cooked". Skin and breading are the fat.
 *
 * The direction of that error is the whole problem. Fried read as boiled is roughly 200-400 kcal
 * and 12-20g of fat MISSING from her day, which is the July 2026 NIH/NIDDK finding this repo
 * already tracks (~250-345 kcal/meal missed, ~30g of invisible fat). A woman eating at her deficit
 * would be eating over it and would not know why the scale stopped moving.
 *
 * PURE AND DEPENDENCY-FREE so both matchers can share it and it can be tested without a network
 * call or a service-role client. See `.qa-visual/preparation-test.mts`.
 */

/**
 * Fat class, not cooking method, because that is what changes the macros.
 *
 * `added-fat` means fat was put INTO the food during cooking. `dry-heat` means it was not, but the
 * food's own fat is retained. `wet-heat` means it was cooked in water, which renders fat OUT.
 * Grilled and boiled are both "cooked", and treating them as interchangeable is how a plate loses
 * 15g of fat.
 */
export type FatClass = 'added-fat' | 'dry-heat' | 'wet-heat' | 'raw';

/** Whether the name says the fatty parts are on the plate or off it. */
export type Leanness = 'with-fat' | 'lean' | null;

export type Preparation = {
  fatClass: FatClass | null;
  /** Breading or batter, which adds both carbohydrate and a great deal of absorbed oil. */
  breaded: boolean;
  leanness: Leanness;
  /**
   * The row describes a MIX or a powder rather than the finished food.
   *
   * "buttermilk biscuit" resolved to `Biscuits, plain or buttermilk, dry mix` at 428 kcal/100g. That
   * is the flour in the box, not the biscuit on the plate (~340 baked), and no ratio anywhere
   * reconciles them: `cooked_uncooked_ratios` converts a raw INGREDIENT to its cooked weight, and a
   * manufactured mix is not that.
   *
   * Deliberately NOT the same thing as "dry". "White rice, dry" is the row the rice pipeline WANTS,
   * because effectiveGrams converts the photographed cooked grams back to dry using the ratio table.
   * Penalising "dry" would break the food this stopword list was originally written for.
   */
  unprepared: boolean;
};

/**
 * Method words by fat class. Matched on WORD BOUNDARIES and stemmed loosely, because USDA writes
 * "fried" and a model writes "fry"/"frying".
 */
const METHODS: { re: RegExp; fatClass: FatClass }[] = [
  // The lookbehind is for AIR-frying, which adds no fat and belongs to dry heat. Without it the
  // bare `fried` alternative matches inside "air-fried" and the added-fat class wins, because this
  // list is checked first. A member logging air-fried chicken would be charged for oil that was
  // never in the basket.
  { re: /\b(?<!air[- ])(deep[- ]?fried|deep[- ]?fry|pan[- ]?fried|pan[- ]?fry|stir[- ]?fried|fried|frying|sauteed|saut[eé]ed|sauteing|crisp|crispy|tempura|schnitzel|katsu)\b/, fatClass: 'added-fat' },
  { re: /\b(grilled|griddled|broiled|roasted|roast|baked|bake|barbecued|bbq|air[- ]?fried|rotisserie|charred|seared|toasted)\b/, fatClass: 'dry-heat' },
  { re: /\b(boiled|boil|steamed|steam|poached|poach|stewed|stew|braised|simmered|blanched)\b/, fatClass: 'wet-heat' },
  { re: /\b(raw|uncooked|fresh)\b/, fatClass: 'raw' },
];

const BREADED = /\b(breaded|breading|battered|batter|crumbed|panko|floured|dredged|extra[- ]?crispy|original[- ]?recipe|tempura|katsu|schnitzel|nugget|nuggets|tender|tenders|popcorn chicken)\b/;

// "mix" as a word, so "mixed vegetables" and "trail mix" are untouched: only the manufactured
// powder shapes USDA writes as "dry mix", "cake mix", "pudding mix".
const UNPREPARED = /\b(dry mix|mix|powder|powdered|concentrate|dehydrated|unprepared)\b/;

const WITH_FAT = /\b(meat and skin|with skin|skin[- ]?on|with breading|and breading|untrimmed|regular fat|higher fat|whole milk|full[- ]?fat)\b/;
const LEAN = /\b(meat only|skinless|skin removed|skin not eaten|lean only|trimmed|fat trimmed|nonfat|non[- ]?fat|fat[- ]?free|skim|light|reduced fat|low[- ]?fat)\b/;

/**
 * USDA calls a chicken a "broiler" or a "fryer". Those are BIRD TYPES, not cooking methods, and
 * they appear in the canonical description of essentially every generic chicken row:
 *
 *     Chicken, broilers or fryers, thigh, meat and skin, cooked, fried, batter
 *
 * Read naively, "fryers" makes every raw chicken row look deep-fried and "broilers" makes it look
 * grilled, so a boiled chicken row and a fried one would score identically. This repo has already
 * been bitten by the same phrase once: the substring "oil" inside "broiler" was taking the -5
 * penalty meant for cooking oil and pushing the right answer down the ranking (see
 * `penaltyApplies` in usda-match.ts). Strip the phrase before reading methods.
 */
const BIRD_TYPE = /\bbroilers?\s+or\s+fryers?\b/g;

function normalize(name: string): string {
  return name.toLowerCase().replace(BIRD_TYPE, ' ').replace(/[_/]/g, ' ');
}

/** Read the preparation a food name states. Fields are null/false when the name does not say. */
export function readPreparation(name: string): Preparation {
  const n = normalize(name);
  let fatClass: FatClass | null = null;
  for (const m of METHODS) {
    if (m.re.test(n)) {
      fatClass = m.fatClass;
      break; // first match wins, and the list is ordered by how much the class moves the macros
    }
  }
  return {
    fatClass,
    breaded: BREADED.test(n),
    leanness: WITH_FAT.test(n) ? 'with-fat' : LEAN.test(n) ? 'lean' : null,
    unprepared: UNPREPARED.test(n),
  };
}

/**
 * How well a candidate food row agrees with what the model said it saw, in [-1, 1].
 *
 * Negative means the row CONTRADICTS the photo and must not be logged silently. Zero means the row
 * simply does not say, which is common and fine ("buttermilk biscuit" states no method). Positive
 * means it agrees.
 *
 * Deliberately asymmetric on fat. Logging fried food as boiled hides calories a member is eating;
 * logging boiled food as fried invents calories she is not. Both are wrong, but only the first one
 * quietly breaks a deficit, so the wet-heat-when-fried case carries the heaviest penalty in the
 * table below. This is the same asymmetry the scan eval measures as a SIGNED fat bias.
 */
export function preparationAgreement(predicted: Preparation, candidate: Preparation): number {
  let score = 0;

  // A mix is not the food. Disqualifying rather than merely bad, because the numbers are not close
  // and nothing downstream reconciles them: the biscuit mix row is 428 kcal/100g against ~340 for
  // the baked biscuit, and the member photographed a biscuit.
  if (candidate.unprepared && !predicted.unprepared) return -1;

  if (predicted.fatClass && candidate.fatClass) {
    if (predicted.fatClass === candidate.fatClass) score += 0.5;
    else if (predicted.fatClass === 'added-fat' && candidate.fatClass === 'wet-heat') score -= 1;
    else if (predicted.fatClass === 'added-fat') score -= 0.6;
    else if (candidate.fatClass === 'added-fat') score -= 0.6;
    else score -= 0.25; // dry-heat vs wet-heat: real, but a fraction of the fried gap
  }

  if (predicted.breaded && candidate.breaded) score += 0.4;
  // A breaded item resolved to a bare one loses the batter's carbohydrate AND the oil it absorbed,
  // which on fried chicken is most of the difference between 10g of fat and 22g.
  else if (predicted.breaded && !candidate.breaded) score -= 0.4;

  if (predicted.leanness && candidate.leanness) {
    score += predicted.leanness === candidate.leanness ? 0.3 : -0.5;
  } else if (candidate.leanness === 'lean' && (predicted.fatClass === 'added-fat' || predicted.breaded)) {
    // The "meat only" trap, and the single biggest source of under-reported fat in the USDA rows.
    // Nobody eats the meat only off a piece of fried chicken; the skin and the breading are the
    // reason it was fried. A row that strips them is answering a different question.
    score -= 0.6;
  } else if (candidate.leanness === 'with-fat' && (predicted.fatClass === 'added-fat' || predicted.breaded)) {
    score += 0.3;
  }

  return Math.max(-1, Math.min(1, score));
}

/** True when a candidate contradicts the photo badly enough that logging it would be a lie. */
export function contradictsPreparation(predicted: Preparation, candidate: Preparation): boolean {
  return preparationAgreement(predicted, candidate) <= -0.5;
}
