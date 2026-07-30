// Cycle phase math. PURE: no clock read inside, no DB, no server-only. `today` is always injected,
// which keeps it inside the project's render-purity rule and makes every boundary testable.
//
// The honesty constraint that shaped this file: the app's own intake captures PCOS, endometriosis,
// thyroid disease and perimenopause, and those members frequently have cycles that are long,
// irregular, or absent. A tracker that confidently predicts "your period starts Tuesday" off two
// wildly different cycles is worse than one that says it does not know yet, because a member with
// PCOS has usually been told by an app before that she is "late" when she is not. So:
//   * fewer than 2 logged periods  -> no prediction at all
//   * high variance between cycles -> report irregular, and give a RANGE instead of a date
//   * a cycle far outside human range is ignored rather than averaged in

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';

export type CycleLog = {
  /** ISO date, YYYY-MM-DD. */
  startedOn: string;
  endedOn?: string | null;
};

/** Typical cycle when we have nothing to go on. Only used for phase display, never for a prediction. */
export const DEFAULT_CYCLE_LENGTH = 28;

/** Cycles outside this are treated as data errors (a mistyped year, a skipped log) and excluded from
 *  the average. 21-45 days covers the clinically normal range plus the long tail. */
const MIN_PLAUSIBLE = 21;
const MAX_PLAUSIBLE = 45;

/** Above this spread between cycles, calling a specific date would be false precision. */
const IRREGULAR_STDDEV_DAYS = 7;

const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD as a UTC calendar day. Avoids the local-timezone off-by-one on date-only values. */
export function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso) - parseDay(fromIso)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(parseDay(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export type CycleStats = {
  /** Gaps between consecutive starts that fell in the plausible range. */
  cycleLengths: number[];
  averageLength: number | null;
  /** True when the spread is wide enough that a single predicted date would be misleading. */
  isIrregular: boolean;
  /** Predicted next start, or null when we refuse to guess. */
  predictedNextStart: string | null;
  /** For an irregular history: the window we are willing to state instead of a date. */
  predictedRange: { from: string; to: string } | null;
};

/** Logs must be newest-first or oldest-first; this sorts defensively. */
function sortedStarts(logs: CycleLog[]): string[] {
  return logs
    .map((l) => l.startedOn.slice(0, 10))
    .filter(Boolean)
    .sort();
}

export function cycleStats(logs: CycleLog[]): CycleStats {
  const starts = sortedStarts(logs);
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap >= MIN_PLAUSIBLE && gap <= MAX_PLAUSIBLE) lengths.push(gap);
  }

  if (lengths.length === 0) {
    // One period logged (or only implausible gaps): enough to show the current phase, never enough
    // to predict. Saying nothing beats inventing a date.
    return {
      cycleLengths: [],
      averageLength: null,
      isIrregular: false,
      predictedNextStart: null,
      predictedRange: null,
    };
  }

  const avg = Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length);
  const variance = lengths.reduce((s, n) => s + (n - avg) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);
  const irregular = lengths.length >= 2 && stddev > IRREGULAR_STDDEV_DAYS;
  const lastStart = starts[starts.length - 1];

  if (irregular) {
    // Give the honest window rather than a date she will measure herself against.
    const spread = Math.max(3, Math.round(stddev));
    return {
      cycleLengths: lengths,
      averageLength: avg,
      isIrregular: true,
      predictedNextStart: null,
      predictedRange: { from: addDays(lastStart, avg - spread), to: addDays(lastStart, avg + spread) },
    };
  }

  return {
    cycleLengths: lengths,
    averageLength: avg,
    isIrregular: false,
    predictedNextStart: addDays(lastStart, avg),
    predictedRange: null,
  };
}

export type PhaseInfo = {
  phase: CyclePhase;
  /** 1-based day of the current cycle, or null when unknown. */
  cycleDay: number | null;
  /** Days until the next expected start; negative means overdue. Null when we will not predict. */
  daysUntilNext: number | null;
};

/**
 * Where the member is today.
 *
 * Phase boundaries use the standard model anchored on the NEXT period rather than the last one,
 * because the luteal phase is the stable ~14 days while the follicular phase is what stretches on a
 * long cycle. Anchoring the other way would put "ovulation" on day 14 of a 40-day cycle, which is
 * wrong for exactly the members most likely to use this.
 */
export function currentPhase(logs: CycleLog[], today: string): PhaseInfo {
  const starts = sortedStarts(logs);
  if (starts.length === 0) return { phase: 'unknown', cycleDay: null, daysUntilNext: null };

  const lastStart = starts[starts.length - 1];
  const since = daysBetween(lastStart, today);
  // A future-dated or nonsensical log tells us nothing about today.
  if (since < 0) return { phase: 'unknown', cycleDay: null, daysUntilNext: null };

  const stats = cycleStats(logs);
  const length = stats.averageLength ?? DEFAULT_CYCLE_LENGTH;

  // Way past any plausible cycle: stop asserting a phase rather than reporting "luteal, day 97".
  if (since > MAX_PLAUSIBLE + 15) return { phase: 'unknown', cycleDay: since + 1, daysUntilNext: null };

  const cycleDay = since + 1;
  const daysUntilNext = length - since;

  let phase: CyclePhase;
  const lastLog = logs.find((l) => l.startedOn.slice(0, 10) === lastStart);
  const loggedEnd = lastLog?.endedOn ? daysBetween(lastStart, lastLog.endedOn.slice(0, 10)) : null;
  // Prefer her own logged end over the 5-day assumption. She knows.
  const bleedDays = loggedEnd != null && loggedEnd >= 0 ? loggedEnd + 1 : 5;

  if (since < bleedDays) phase = 'menstrual';
  else if (daysUntilNext <= 14 && daysUntilNext > 12) phase = 'ovulation';
  else if (daysUntilNext > 14) phase = 'follicular';
  else phase = 'luteal';

  return { phase, cycleDay, daysUntilNext };
}

/**
 * What the coach should know. Instruction-bearing, in the same spirit as the health-profile labels:
 * the model needs the coaching consequence, not a phase name it will improvise around.
 */
export const PHASE_COACHING_EN: Record<Exclude<CyclePhase, 'unknown'>, string> = {
  menstrual:
    'on her period: energy and heavy lifts often dip, cramps are common. Lower the intensity if she wants it, keep movement gentle, and never frame a lighter week as falling behind.',
  follicular:
    'in the follicular phase: energy and recovery are usually at their best. This is the week to push intensity and chase progression.',
  ovulation:
    'around ovulation: strength usually peaks, but so does joint laxity, so keep form strict on heavy lower-body work.',
  luteal:
    'in the luteal phase: appetite and cravings commonly rise, body temperature is higher and perceived effort goes up. Expect the scale to hold or bump from water, treat that as normal rather than a setback, and do not cut calories in response.',
};
