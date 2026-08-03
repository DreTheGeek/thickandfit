// Deterministic weight-plateau detection. PURE: no imports, so it is unit-testable with bare node
// (see .qa-visual/plateau-detect-test.mjs). Lifted out of insights.ts, whose `@/lib` path aliases
// bare node cannot resolve; the detector never needed the AI machinery around it, and its own note
// already described it as pure math over weight_entries.
//
// A plateau = weight flat (|delta| < band) over a span of at least MIN_DAYS, backed by at least
// MIN_ENTRIES weigh-ins, while the member is still active (logging food or workouts). Tuned to be
// conservative so we never nag someone who is genuinely still trending.

// --- Thresholds -------------------------------------------------------------------------------
export const PLATEAU_BAND_KG = 0.5; // |newest - oldest| must be under this to count as "flat"
export const PLATEAU_MIN_DAYS = 14; // the flat window must span at least this many days
export const PLATEAU_MIN_ENTRIES = 4; // ...with at least this many weigh-ins inside it
export const PLATEAU_LOOKBACK_DAYS = 21; // we evaluate the most recent ~3 weeks of weigh-ins
export const PLATEAU_MIN_ACTIVITY = 4; // member must have >= this many logged-or-workout days recently to count as "active"

/**
 * `plateau` means the weight is flat and that is a problem worth raising.
 *
 * `holding` is the SAME detection on a member whose plan deliberately holds her at maintenance. The
 * weight really is flat, so the numbers stay truthful, but flat is what her plan is FOR and it must
 * not be sold to her as a stall. Every consumer gates on `=== 'plateau'` (the dashboard banner, the
 * push nudge, the coaching flag, the coach-prompt block, and the was-it-already-flat check), so
 * 'holding' records the fact without firing any of them.
 */
export type PlateauStatus = 'none' | 'plateau' | 'holding';

export type PlateauInsight = {
  status: PlateauStatus;
  days_flat: number; // span in days between the oldest + newest entry in the flat window (0 when none)
  delta_kg: number | null; // newest minus oldest over the flat window (null when none)
  entries: number; // number of weigh-ins in the flat window
  // A short machine-stable suggestion code the UI/coach can branch on (e.g. 'refeed_or_recompute').
  suggestion: string | null;
};

/** The slice of the nightly rollup this detector actually reads. */
export type PlateauInput = {
  weightRows: { recorded_on: string; weight_kg: number }[]; // newest-first
  loggedDays30: number;
  workoutDays30: number;
};

// Local copies rather than an import, to keep this module dependency-free. Both are trivial and
// stable; the same rationale as goal-pace.ts.
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Evaluates the 14-day and 21-day windows; flags a plateau when the most recent window is flat
 * (|delta| < band) over >= MIN_DAYS, has >= MIN_ENTRIES weigh-ins, and the member is still active.
 * We prefer the 14-day window and widen to 21 days if 14 alone lacks enough entries.
 *
 * `goal` is the calorie direction from onboarding (`onboarding_responses.predicted_goal`). It is what
 * separates a stall from a plan working as designed, so it is required, not optional.
 */
export function detectPlateau(roll: PlateauInput, goal: string | null): PlateauInsight {
  const none: PlateauInsight = { status: 'none', days_flat: 0, delta_kg: null, entries: 0, suggestion: null };

  // Newest-first weigh-ins, normalized to {date, kg}. rollUp already sorted weightRows newest-first.
  const entries = roll.weightRows
    .map((w) => ({ date: w.recorded_on.slice(0, 10), kg: num(w.weight_kg) }))
    .filter((w) => w.date && Number.isFinite(w.kg));
  if (entries.length < PLATEAU_MIN_ENTRIES) return none;

  // Member must still be active; a plateau on someone who stopped logging is not a coaching moment.
  const active = roll.loggedDays30 + roll.workoutDays30 >= PLATEAU_MIN_ACTIVITY;
  if (!active) return none;

  const evaluateWindow = (cutDays: number): PlateauInsight | null => {
    const cut = isoDaysAgo(cutDays);
    const inWindow = entries.filter((w) => w.date >= cut);
    if (inWindow.length < PLATEAU_MIN_ENTRIES) return null;

    const newest = inWindow[0]; // newest first
    const oldest = inWindow[inWindow.length - 1];
    const daysFlat = Math.round(
      (Date.parse(`${newest.date}T00:00:00Z`) - Date.parse(`${oldest.date}T00:00:00Z`)) / 86_400_000,
    );
    if (daysFlat < PLATEAU_MIN_DAYS) return null;

    const delta = Math.round((newest.kg - oldest.kg) * 10) / 10;
    if (Math.abs(delta) >= PLATEAU_BAND_KG) return null;

    return {
      status: 'plateau',
      days_flat: daysFlat,
      delta_kg: delta,
      entries: inWindow.length,
      suggestion: 'refeed_or_recompute',
    };
  };

  // Prefer the tighter 14-day signal; fall back to the 21-day window if 14 lacks enough entries.
  const found = evaluateWindow(PLATEAU_MIN_DAYS) ?? evaluateWindow(PLATEAU_LOOKBACK_DAYS) ?? none;

  // A member held at maintenance is SUPPOSED to be flat. Onboarding tells her so in her own language
  // ("expect the scale to stay flatter than you think ... that is the plan working, not stalling"),
  // and then this detector used to contradict it on day 14 with "Looks like a plateau, we can adjust
  // your plan to get you moving again". Congratulating her at signup and nagging her a fortnight
  // later, over the same number, is how she stops believing either message.
  //
  // The detection was never wrong, only its meaning. Keep the days/delta/entries and drop the
  // suggestion: a refeed is the answer to a stall, and this is not one.
  if (found.status === 'plateau' && goal === 'maintain') {
    return { ...found, status: 'holding', suggestion: null };
  }
  return found;
}
