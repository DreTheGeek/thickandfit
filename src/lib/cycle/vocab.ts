/**
 * What a member can log about a day.
 *
 * Slugs, never free text, for the same reason the health profile uses them: a coach scanning 30
 * clients needs "cramps" to be one thing, and a symptom count is only meaningful if the vocabulary
 * is closed. Free-text notes exist alongside for anything this does not cover.
 *
 * The list is deliberately short. A 40-item symptom picker is a chore at 7am on day two, and the
 * long tail adds nothing a coach acts on. These are the ones that change what Stephanie would
 * program or say that week.
 */

export const SYMPTOMS = [
  'cramps',
  'bloating',
  'headache',
  'breast_tenderness',
  'acne',
  'fatigue',
  'back_pain',
  'nausea',
  'cravings',
  'poor_sleep',
] as const;

export const MOODS = ['good', 'calm', 'irritable', 'anxious', 'low', 'sensitive', 'motivated', 'flat'] as const;

export const FLOWS = ['light', 'medium', 'heavy'] as const;

export const CYCLE_TYPES = ['regular', 'irregular', 'unsure'] as const;

export type Symptom = (typeof SYMPTOMS)[number];
export type Mood = (typeof MOODS)[number];
export type Flow = (typeof FLOWS)[number];
export type CycleType = (typeof CYCLE_TYPES)[number];

/**
 * Energy is 1 to 5 rather than a slug set.
 *
 * It is the one field here that is genuinely ordered: "3 today, 2 yesterday" is a real comparison,
 * where "irritable vs anxious" is not. Keeping it numeric means the coach card can show a trend
 * without inventing an ordering over words.
 */
export const ENERGY_MIN = 1;
export const ENERGY_MAX = 5;
