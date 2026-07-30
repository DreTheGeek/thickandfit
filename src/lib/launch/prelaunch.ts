// Pre-launch visibility gate for the public marketing site.
//
// Rodney, 2026-07-30: the teamthickandfit.com site should not be publicly visible yet, and the
// launch runs as TWO separate funnels: the waitlist funnel (live Aug 4) and the main app signup
// (live Sept 27 when doors open). This module hides the second one without touching the first.
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
  /^\/vs(\/|$)/, // competitor comparison pages (/vs/myfitnesspal, /vs/fitia, ...)
];

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
  const v = (env.PRELAUNCH_HIDE_SITE ?? '').trim().toLowerCase();
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

/** True when this path is one of the marketing surfaces the gate hides. */
export function isGatedPath(pathname: string): boolean {
  const bare = stripLocale(pathname);
  return GATED_PATHS.some((re) => re.test(bare));
}

/**
 * Where a gated visitor goes: the waitlist, in their own language.
 *
 * A redirect rather than a "coming soon" page on purpose. Stray traffic to the domain before doors
 * open is exactly the traffic the waitlist wants, so sending it to /join converts it instead of
 * dead-ending it, and it leaves the domain with a single public face pre-launch, which is what
 * "two separate funnels" means in practice.
 */
export function gateRedirectPath(pathname: string): string {
  return pathname === '/es' || pathname.startsWith('/es/') ? '/es/join' : '/join';
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
