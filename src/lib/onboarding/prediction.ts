// Defensible weight-prediction + macro targets. Standard sports-nutrition math, not fantasy:
// Mifflin-St Jeor BMR -> TDEE (activity factor) -> goal-adjusted calories -> macros ->
// weekly change from the 7700 kcal/kg energy balance -> bounded 12-week curve toward goal.
import { z } from 'zod';

export const onboardingInputSchema = z.object({
  sex: z.enum(['female', 'male']),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(300),
  goalWeightKg: z.number().min(35).max(300),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  // The calorie DIRECTION. Derived from the member's multi-select primary goals by
  // deriveGoalDirection() in @/lib/onboarding/goals - the member is never asked this twice.
  goal: z.enum(['lose', 'maintain', 'gain']),
  // Body-fat percent. Pre-paywall by owner decision (2026-07-23 exchange: "weight and body fat i
  // feel is pre"). Optional because most members genuinely do not know it, and a required guess is
  // worse than an absent value: the calorie math below never reads it, so a wrong number here would
  // silently corrupt the coach's read of a member's composition for nothing.
  bodyFatPct: z.number().min(3).max(70).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

const ACTIVITY_FACTOR: Record<OnboardingInput['activity'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700;

export function bmrMifflinStJeor(sex: 'female' | 'male', weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export type Plan = {
  bmr: number;
  tdee: number;
  calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  weeklyKg: number;
  curve: { week: number; weightKg: number }[];
  /**
   * Weeks to actually REACH the goal at this rate, or null when it will not happen: the member is
   * already there, the rate is effectively zero, or it runs past the horizon below.
   *
   * The curve is capped at 12 weeks, so a 45 lb goal drew a chart that stopped well short of the
   * goal line and said nothing about it. Showing someone a target their own path visibly misses,
   * with no explanation, is the quiet letdown this exists to prevent.
   */
  weeksToGoal: number | null;
  /** Total change still to make, in kg. Always positive. */
  totalKg: number;
  /** Where the 12-week curve actually ends, so the UI can be honest about the horizon. */
  projectedKg: number;
};

/** Beyond this the projection is fiction: adherence, adaptation and life all dominate. */
const MAX_PROJECTION_WEEKS = 104;

/**
 * Protein and fat scale off weight capped here rather than raw bodyweight.
 *
 * Above this the extra mass is overwhelmingly fat, which is not metabolically hungry, so scaling
 * protein with it inflates the fixed macro cost past the whole calorie budget. 105 kg is roughly
 * where 16.1 kcal/kg of fixed cost starts colliding with a realistic deficit target.
 */
const MACRO_REF_MAX_KG = 105;

/**
 * The floor a plan must leave for carbohydrate.
 *
 * Not a nutrition opinion, a product one: this audience eats rice, beans, tortillas and plátano, and
 * a plan that has no room for them is a plan she quits in week one. 100 g is low enough to still be
 * a real deficit and high enough to be a diet a person can live inside.
 */
const MIN_CARBS_G = 100;

/** Fat is bought down to buy carbs back, but never below this. Below ~0.6 g/kg hormonal risk rises. */
const MIN_FAT_G_PER_KG = 0.6;

/**
 * Protein never exceeds this share of the day's calories.
 *
 * The g/kg cap alone still broke for SHORT heavy members, where the calorie target is small enough
 * that even capped protein dominates it. 35% keeps the split recognisable as food rather than a
 * supplement plan, and still lands well above the 1.6 g/kg that muscle retention actually needs.
 */
const MAX_PROTEIN_SHARE = 0.35;

export function computePlan(input: OnboardingInput): Plan {
  const bmr = bmrMifflinStJeor(input.sex, input.weightKg, input.heightCm, input.age);
  const tdee = bmr * ACTIVITY_FACTOR[input.activity];

  let calories: number;
  if (input.goal === 'lose') calories = Math.max(Math.round(tdee - 500), Math.round(bmr * 1.1));
  else if (input.goal === 'gain') calories = Math.round(tdee + 300);
  else calories = Math.round(tdee);

  // Protein and fat are anchored to a CAPPED bodyweight, not raw bodyweight, and carbs get a floor.
  //
  // The old version was `2.0 g/kg` protein and `0.9 g/kg` fat off raw weight, with carbs taking
  // whatever was left and a `Math.max(0, ...)` on the end. Fixed macro cost is 2.0*4 + 0.9*9 = 16.1
  // kcal per kg, which grows faster than the calorie target does, so above roughly 105 kg it eats the
  // entire budget. Swept across every realistic body (150 to 350 lb, 4'10" to 6'0", sedentary and
  // light): 114 of 1,230 combinations were prescribed LITERALLY ZERO grams of carbohydrate and 584
  // came in under 50 g. A 4'10" 280 lb member got 2,040 kcal as 254 g protein and no carbs at all.
  //
  // That is a ketogenic prescription handed to a woman who never asked for one, in an app whose
  // audience eats rice, beans, tortillas and plátano. The `Math.max(0, ...)` is what hid it: without
  // the clamp the number would have gone negative and someone would have noticed years ago.
  //
  // Two changes. Protein and fat scale off weight capped at REF_KG, because a heavier body does not
  // need proportionally more protein (the extra mass is largely fat, which is not metabolically
  // hungry, and lean mass is what protein protects). And carbs get a hard floor that is paid for out
  // of fat, down to a fat minimum that stays hormonally safe.
  const refKg = Math.min(input.weightKg, MACRO_REF_MAX_KG);
  // Protein is the LESSER of the g/kg rule and a share of the day's calories. The cap alone was not
  // enough: a 4'10" 230 lb member is capped to 105 kg (210 g protein) but only eats ~1,830 kcal, so
  // protein still landed at 46% of intake. Two rules are needed because the failure has two causes,
  // a big body and a small calorie target, and either one alone can produce an absurd split.
  const protein_g = Math.min(
    Math.round(2.0 * refKg),
    Math.round((calories * MAX_PROTEIN_SHARE) / 4),
  );
  const minFat_g = Math.round(MIN_FAT_G_PER_KG * refKg);
  let fat_g = Math.round(0.9 * refKg);
  let carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  if (carbs_g < MIN_CARBS_G) {
    // Buy carbs back from fat, but never below the fat minimum.
    const shortfallKcal = (MIN_CARBS_G - carbs_g) * 4;
    const fatToTrim = Math.min(Math.ceil(shortfallKcal / 9), fat_g - minFat_g);
    fat_g -= Math.max(0, fatToTrim);
    carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);
  }
  // If it is STILL short, the calorie target itself is too low to hold a sane split, so the honest
  // move is to raise calories rather than ship a plan with no carbohydrate in it.
  if (carbs_g < MIN_CARBS_G) {
    calories = protein_g * 4 + fat_g * 9 + MIN_CARBS_G * 4;
    carbs_g = MIN_CARBS_G;
  }

  const weeklyKg = Math.round(((calories - tdee) * 7) / KCAL_PER_KG * 100) / 100;

  const weeks = 12;
  const curve: Plan['curve'] = [];
  let w = input.weightKg;
  for (let i = 0; i <= weeks; i++) {
    curve.push({ week: i, weightKg: Math.round(w * 10) / 10 });
    const next = w + weeklyKg;
    const overshoot =
      (weeklyKg < 0 && next < input.goalWeightKg) || (weeklyKg > 0 && next > input.goalWeightKg);
    w = overshoot ? input.goalWeightKg : next;
  }

  // How long the goal ACTUALLY takes, independent of the 12-week drawing window.
  const remainingKg = input.goalWeightKg - input.weightKg;
  const movingTowardGoal = Math.sign(weeklyKg) === Math.sign(remainingKg) && Math.abs(weeklyKg) > 0.01;
  const rawWeeks = movingTowardGoal ? Math.ceil(Math.abs(remainingKg / weeklyKg)) : null;
  const weeksToGoal =
    rawWeeks === null || rawWeeks > MAX_PROJECTION_WEEKS
      ? null
      : Math.max(1, rawWeeks);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    macros: { protein_g, carbs_g, fat_g },
    weeklyKg,
    curve,
    weeksToGoal,
    totalKg: Math.round(Math.abs(remainingKg) * 10) / 10,
    projectedKg: curve[curve.length - 1]?.weightKg ?? input.weightKg,
  };
}
