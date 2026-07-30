// Pre-launch gate test. Imports the REAL module (Node strips the TS types), so this exercises the
// shipped logic rather than a re-implementation of it.
//
// The stakes: this gate runs in the proxy in front of every request. A false positive hides the
// waitlist five days before it opens; a false negative leaves the site Rodney asked to hide in
// public view. Both directions are asserted below.
import {
  gateRedirectPath,
  hasPreviewAccess,
  isGatedPath,
  isPrelaunchEnabled,
  presentedPreviewToken,
  stripLocale,
} from '../src/lib/launch/prelaunch.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// --- HIDDEN: the marketing surface Rodney asked to take out of public view ---
for (const p of ['/', '/about', '/faq', '/pricing', '/vs/myfitnesspal', '/vs/fitia', '/vs']) {
  ok(`gated ${p}`, isGatedPath(p) === true);
}
// ...and their Spanish twins. Half this audience is Spanish-speaking; hiding only the EN pages
// would have left /es/pricing wide open.
for (const p of ['/es', '/es/about', '/es/faq', '/es/pricing']) {
  ok(`gated ${p}`, isGatedPath(p) === true);
}
// Trailing slashes must not slip through.
ok('gated /pricing/', isGatedPath('/pricing/') === true);

// --- LIVE: everything the Aug 4 waitlist and the running app depend on ---
const mustStayPublic = [
  '/join',
  '/join/thanks',
  '/join/quiz',
  '/es/join',
  '/es/join/thanks',
  '/terms',
  '/privacy',
  '/disclaimer',
  '/support',
  '/es/terms',
  '/es/privacy',
  '/api/funnel/signup',
  '/api/funnel/confirm',
  '/api/stripe/webhook',
  '/auth/callback',
  '/today',
  '/you',
  '/coach/clients',
  '/admin/waitlist',
];
for (const p of mustStayPublic) {
  ok(`NOT gated ${p}`, isGatedPath(p) === false);
}
// The nastiest false positive: a path that merely starts with a gated word.
ok('NOT gated /pricing-guide', isGatedPath('/pricing-guide') === false);
ok('NOT gated /aboutus', isGatedPath('/aboutus') === false);
ok('NOT gated /vsomething', isGatedPath('/vsomething') === false);
ok('NOT gated /join?ref=abc path', isGatedPath('/join') === false);

// --- locale stripping ---
ok('stripLocale /es -> /', stripLocale('/es') === '/');
ok('stripLocale /es/pricing', stripLocale('/es/pricing') === '/pricing');
ok('stripLocale leaves EN alone', stripLocale('/pricing') === '/pricing');
// Must not eat a path that merely begins with "es".
ok('stripLocale /espanol untouched', stripLocale('/espanol') === '/espanol');

// --- redirect target keeps the visitor in their language ---
ok('EN -> /join', gateRedirectPath('/') === '/join');
ok('EN -> /join from /pricing', gateRedirectPath('/pricing') === '/join');
ok('ES -> /es/join', gateRedirectPath('/es') === '/es/join');
ok('ES -> /es/join from /es/pricing', gateRedirectPath('/es/pricing') === '/es/join');

// --- the switch defaults OFF, so shipping the code cannot dark the site by itself ---
ok('off when unset', isPrelaunchEnabled({}) === false);
ok('off when empty', isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: '' }) === false);
ok('off when 0', isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: '0' }) === false);
for (const v of ['1', 'on', 'true', 'yes', 'ON', ' True ']) {
  ok(`on when ${JSON.stringify(v)}`, isPrelaunchEnabled({ PRELAUNCH_HIDE_SITE: v }) === true);
}

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
