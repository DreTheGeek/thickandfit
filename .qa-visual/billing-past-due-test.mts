// The past_due chain: which statuses route a member where, and which ones must never sell her a
// second subscription.
//
// This is the highest-consequence branch in the app that is not money-moving code itself. Getting it
// wrong in one direction double-bills a woman who is already being dunned; getting it wrong in the
// other locks a paying member out with a card-update button for a subscription she does not have.
// Neither failure raises an exception, and both look fine in a screenshot.
//
// Imports the REAL predicates from status-shared.ts, not a copy of the lists, so an edit to either
// constant fails here instead of drifting silently. The three lists are deliberately different and
// the test says why: LIVE_SUBSCRIPTION_STATUSES answers "would a second subscription double-bill
// her" and includes unpaid; isActiveStatus answers "render this as a live membership" and does not;
// isActiveEntitlementStatus answers "may she use the app" and excludes past_due.
//
// Run: npx tsx .qa-visual/billing-past-due-test.mts
import { readFileSync } from 'node:fs';
import {
  isActiveStatus,
  isActiveEntitlementStatus,
  routeForEntitlements,
  LIVE_SUBSCRIPTION_STATUSES,
} from '../src/lib/billing/status-shared';

let pass = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass += 1;
  else failures.push(`${name}\n    expected ${w}\n    got      ${g}`);
}

function ok(name: string, cond: boolean): void {
  if (cond) pass += 1;
  else failures.push(name);
}

const LIVE = LIVE_SUBSCRIPTION_STATUSES;

// --- checkout must refuse for anything that would double-bill -----------------
for (const s of ['trialing', 'active', 'past_due', 'unpaid', 'paused']) {
  ok(`checkout refuses when the existing subscription is ${s}`, LIVE.includes(s));
}
// A settled subscription is not a reason to block a new sale. Resubscribing after a cancellation is
// the flow working, and an incomplete session never became a subscription at all.
for (const s of ['canceled', 'incomplete', 'incomplete_expired']) {
  ok(`checkout still allowed after ${s}`, !LIVE.includes(s));
}
check('exactly five live statuses', LIVE.length, 5);

// --- the two lists are different ON PURPOSE -----------------------------------
ok('past_due counts as a live membership for rendering', isActiveStatus('past_due'));
ok('past_due blocks a second subscription', LIVE.includes('past_due'));
ok(
  'unpaid blocks a second subscription even though it renders as inactive',
  LIVE.includes('unpaid') && !isActiveStatus('unpaid'),
);
ok(
  'canceled is inactive AND sellable — the one status where both lists agree it is over',
  !isActiveStatus('canceled') && !LIVE.includes('canceled'),
);

// --- entitlement: past_due must never grant access ----------------------------
check('active grants', isActiveEntitlementStatus('active'), true);
check('trialing grants', isActiveEntitlementStatus('trialing'), true);
// The whole reason the card-update flow exists: past_due does not grant, so she IS locked out, so
// she needs somewhere to go that is not a second checkout.
check('past_due does NOT grant', isActiveEntitlementStatus('past_due'), false);
for (const s of ['canceled', 'expired', 'revoked', 'unpaid', 'paused', '']) {
  check(`${s || '(empty)'} does not grant`, isActiveEntitlementStatus(s), false);
}

// --- pastDueOnly routing table ------------------------------------------------
// pastDueOnly hits the database; routeForEntitlements is the decision it delegates to, and is what
// this section pins. The part a reader gets wrong is the last three cases: a member holding both a
// live grant and a stale past_due row is not a card problem.
const routes = routeForEntitlements;

check('a live member reaches the app', routes(['active']), 'app');
check('a trialing member reaches the app', routes(['trialing']), 'app');
check('a declined card goes to the card fix', routes(['past_due']), 'fixCard');
check('never subscribed goes to checkout', routes([]), 'checkout');
check('cancelled goes to checkout, not the card fix', routes(['canceled']), 'checkout');
check('expired goes to checkout', routes(['expired']), 'checkout');
check('revoked goes to checkout', routes(['revoked']), 'checkout');
// The case that makes pastDueOnly self-contained rather than order-dependent: an old failed grant
// alongside a working one must not raise a card alarm on a member who is paying fine.
check('live grant beside a stale past_due one reaches the app', routes(['past_due', 'active']), 'app');
check('two dead grants still go to checkout', routes(['canceled', 'expired']), 'checkout');
check('past_due beside a cancelled one is still a card fix', routes(['canceled', 'past_due']), 'fixCard');

// --- the renewal warning window she asked for ---------------------------------
const gen = readFileSync(new URL('../src/lib/notifications/generators.ts', import.meta.url), 'utf8');
const lead = Number(gen.match(/RENEWAL_LEAD_DAYS\s*=\s*(\d+)/)?.[1]);
check('renewal reminder fires 48 hours out', lead, 2);

// --- report -------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
