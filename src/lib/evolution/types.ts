// Evolution timeline: the transformation story, assembled from what she has actually done.
//
// Why this exists (positioning brief): people quit because they do not notice change. The timeline
// makes change impossible to miss by replaying her own record back to her as a narrative.
//
// HONESTY RULE: every entry must be derived from a real row she created. There are no motivational
// milestones that fire on a schedule. If she has no data for a week, that week has no entry. A
// timeline that congratulates you for nothing is worse than no timeline.

/** The kinds of moment worth putting on the wall. */
export type EvolutionKind =
  | 'started' // her first recorded day
  | 'photo' // a progress photo
  | 'weight' // a weight milestone (first entry, or a new best delta)
  | 'measurement' // a measurement milestone (waist, hips, etc.)
  | 'streak' // a consistency run she actually hit
  | 'consistency'; // a logging milestone (e.g. 100 meals logged)

export type EvolutionEntry = {
  /** Stable id so React keys and de-dupe work: `${kind}:${isoDate}:${discriminator}`. */
  id: string;
  kind: EvolutionKind;
  /** Calendar day this belongs to, ISO yyyy-mm-dd, in HER timezone. */
  on: string;
  /** 1-based week since she started. Drives the "Week N" rail. */
  week: number;
  /** Short label, already localized by the caller's translator. */
  title: string;
  /** Optional supporting line. Never invented: only rendered when there is a real value. */
  detail?: string;
  /** Signed change where one applies, in HER display units, e.g. -4.2. */
  delta?: number;
  /** Unit for delta, already localized: 'lb' | 'kg' | 'in' | 'cm'. */
  unit?: string;
  /** Signed storage path for a progress photo, when kind === 'photo'. */
  photoUrl?: string;
};

/** The first and latest progress photos, for the side-by-side that does the emotional work. */
export type EvolutionBookends = {
  first: { url: string; on: string } | null;
  latest: { url: string; on: string } | null;
  /** Whole weeks between the two shots. Null when there is only one photo. */
  weeksBetween: number | null;
};

export type EvolutionSummary = {
  /** Null when she has no start anchor yet, which means the whole surface stays hidden. */
  startedOn: string | null;
  weeksIn: number | null;
  /** Total weight change since her first entry, in display units. Negative is loss. */
  weightDelta: number | null;
  weightUnit: 'lb' | 'kg' | null;
  /** Waist change since her first measurement, in display units. */
  waistDelta: number | null;
  lengthUnit: 'in' | 'cm' | null;
  photoCount: number;
  mealsLogged: number;
  bookends: EvolutionBookends;
  entries: EvolutionEntry[];
};
