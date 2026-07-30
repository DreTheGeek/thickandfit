// Pre-launch gate test. Imports the REAL module (Node strips the TS types), so this exercises the
// shipped logic rather than a re-implementation of it.
//
// The stakes: this gate runs in the proxy in front of every request. A false positive hides the
// waitlist before it opens; a false negative leaves a surface public that was supposed to be dark.
// Both directions are asserted below, for BOTH switches and every combination of them.
import {
  HOLDING_PATH,
  gateRedirectPath,
  hasPreviewAccess,
  isGatedPath,
  isPrelaunchEnabled,
  isWaitlistClosed,
  presentedPreviewToken,
  stripLocale,
} from '../src/lib/launch/prelaunch.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// The four states the two switches can be in. Named so a failure says which mode broke.
const OPEN = { siteHidden: false, waitlistClosed: false }; // fully live (after Sept 27)
const SITE_DARK = { siteHidden: true, waitlistClosed: false }; // Aug 4 -> Sept 27: waitlist live
const BLACKOUT = { siteHidden: true, waitlistClosed: true }; // now: nothing public
const WAITLIST_ONLY = { siteHidden: false, waitlistClosed: true }; // odd but must not misbehave

// --- HIDDEN: the marketing surface, while PRELAUNCH_HIDE_SITE is on ---
const marketing = ['/', '/about', '/faq', '/pricing', '/vs/myfitnesspal', '/vs/fitia', '/vs'];
for (const p of marketing) {
  ok(`site-dark gates ${p}`, isGatedPath(p, SITE_DARK) === true);
  ok(`blackout gates ${p}`, isGatedPath(p, BLACKOUT) === true);
  // The waitlist switch alone must NOT hide marketing. The two flags are independent.
  ok(`waitlist-only leaves ${p} public`, isGatedPath(p, WAITLIST_ONLY) === false);
  ok(`all-open leaves ${p} public`, isGatedPath(p, OPEN) === false);
}
// ...and their Spanish twins. Half this audience is Spanish-speaking; hiding only the EN pages
// would have left /es/pricing wide open.
for (const p of ['/es', '/es/about', '/es/faq', '/es/pricing']) {
  ok(`site-dark gates ${p}`, isGatedPath(p, SITE_DARK) === true);
}
// Trailing slashes must not slip through.
ok('gated /pricing/', isGatedPath('/pricing/', SITE_DARK) === true);

// --- THE WAITLIST SWITCH: /join closes only when PRELAUNCH_WAITLIST_CLOSED is on ---
const waitlist = ['/join', '/join/thanks', '/join/quiz', '/es/join', '/es/join/thanks'];
for (const p of waitlist) {
  // Aug 4 through Sept 27 the site is dark but the waitlist is THE campaign. Never gate it then.
  ok(`site-dark keeps ${p} live`, isGatedPath(p, SITE_DARK) === false);
  ok(`all-open keeps ${p} live`, isGatedPath(p, OPEN) === false);
  // Right now: closed.
  ok(`blackout gates ${p}`, isGatedPath(p, BLACKOUT) === true);
  ok(`waitlist-only gates ${p}`, isGatedPath(p, WAITLIST_ONLY) === true);
}

// --- THE LOOP GUARD: the holding page is never gated in ANY mode ---
// Everything gated redirects to /soon, so if /soon were ever gated the only reachable page on the
// domain would redirect to itself forever. This is the single most important assertion in the file.
for (const [name, mode] of [
  ['open', OPEN],
  ['site-dark', SITE_DARK],
  ['blackout', BLACKOUT],
  ['waitlist-only', WAITLIST_ONLY],
]) {
  ok(`${name}: /soon never gated`, isGatedPath('/soon', mode) === false);
  ok(`${name}: /es/soon never gated`, isGatedPath('/es/soon', mode) === false);
  ok(`${name}: HOLDING_PATH never gated`, isGatedPath(HOLDING_PATH, mode) === false);
}

// --- LIVE in every mode: the plumbing the running app and the launch depend on ---
const mustStayPublic = [
  '/terms',
  '/privacy',
  '/disclaimer',
  '/support',
  '/es/terms',
  '/es/privacy',
  '/es/support',
  '/api/funnel/signup',
  '/api/funnel/confirm',
  '/api/stripe/webhook',
  '/auth/callback',
  '/auth/login',
  '/today',
  '/you',
  '/coach/clients',
  '/admin/waitlist',
];
for (const p of mustStayPublic) {
  // Asserted under BLACKOUT, the strictest mode: if it survives that it survives everything.
  ok(`NOT gated in blackout ${p}`, isGatedPath(p, BLACKOUT) === false);
}
// The nastiest false positive: a path that merely starts with a gated word.
ok('NOT gated /pricing-guide', isGatedPath('/pricing-guide', BLACKOUT) === false);
ok('NOT gated /aboutus', isGatedPath('/aboutus', BLACKOUT) === false);
ok('NOT gated /vsomething', isGatedPath('/vsomething', BLACKOUT) === false);
ok('NOT gated /joinery', isGatedPath('/joinery', BLACKOUT) === false);
ok('NOT gated /soonish', isGatedPath('/soonish', BLACKOUT) === false);

// --- locale stripping ---
ok('stripLocale /es -> /', stripLocale('/es') === '/');
ok('stripLocale /es/pricing', stripLocale('/es/pricing') === '/pricing');
ok('stripLocale leaves EN alone', stripLocale('/pricing') === '/pricing');
// Must not eat a path that merely begins with "es".
ok('stripLocale /espanol untouched', stripLocale('/espanol') === '/espanol');

// --- redirect target: language preserved, and it must never point at a gated page ---
// Waitlist OPEN: gated marketing converts into the funnel.
ok('EN -> /join', gateRedirectPath('/', false) === '/join');
ok('EN -> /join from /pricing', gateRedirectPath('/pricing', false) === '/join');
ok('ES -> /es/join', gateRedirectPath('/es', false) === '/es/join');
ok('ES -> /es/join from /es/pricing', gateRedirectPath('/es/pricing', false) === '/es/join');
// Waitlist CLOSED: /join is gated, so the target MUST move to the holding page.
ok('EN -> /soon when closed', gateRedirectPath('/', true) === '/soon');
ok('EN -> /soon from /join', gateRedirectPath('/join', true) === '/soon');
ok('ES -> /es/soon when closed', gateRedirectPath('/es', true) === '/es/soon');
ok('ES -> /es/soon from /es/join', gateRedirectPath('/es/join', true) === '/es/soon');
// And the target of a redirect must itself be reachable, in both languages, in every mode.
for (const [name, mode] of [
  ['site-dark', SITE_DARK],
  ['blackout', BLACKOUT],
]) {
  for (const from of ['/', '/es', '/pricing', '/es/pricing', '/join', '/es/join']) {
    const to = gateRedirectPath(from, mode.waitlistClosed);
    ok(`${name}: ${from} -> ${to} is not itself gated`, isGatedPath(to, mode) === false);
  }
}

// --- both switches default OFF, so shipping the code cannot dark anything by itself ---
ok('site off when unset', isPrelaunchEnabled({}) === false);
ok('site off when empty', isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: '' }) === false);
ok('site off when 0', isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: '0' }) === false);
ok('waitlist off when unset', isWaitlistClosed({}) === false);
ok('waitlist off when empty', isWaitlistClosed({ PRELAUNCH_WAITLIST_CLOSED: '' }) === false);
ok('waitlist off when 0', isWaitlistClosed({ PRELAUNCH_WAITLIST_CLOSED: '0' }) === false);
for (const v of ['1', 'on', 'true', 'yes', 'ON', ' True ']) {
  ok(`site on when ${JSON.stringify(v)}`, isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: v }) === true);
  ok(
    `waitlist on when ${JSON.stringify(v)}`,
    isWaitlistClosed({ PRELAUNCH_WAITLIST_CLOSED: v }) === true,
  );
}
// The switches must not read each other's variable.
ok('site flag ignores waitlist var', isPrelaunchEnabled({ PRELAUNCH_WAITLIST_CLOSED: '1' }) === false);
ok('waitlist flag ignores site var', isWaitlistClosed({ PRELAUNCH_HIDE_SITE: '1' }) === false);

// --- preview bypass FAILS CLOSED with no token configured ---
ok('no bypass without token', hasPreviewAccess('anything', {}) === false);
ok('no bypass on empty token', hasPreviewAccess('', { PRELAUNCH_PREVIEW_TOKEN: '' }) === false);
const env = { PRELAUNCH_PREVIEW_TOKEN: 's3cret' };
ok('bypass on exact match', hasPreviewAccess('s3cret', env) === true);
ok('no bypass on wrong value', hasPreviewAccess('nope', env) === false);
ok('no bypass on undefined cookie', hasPreviewAccess(undefined, env) === false);
ok(
  'query token accepted',
  presentedPreviewToken(new URLSearchParams('preview=s3cret'), env) === 's3cret',
);
ok('wrong query token rejected', presentedPreviewToken(new URLSearchParams('preview=x'), env) === null);
ok('no query token -> null', presentedPreviewToken(new URLSearchParams(''), env) === null);
ok(
  'query token ignored with no env token',
  presentedPreviewToken(new URLSearchParams('preview=s3cret'), {}) === null,
);

console.log(`prelaunch gate: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
