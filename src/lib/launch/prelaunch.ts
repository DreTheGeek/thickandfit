// Pre-launch visibility gate for the public marketing site.
//
// Rodney, 2026-07-30: the teamthickandfit.com site should not be publicly visible yet, and the
// launch runs as TWO separate funnels: the waitlist funnel (live Aug 4) and the main app signup
// (live when doors open in October). This module hides the second one without touching the first.
//
// WHY A DENYLIST AND NOT AN ALLOWLIST. "Hide everything except X" is the stricter shape and the
// wrong one here. The waitlist opens in five days and the entire campaign points at /join, so a
// rule that can accidentally swallow /join, /api/funnel/*, or a confirmation link costs far more
// than a rule that might leave a future marketing page visible. The public marketing surface is
// small, known, and listed below. ADD NEW MARKETING PAGES HERE when you build them.
//
// What stays public on purpose:
//   /join*        the waitlist funnel. This is the whole point of Aug 4.
//   /terms /privacy /disclaimer   must stay reachable: App Store review reads them, and the
//                                 waitlist emails link to them for CAN-SPAM.
//   /support      someone who cannot log in needs a way to reach a human.
//   /api/* /auth/*                the funnel and session plumbing.
// Everything under the authed app (/today, /you, /coach, /admin) is already behind auth, so it was
// never publicly visible and needs no gate.

/** Public marketing paths hidden while the gate is on. Locale-stripped, so /es twins are covered. */
const GATED_PATHS: RegExp[] = [
  /^\/$/, // the landing page
  /^\/about$/,
  /^\/faq$/,
  /^\/pricing$/,
  // Competitor comparison pages: /vs/myfitnesspal, /vs/cal-ai, /vs/fitia.
  //
  // This ONE entry also covers the Spanish twins added 2026-08-04 (/es/vs/myfitnesspal,
  // /es/vs/cal-ai, /es/vs/fitia). isGatedPath runs stripLocale FIRST, so /es/vs/cal-ai is tested as
  // /vs/cal-ai and matches here. Do not add a separate /^\/es\/vs/ pattern: by the time these
  // regexes run the /es prefix is already gone, so such a rule would never match anything and would
  // read as coverage that does not exist. Verified against the gate test, which asserts the /es
  // twin of every gated path.
  /^\/vs(\/|$)/,
];

/**
 * The waitlist funnel. Gated only by the SECOND switch (PRELAUNCH_WAITLIST_CLOSED), never by
 * PRELAUNCH_HIDE_SITE, because the two funnels open on different dates: the waitlist on Aug 4 and
 * the marketing site when doors open. One flag could not express that.
 */
const WAITLIST_PATHS: RegExp[] = [/^\/join(\/|$)/];

/**
 * The single public face during a full blackout. Must NEVER be gated by anything: it is the target
 * every other gated path redirects to, so gating it is an immediate redirect loop.
 */
export const HOLDING_PATH = '/soon';

/** Cookie that remembers a team member cleared the preview token. */
export const PREVIEW_COOKIE = 'tf_site_preview';
/** Query param that grants preview access: /?preview=<PRELAUNCH_PREVIEW_TOKEN>. */
export const PREVIEW_PARAM = 'preview';
export const PREVIEW_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/**
 * Is the gate on? Defaults to OFF so that shipping this code changes nothing by itself. Turning the
 * site dark is an ops action (set PRELAUNCH_HIDE_SITE=1 in Vercel), which keeps an accidental
 * production blackout from riding in on a deploy.
 */
export function isPrelaunchEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env.PRELAUNCH_HIDE_SITE);
}

/**
 * Is the WAITLIST closed too? Independent of the marketing gate on purpose.
 *
 * Dre, 2026-07-30: nobody should be able to join the waitlist yet, but the team still needs to reach
 * the site to log in and test. This closes the second funnel without disturbing the first switch, so
 * Aug 4 is `vercel env rm PRELAUNCH_WAITLIST_CLOSED` and doors-open day is `vercel env rm
 * PRELAUNCH_HIDE_SITE`. Two dates, two switches, neither one entangled with the other.
 *
 * Defaults OFF, same as the marketing gate: shipping this code closes nothing by itself.
 */
export function isWaitlistClosed(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env.PRELAUNCH_WAITLIST_CLOSED);
}

function isTruthy(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true' || v === 'yes';
}

/**
 * Strip a leading /es so a Spanish twin is gated exactly like its English original. Without this,
 * /es/pricing would stay wide open while /pricing was hidden, and roughly half this audience is
 * Spanish-speaking.
 */
export function stripLocale(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/es') return '/';
  return p.startsWith('/es/') ? p.slice(3) : p;
}

/**
 * True when this path is hidden given the two switches.
 *
 * The holding page is checked FIRST and is never gated under any combination of flags. Everything
 * gated redirects there, so one wrong answer here is not a 404, it is an infinite redirect on the
 * only page a visitor can reach.
 */
export function isGatedPath(
  pathname: string,
  opts: { siteHidden: boolean; waitlistClosed: boolean },
): boolean {
  const bare = stripLocale(pathname);
  if (bare === HOLDING_PATH) return false;
  if (opts.waitlistClosed && WAITLIST_PATHS.some((re) => re.test(bare))) return true;
  return opts.siteHidden && GATED_PATHS.some((re) => re.test(bare));
}

/**
 * Where a gated visitor goes, in their own language.
 *
 * A redirect rather than a "coming soon" page on purpose: stray traffic to the domain before doors
 * open is exactly the traffic the waitlist wants, so sending it to /join converts it instead of
 * dead-ending it, and it leaves the domain with a single public face pre-launch.
 *
 * ONCE THE WAITLIST IS CLOSED THAT TARGET IS GONE, and redirecting to a gated /join would loop
 * forever. So the destination follows the flag: /join while the waitlist is open, the holding page
 * once it is not.
 */
export function gateRedirectPath(pathname: string, waitlistClosed: boolean): string {
  const isEs = pathname === '/es' || pathname.startsWith('/es/');
  const target = waitlistClosed ? HOLDING_PATH : '/join';
  return isEs ? `/es${target}` : target;
}

/**
 * Does this request already hold preview access? Compares against PRELAUNCH_PREVIEW_TOKEN. With no
 * token configured there is no bypass at all, so a half-configured gate fails CLOSED (hidden)
 * rather than open.
 */
export function hasPreviewAccess(
  cookieValue: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const token = (env.PRELAUNCH_PREVIEW_TOKEN ?? '').trim();
  if (!token) return false;
  return cookieValue === token;
}

/** Is this request presenting the preview token in the query string? */
export function presentedPreviewToken(
  search: URLSearchParams,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const token = (env.PRELAUNCH_PREVIEW_TOKEN ?? '').trim();
  if (!token) return null;
  return search.get(PREVIEW_PARAM) === token ? token : null;
}
