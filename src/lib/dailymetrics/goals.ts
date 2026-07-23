// Move + Recover goals, in a server-free module so the client mission card can import them without
// pulling the server Supabase client. Not per-member yet; a goal-type setting is the natural follow-on.
export const STEP_GOAL = 8000;
export const SLEEP_GOAL_MIN = 420; // 7h

/** "7h 32m" from a minute count, for the Recover row detail. */
export function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
