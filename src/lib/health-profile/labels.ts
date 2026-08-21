// Shared health-profile option slugs + English labels. Pure constants (NO 'server-only'): imported
// by the Zod validation (data.ts), the coach prompt renderer (coach-ai/context.ts), and the client
// form. The stored values are the stable slugs; the client form localizes them via next-intl, while
// the coach prompt uses the English labels below (prompt data the model reads, not member-facing).

export const DIETARY = [
  "dairy",
  "gluten",
  "eggs",
  "nuts",
  "shellfish",
  "soy",
  "pork",
  "vegetarian",
  "vegan",
] as const;
export const INJURIES = [
  "knees",
  "lower_back",
  "shoulders",
  "wrists",
  "hips",
  "neck",
] as const;
export const CONDITIONS = [
  "pcos",
  "insulin_resistance",
  "type2_diabetes",
  "hypothyroid",
  "menopause",
  "endometriosis",
  "high_bp",
  "ibs",
] as const;
export const PREGNANCY = [
  "none",
  "pregnant",
  "postpartum",
  "ttc",
  "prefer_not",
] as const;
export const SAFETY = [
  "heart_condition",
  "chest_pain",
  "dizziness",
  "joint_problem",
  "bp_meds",
] as const;
export const MEDICATIONS = [
  "glp1",
  "thyroid",
  "birth_control",
  "antidepressant",
  "steroids",
] as const;
export const EXPERIENCE = ["new", "some", "experienced"] as const;
// Where the member trains. Captured PRE-paywall alongside experience, because both decide whether the
// plan we show them on the very next screen is one they can actually execute: a gym program handed to
// someone training in a bedroom is a cancellation. One tap, and it maps onto the exercise library's
// `equipment` tiers (home -> body only / bands / dumbbell / kettlebells; gym -> everything).
// Vocabulary matches the waitlist quiz (waitlist_quiz_responses.where) so a lead is never re-asked in
// different words.
export const TRAINING_LOCATION = ["home", "gym", "both"] as const;
// How many days a week she can train. Asked because it DECIDES her program: Stephanie's library is
// built as 3, 4 and 5 day blocks and nothing was reading this, so every new member got the same
// hardcoded plan. See lib/programs/match-starter-shared.ts.
//
// Only 3, 4 and 5 are offered, because those are the only blocks she has written. Offering 2 or 6
// would collect an answer the library cannot honour and then quietly round it, which is a worse
// experience than a question that admits its range.
export const TRAINING_DAYS = ["3", "4", "5"] as const;
export const SLEEP = ["lt5", "5to6", "7to8", "gt8"] as const;
export const STRESS = ["low", "moderate", "high"] as const;
export const FOOD_REL = [
  "ok",
  "struggled",
  "light_tracking",
  "prefer_not",
] as const;

export type ConditionSlug = (typeof CONDITIONS)[number];
export type MedicationSlug = (typeof MEDICATIONS)[number];
export type SafetySlug = (typeof SAFETY)[number];
export type PregnancySlug = (typeof PREGNANCY)[number];
export type TrainingLocationSlug = (typeof TRAINING_LOCATION)[number];
export type TrainingDaysSlug = (typeof TRAINING_DAYS)[number];

// English labels the coach prompt reads. Kept concise; the parenthetical on a few gives the model the
// coaching-relevant "so what" (why the fact changes nutrition or training).
export const CONDITION_LABEL_EN: Record<ConditionSlug, string> = {
  pcos: "PCOS",
  insulin_resistance: "insulin resistance",
  type2_diabetes: "type 2 diabetes",
  hypothyroid: "hypothyroid / Hashimoto's",
  menopause: "perimenopause / menopause",
  endometriosis: "endometriosis",
  high_bp: "high blood pressure",
  ibs: "IBS / gut issues",
};

export const MEDICATION_LABEL_EN: Record<MedicationSlug, string> = {
  glp1: "GLP-1 (Ozempic/Wegovy/Mounjaro; suppresses appetite)",
  thyroid: "thyroid medication",
  birth_control: "hormonal birth control",
  antidepressant: "antidepressant / anti-anxiety",
  steroids: "steroids",
};

export const SAFETY_LABEL_EN: Record<SafetySlug, string> = {
  heart_condition: "a diagnosed heart condition",
  chest_pain: "chest pain during activity",
  dizziness: "dizziness or fainting",
  joint_problem: "a bone or joint problem exercise could worsen",
  bp_meds: "heart / blood-pressure medication",
};

// What the coach prompt reads, phrased as the coaching consequence rather than the bare slug: the
// model needs to know what it may prescribe, not just a location string.
export const TRAINING_LOCATION_LABEL_EN: Record<TrainingLocationSlug, string> = {
  home: "trains at home (assume minimal equipment: bodyweight, bands, dumbbells; do NOT prescribe barbell, cable, or machine work)",
  gym: "trains at a full gym (barbell, cable, and machine work are all available)",
  both: "trains at home and at a gym (prefer gym lifts, but always offer a home alternative)",
};

export const PREGNANCY_LABEL_EN: Record<PregnancySlug, string> = {
  none: "",
  pregnant: "currently pregnant",
  postpartum: "postpartum (0-12 months)",
  ttc: "trying to conceive",
  prefer_not: "",
};
