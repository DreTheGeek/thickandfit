/**
 * What KIND of thing this movement is, read from the prescription Stephanie actually wrote.
 *
 * THE BUG THIS EXISTS TO FIX, in the owner's words: "this is a inclined walk. Why does it have reps
 * and how many pounds and all this shit? Like, this is walking."
 *
 * He is right, and it was not a display slip. The player did `ex.reps ?? 10` and `ex.weight ?? 0`,
 * so a movement she prescribed as "25 minutes on an incline" was rendered as "10 reps at 0 lb" and
 * then LOGGED that way. 430 of her 2,501 prescribed movements (17%) are timed or untracked, so this
 * was inventing numbers on roughly one movement in six, and writing them into the set history that
 * drives progressive overload.
 *
 * DERIVED, NEVER STORED. There is no `kind` column and there should not be one: the prescription
 * already says which it is, and a second column recording the same fact is a column that can
 * disagree with the first. She writes reps, or she writes a duration, or she writes neither.
 *
 *   reps       she wrote a rep count or a range (or AMRAP). Steppers, set table, overload.
 *   timed      she wrote a duration and no reps. A clock, not a counter.
 *   untracked  she wrote neither. A warm-up or a stretch: do it, tick it, move on.
 */

export type ExerciseKind = 'reps' | 'timed' | 'untracked';

export type Prescription = {
  reps: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  isAmrap?: boolean;
  timeSec: number | null;
};

export function exerciseKind(p: Prescription): ExerciseKind {
  // AMRAP is a rep movement whose count is unknown until she finishes it. It must stay countable.
  if (p.isAmrap) return 'reps';
  if (p.reps != null || p.repsMin != null || p.repsMax != null) return 'reps';
  if (p.timeSec != null && p.timeSec > 0) return 'timed';
  return 'untracked';
}

/**
 * Equipment that carries no number a member could enter.
 *
 * Bands are here deliberately. A band has real resistance but no pounds: asking for a weight on a
 * banded pulse squat gets a 0 in the history, and a 0 is indistinguishable from "she did not record
 * it". Better to record reps honestly than a weight that was never true.
 *
 * Machines and cables ARE weighted: the stack is numbered and she reads it off the pin.
 */
const UNWEIGHTED = new Set(['body only', 'bodyonly', 'bands', 'foam roll', 'foamroll', 'none', '']);

export function isWeighted(equipment: string | null | undefined): boolean {
  if (equipment == null) return true; // 288 rows have no equipment recorded; assume she may load it.
  return !UNWEIGHTED.has(equipment.trim().toLowerCase());
}

/** "25 min", "5:30", "45s" - the shortest honest rendering of a prescribed duration. */
export function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
