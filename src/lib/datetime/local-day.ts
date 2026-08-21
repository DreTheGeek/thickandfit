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

// Intl.DateTimeFormat THROWS on an unrecognised timeZone rather than falling back, and the value
// here comes from profiles.timezone — a text column with no CHECK, written from a browser guess.
// One member with a stale or mistyped zone would take down a whole roster sweep: the reminder cron
// iterates every member, so the exception ends the run and everybody after her gets nothing. That
// failure is silent from the outside (cron_job_log records an error nobody reads) and looks exactly
// like a quiet evening. Validate once per distinct string and cache; the set of zones across a
// roster is tiny and stable.
const zoneValidity = new Map<string, boolean>();

function isUsableZone(tz: string): boolean {
  const cached = zoneValidity.get(tz);
  if (cached !== undefined) return cached;
  let valid = true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
  } catch {
    valid = false;
  }
  zoneValidity.set(tz, valid);
  return valid;
}

/** Normalize a possibly-null or invalid tz to a usable IANA name, falling back to the app default. */
export function resolveTimezone(tz: string | null | undefined): string {
  if (!tz || tz.length === 0) return DEFAULT_TIMEZONE;
  return isUsableZone(tz) ? tz : DEFAULT_TIMEZONE;
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
 * The Sunday that starts this member's current local week (YYYY-MM-DD).
 *
 * Sunday-anchored because that is already this app's convention everywhere it matters: the Today
 * week strip, the dashboard's week arithmetic, and `coach_settings.reminder_weekday`, which
 * migration 0115 based on Sunday for exactly the reason spelled out under localWeekday below.
 *
 * Built by subtracting whole days from the instant and re-asking `localDay`, rather than by doing
 * arithmetic on the date STRING. Subtracting from a string breaks across a month boundary, and
 * doing it in UTC breaks for anybody west of it: at 23:00 Saturday in Guadalajara it is already
 * Sunday in UTC, so a UTC-based week would roll her over a day early, every week.
 */
export function localWeekStart(timeZone: string | null | undefined, at: Date = new Date()): string {
  const back = localWeekday(timeZone, at);
  return localDay(timeZone, new Date(at.getTime() - back * 86_400_000));
}

/**
 * The local weekday (0 = Sunday .. 6 = Saturday) for an IANA timezone at a given instant.
 *
 * Zero-indexed from Sunday to match JS getDay(), Postgres extract(dow) AND
 * coach_settings.reminder_weekday, which migration 0115 chose that basing for precisely this
 * reason. A reminder set for "Monday" has to mean Monday where the member lives, not where the
 * server is: at 23:00 Sunday in Guadalajara it is already Monday in UTC.
 */
export function localWeekday(timeZone: string | null | undefined, at: Date = new Date()): number {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimezone(timeZone),
    weekday: 'short',
  }).format(at);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
  // -1 would silently match nothing (or, worse, weekday 6 after a modulo). Fall back to the UTC
  // weekday, which is wrong by at most a day rather than wrong always. Unreachable while the locale
  // stays 'en-US', which is why it is a fallback and not a throw.
  return index >= 0 ? index : at.getUTCDay();
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
