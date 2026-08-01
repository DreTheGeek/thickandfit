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

export function computePlan(input: OnboardingInput): Plan {
  const bmr = bmrMifflinStJeor(input.sex, input.weightKg, input.heightCm, input.age);
  const tdee = bmr * ACTIVITY_FACTOR[input.activity];

  let calories: number;
  if (input.goal === 'lose') calories = Math.max(Math.round(tdee - 500), Math.round(bmr * 1.1));
  else if (input.goal === 'gain') calories = Math.round(tdee + 300);
  else calories = Math.round(tdee);

  // Protein 2.0 g/kg (muscle retention), fat 0.9 g/kg, carbs fill the remainder.
  const protein_g = Math.round(2.0 * input.weightKg);
  const fat_g = Math.round(0.9 * input.weightKg);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));

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
