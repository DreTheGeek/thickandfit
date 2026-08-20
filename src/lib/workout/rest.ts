/**
 * Rest between sets, in seconds, whatever unit the row actually holds.
 *
 * `session_exercises.rest_sec` is named seconds and mostly holds MILLISECONDS. Her Lenus export
 * carries `restTime` in ms and `scripts/import-lenus-programs.mjs` wrote it through unconverted, so
 * 1,454 of the 1,458 prescribed rests in her library are 1000x too large: 20000, 90000, 120000,
 * 300000. Every one of those is a sane rest period read as milliseconds.
 *
 * What that cost, live, on the core flow: the player does `setRest(ex.rest_sec)` and ticks it down
 * once a second, so finishing a set of banded squats started a 20,000 second countdown. Five and a
 * half hours of rest, the audible timer never firing, on a screen she is standing in front of
 * mid-workout. It shipped that way since the migration.
 *
 * NORMALISED AT EVERY READ rather than only fixed in the table, deliberately. The importer is
 * scheduled to run again before Stephanie's Lenus account closes, so a data-only fix would be
 * undone by the next sweep. The importer is fixed too, and migration 0145 corrects the stored rows;
 * this is the layer that means a third mistake in the same place cannot reach a member.
 *
 * The threshold is unambiguous on the real data: 1,454 rows are >= 1000, four rows are exactly 60,
 * and nothing sits between 601 and 999. A rest longer than CEILING is not a rest, so anything still
 * absurd after conversion is clamped rather than trusted.
 */

/** Above this, a value cannot be seconds: no set rests for 17 minutes. */
const MS_THRESHOLD = 1000;

/** Hard ceiling after conversion. A 10 minute rest is already generous for the longest heavy set. */
const CEILING_SEC = 600;

export function normalizeRestSeconds(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  const seconds = raw >= MS_THRESHOLD ? Math.round(raw / 1000) : Math.round(raw);
  if (seconds <= 0) return null;
  return Math.min(seconds, CEILING_SEC);
}
