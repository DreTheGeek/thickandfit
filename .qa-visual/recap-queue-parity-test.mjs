// Guards the one hazard the recap's client queues introduced: restated definitions drifting.
//
// WHY THIS EXISTS. supabase/functions/ops-bot/recap.ts cannot import from src/. The ops bot lives in
// Supabase on purpose, so that a Vercel outage cannot silence the monitor, and that independence is
// worth more than code sharing. The cost is that the at-risk rule, the message window and the
// overdue line are written out a second time.
//
// src/lib/coach/attention.ts already records what that costs when it goes wrong: a hand-written copy
// of the at-risk rule counted 9 where the tile beside it read 39. Two numbers for one thing is worse
// than one number, and here the two readers are the console and the person reading a recap on a
// beach, which is the worst possible pair to disagree.
//
// So the copy is allowed, and drifting is not. This asserts the constants match their sources.
//
// Run: node .qa-visual/recap-queue-parity-test.mjs

import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const recap = read('supabase/functions/ops-bot/recap.ts');
const overview = read('src/lib/coach/overview.ts');
const awaiting = read('src/lib/coach/awaiting-program.ts');
const attention = read('src/lib/coach/attention.ts');

let pass = 0;
const fails = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`${name}\n      recap: ${JSON.stringify(got)}\n      source: ${JSON.stringify(want)}`);
};

/** Members of a JS array/Set literal assigned to `name`, in source order. */
function members(src, name) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(?:new Set\\()?\\[([^\\]]*)\\]`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}
const numberOf = (src, name) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
};

// --- at-risk: the rule that has already drifted once in this codebase ---------
const recapStatus = members(recap, 'AT_RISK_STATUS');
const recapHealth = members(recap, 'AT_RISK_HEALTH');
const srcStatus = members(overview, 'AT_RISK_STATUS');
const srcHealth = members(overview, 'AT_RISK_HEALTH');

if (!recapStatus || !srcStatus) fails.push('could not read AT_RISK_STATUS from both files');
else eq('AT_RISK_STATUS matches src/lib/coach/overview.ts', recapStatus, srcStatus);

if (!recapHealth || !srcHealth) fails.push('could not read AT_RISK_HEALTH from both files');
else eq('AT_RISK_HEALTH matches src/lib/coach/overview.ts', recapHealth, srcHealth);

// --- the overdue line ---------------------------------------------------------
// The recap changes its wording at this number ("over the 3d line"), so a drift here means the
// beach report calls a broken promise a backlog, or the reverse.
const recapOverdue = numberOf(recap, 'OVERDUE_DAYS');
const srcOverdue = numberOf(awaiting, 'OVERDUE_DAYS');
if (recapOverdue === null || srcOverdue === null) fails.push('could not read OVERDUE_DAYS from both files');
else eq('OVERDUE_DAYS matches src/lib/coach/awaiting-program.ts', recapOverdue, srcOverdue);

// --- the unanswered-message window --------------------------------------------
// attention.ts writes it inline as `14 * 86_400_000` with the reasoning that older than that is not
// "unanswered", it is lost. The recap names it MSG_WINDOW_DAYS.
const recapWindow = numberOf(recap, 'MSG_WINDOW_DAYS');
const srcWindow = (() => {
  const m = attention.match(/client_messages[\s\S]{0,400}?Date\.now\(\)\s*-\s*(\d+)\s*\*\s*86_400_000/);
  return m ? Number(m[1]) : null;
})();
if (recapWindow === null || srcWindow === null) fails.push('could not read the message window from both files');
else eq('unanswered window matches src/lib/coach/attention.ts', recapWindow, srcWindow);

// --- the queues are actually reported -----------------------------------------
// Cheap regression guard: the whole point was that these four were missing from the recap. If a
// refactor drops one, this says so rather than the recap going quietly back to being clean.
for (const [label, needle] of [
  ['waiting on a program', /waiting on a program/],
  ['unanswered messages', /unanswered client message/],
  ['intake to review', /intake\$\{|intakeReview/],
  ['at risk', /at risk \(billing\)/],
]) {
  if (needle.test(recap)) pass++;
  else fails.push(`the recap no longer reports "${label}"`);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL  ${f}`);
process.exit(fails.length ? 1 : 0);
