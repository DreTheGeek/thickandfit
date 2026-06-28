// Timezone-correct calendar day. Single source of truth for "what day is it for THIS user",
// replacing the three UTC todayIso()/utcToday() copies (nutrition/diary, habits, gamification).
//
// WHY: the app serves US + LATAM. A 9pm-Pacific or 11pm-Mexico-City meal logged against the UTC
// date lands on TOMORROW, silently breaking the diary day and streak math. localDay(tz) returns
// the user's LOCAL calendar day, DST-correct (Intl handles the 2022 Mexico DST drop, etc.).
//
// No dependencies: Intl.DateTimeFormat with the 'en-CA' locale formats as YYYY-MM-DD, and the
// timeZone option does the heavy lifting.

const DEFAULT_TIMEZONE = 'America/New_York';

/** Normalize a possibly-null tz to a usable IANA name, falling back to the app default. */
export function resolveTimezone(tz: string | null | undefined): string {
  return tz && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
}

/**
 * The local calendar day (YYYY-MM-DD) for an IANA timezone at a given instant.
 * @param timeZone IANA name (e.g. 'America/Mexico_City'). Null/empty falls back to the app default.
 * @param at       instant to evaluate (defaults to now).
 */
export function localDay(timeZone: string | null | undefined, at: Date = new Date()): string {
  // en-CA renders YYYY-MM-DD; the timeZone option shifts the instant into the target zone first.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimezone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * The local hour (0..23) for an IANA timezone at a given instant. Used by the reminder selection
 * to find users whose current local hour equals their reminder_hour.
 */
export function localHour(timeZone: string | null | undefined, at: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimezone(timeZone),
    hour: '2-digit',
    hour12: false,
  }).format(at);
  // 'en-US' hour12:false can render midnight as '24'; normalize into 0..23.
  return Number(formatted) % 24;
}
