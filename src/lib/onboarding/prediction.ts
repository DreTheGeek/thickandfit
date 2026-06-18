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
  goal: z.enum(['lose', 'maintain', 'gain']),
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
};

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

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    macros: { protein_g, carbs_g, fat_g },
    weeklyKg,
    curve,
  };
}
