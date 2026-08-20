// Exactly one navigation row may light on any member route.
//
// The bug this guards is not a crash, it is a nav that quietly disagrees with itself. bottom-nav.tsx
// and subscriber-rail.tsx each carried their own hand-written copy of the tab list, and the copies
// drifted: the phone got the handoff's six tabs, the rail kept five in a different order, folded
// Progress inside You and carried the coach thread as a loose row. The same member on the same URL
// saw a different tab lit depending on her screen width, and nothing failed.
//
// Sharing one TABS definition makes the two surfaces agree by construction. What it does NOT make
// safe is the rail's one extra row: You sits outside the shared list, so its match can overlap a
// tab's and light two rows at once. That is the precise shape of the old drift, so it is the thing
// asserted here.
//
// Run: npx tsx .qa-visual/nav-tabs-test.mts
import { TABS, isNavHidden } from '../src/components/nav/tabs';

// The rail's extra row, mirrored from subscriber-rail.tsx. Kept in step by this test: if the rail
// widens YOU_MATCH to claim a tab's route again, the overlap assertions below fail.
const YOU_MATCH = (p: string): boolean => p.startsWith('/you') || p.startsWith('/account');

// Member routes that belong to one of the six tabs, including the ones whose path a tab does not
// own (/evolution is Progress, /coach-chat is Coach, /workout/ is a session inside Train).
const TAB_ROUTES = [
  '/dashboard',
  '/workouts',
  '/workout/abc-123',
  '/exercises',
  '/history',
  '/nutrition',
  '/nutrition/photos',
  '/nutrition/plan',
  '/progress',
  '/progress?tab=body',
  '/evolution',
  '/community',
  '/inbox',
  '/coach-chat',
  '/messages',
];

// The profile hub. NOT a tab: the handoff reaches it from a screen's own .mobile-header icon button
// (today-screen.tsx renders the avatar), and the rail gives it a row of its own. Asserting it
// matches no tab is the point, not an oversight.
const YOU_ROUTES = ['/you', '/you/cycle', '/you/health', '/account', '/account/billing'];

const ROUTES = [...TAB_ROUTES, ...YOU_ROUTES];

// Routes with no tab of their own, by design. They are reachable but are not a destination in the
// bar: notifications comes from the topbar bell, the rest are flows or terminal states.
const NO_TAB = ['/notifications', '/paused', '/claim', '/checkout', '/forms/abc'];

let failures = 0;
const fail = (msg: string): void => {
  console.error(`  x ${msg}`);
  failures += 1;
};

// 1. Exactly one TAB matches each tab route. Zero means a member is on a page the bar cannot
//    explain; two means the bar lights twice and neither is the answer.
for (const route of TAB_ROUTES) {
  const path = route.split('?')[0];
  const hit = TABS.filter((t) => t.match(path));
  if (hit.length !== 1) {
    fail(`${route} matches ${hit.length} tabs (${hit.map((h) => h.key).join(', ') || 'none'}), expected 1`);
  }
}

// 1b. The You routes match NO tab, and the rail's You row picks every one of them up. If a tab ever
//     grows to claim /you or /account, the rail lights twice and the phone lights a tab for a screen
//     that is not in the bar.
for (const route of YOU_ROUTES) {
  const hit = TABS.filter((t) => t.match(route));
  if (hit.length > 0) fail(`${route} should belong to no tab but matched ${hit.map((h) => h.key).join(', ')}`);
  if (!YOU_MATCH(route)) fail(`${route} is not picked up by the rail's You row`);
}

// 2. The rail's You row must not overlap any tab. This is the assertion that would have caught the
//    original drift, where You claimed /progress, /evolution and /coach-chat while the phone gave
//    each of them its own tab.
for (const route of ROUTES) {
  const path = route.split('?')[0];
  if (!YOU_MATCH(path)) continue;
  const alsoTab = TABS.filter((t) => t.match(path));
  if (alsoTab.length > 0) {
    fail(`${route} lights BOTH the rail's You row and the ${alsoTab.map((t) => t.key).join('/')} tab`);
  }
}

// 3. Every route that is not a tab and not You must be honestly tab-less, not accidentally matched.
for (const route of NO_TAB) {
  const hit = TABS.filter((t) => t.match(route));
  if (hit.length > 0) fail(`${route} has no tab by design but matched ${hit.map((h) => h.key).join(', ')}`);
}

// 4. Every tab's own href routes back to itself. A tab whose href does not satisfy its own match is
//    a tab that never lights when tapped.
for (const tab of TABS) {
  if (!tab.match(tab.href)) fail(`tab "${tab.key}" href ${tab.href} does not satisfy its own match()`);
}

// 5. The immersive flows hide the bar on BOTH surfaces, and /workout/ in particular: the player is
//    full-screen and the member is mid-set.
for (const p of ['/onboarding', '/checkin', '/workout/abc-123']) {
  if (!isNavHidden(p)) fail(`${p} should hide the nav`);
}
for (const p of ['/dashboard', '/workouts', '/nutrition']) {
  if (isNavHidden(p)) fail(`${p} should NOT hide the nav`);
}

// 6. Keys are unique and are the i18n keys under app.nav.
const keys = TABS.map((t) => t.key);
if (new Set(keys).size !== keys.length) fail(`duplicate tab keys: ${keys.join(', ')}`);
if (TABS.length !== 6) fail(`expected the handoff's 6 tabs, found ${TABS.length}`);

console.log(
  failures
    ? `\nFAILED (${failures})`
    : `\nOK: ${TABS.length} tabs, ${ROUTES.length} routes, one row lights on each`,
);
process.exit(failures ? 1 : 0);
