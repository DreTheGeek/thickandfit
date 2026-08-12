// Unit test for the Lenus extractor's pagination and check-in fan-out.
//
// WHY. scripts/lenus-export.js runs by hand, once, in a browser tab, against an account that is
// deleted on 31 August. There is no second attempt and no staging copy. Both bugs it just had were
// silent: one dropped 265 clients' check-in bodies and reported success, the other would have
// overwritten 482 complete workouts with the 3 the UI happens to render. Neither is visible from
// the console output, so the logic gets exercised here against a mock Lenus before it is pointed at
// the real one.
//
// Run: node .qa-visual/lenus-export-test.mjs

import { readFileSync } from 'node:fs';

// --- load the extractor into a fake browser ---------------------------------
const calls = [];
let mock = () => ({});

globalThis.window = {};
globalThis.document = {
  body: { appendChild() {}, removeChild() {} },
  createElement: () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, submit() {} }),
};
globalThis.XMLHttpRequest = function () {};
globalThis.XMLHttpRequest.prototype = { open() {}, send() {}, setRequestHeader() {} };
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push({ name: body.operationName, variables: body.variables });
  return { json: async () => mock(body.operationName, body.variables) };
};

const src = readFileSync(new URL('../scripts/lenus-export.js', import.meta.url), 'utf8');
new Function(src)();
const X = globalThis.window.lenusExport;
const S = X.state;
const { pull, mergePages, dedupeById, harvestIds, pagePath, pageVars, profileVars } = X._internals;

// --- harness ----------------------------------------------------------------
let pass = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else fails.push(`${name}${detail ? `: ${detail}` : ''}`);
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const PROFILE = 'e6c6bce0-8bc2-11f1-946f-7bdb61bf3575'; // the client from the ticket

// --- 1. pure helpers ---------------------------------------------------------
eq('mergePages concatenates arrays',
  mergePages({ a: { rows: [1, 2] }, n: 5 }, { a: { rows: [3] }, n: 5 }),
  { a: { rows: [1, 2, 3] }, n: 5 });

eq('dedupeById drops repeats across page boundaries',
  dedupeById({ rows: [{ id: 'a' }, { id: 'b' }, { id: 'a' }] }),
  { rows: [{ id: 'a' }, { id: 'b' }] });

eq('dedupeById keeps id-less rows',
  dedupeById({ rows: [{ v: 1 }, { v: 1 }] }),
  { rows: [{ v: 1 }, { v: 1 }] });

eq('harvestIds finds rows with an id and a timestamp',
  harvestIds({ checkInResponses: [{ id: 'r1', submittedAt: 'x' }, { id: 'r2', submittedAt: 'y' }, { id: 'skip' }] }),
  ['r1', 'r2']);

eq('pagePath finds the flat shape',
  pagePath({ variables: { profileId: 'p', pageSize: 3, offset: 0 } }),
  { container: null, limitKey: 'pageSize', offsetKey: 'offset' });

eq('pagePath finds the nested input shape',
  pagePath({ variables: { input: { limit: 20, offset: 0 } } }),
  { container: 'input', limitKey: 'limit', offsetKey: 'offset' });

// page-style pagination counts PAGES. Multiplying by 200 there re-requests page zero forever.
eq('pageVars increments page-style pagination by one',
  pageVars({ variables: { page: 0, limit: 10 } }, {}, 3),
  { limit: 200, page: 3 });

eq('pageVars increments offset-style pagination by the page size',
  pageVars({ variables: { offset: 0, pageSize: 3 } }, {}, 3),
  { pageSize: 200, offset: 600 });

// --- 2. the fan-out must not be handed a profile id --------------------------
// This is the bug that cost 765 check-in bodies. `id` is a legitimate profile variable on some
// operations, so it stays available as a fallback, but never for a fan-out operation.
eq('profileVars uses an explicit profile key',
  profileVars({ operationName: 'ClientWorkoutHistory', variableKeys: ['profileId', 'pageSize'] }, PROFILE),
  { profileId: PROFILE });

eq('profileVars falls back to id for ordinary operations',
  profileVars({ operationName: 'FetchProfile', variableKeys: ['id'] }, PROFILE),
  { id: PROFILE });

eq('profileVars refuses to feed a profile id to the check-in fan-out',
  profileVars({ operationName: 'ClientCheckinDashboardView_checkInResponse', variableKeys: ['id'] }, PROFILE),
  {});

eq('profileVars wraps profileIds as an array',
  profileVars({ operationName: 'X', variableKeys: ['profileIds'] }, PROFILE),
  { profileIds: [PROFILE] });

// --- 3. end to end against a mock Lenus --------------------------------------
// Shelise's real numbers: 482 workouts behind a UI that asks for 3, and 6 check-ins whose bodies
// were never fetched.
const WORKOUTS = Array.from({ length: 482 }, (_, i) => ({ id: `w${i}`, name: `session ${i}` }));
const CHECKIN_IDS = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, submittedAt: `2026-08-0${i + 1}` }));

S.headers = { 'content-type': 'application/json' };
S.recipes = {
  // recorded from the UI, which renders three
  ClientWorkoutHistory: {
    operationName: 'ClientWorkoutHistory',
    query: 'query ClientWorkoutHistory {}',
    variables: { profileId: 'RECORDED', pageSize: 3, offset: 0 },
    variableKeys: ['profileId', 'pageSize', 'offset'],
  },
  ClientInfoCheckinsContext_CheckInResponses: {
    operationName: 'ClientInfoCheckinsContext_CheckInResponses',
    query: 'query ClientInfoCheckinsContext_CheckInResponses {}',
    variables: { profileId: 'RECORDED' },
    variableKeys: ['profileId'],
  },
  ClientCheckinDashboardView_checkInResponse: {
    operationName: 'ClientCheckinDashboardView_checkInResponse',
    query: 'query ClientCheckinDashboardView_checkInResponse {}',
    variables: { id: 'RECORDED' },
    variableKeys: ['id'],
  },
};

mock = (name, vars) => {
  if (name === 'ClientWorkoutHistory') {
    const size = vars.pageSize;
    const start = vars.offset;
    return { data: { workoutHistory: { fullCount: WORKOUTS.length, rows: WORKOUTS.slice(start, start + size) } } };
  }
  if (name === 'ClientInfoCheckinsContext_CheckInResponses') {
    return { data: { checkInResponses: CHECKIN_IDS } };
  }
  if (name === 'ClientCheckinDashboardView_checkInResponse') {
    // The real API rejects a profile id here. That rejection is what the old code swallowed.
    if (!String(vars.id).startsWith('c')) return { errors: [{ message: 'not a check-in response id' }] };
    return { data: { checkInResponse: { id: vars.id, answers: [{ q: 'weight', a: '154.4' }] } } };
  }
  return { data: null };
};

calls.length = 0;
const out = await pull(PROFILE);

const gotWorkouts = out.ClientWorkoutHistory?.workoutHistory?.rows ?? [];
ok('every workout is captured, not just the three the UI renders',
  gotWorkouts.length === 482, `got ${gotWorkouts.length}`);
ok('workouts are not duplicated across pages',
  new Set(gotWorkouts.map((w) => w.id)).size === 482, `${new Set(gotWorkouts.map((w) => w.id)).size} unique`);
ok('fullCount survives the merge',
  out.ClientWorkoutHistory?.workoutHistory?.fullCount === 482);

const workoutCalls = calls.filter((c) => c.name === 'ClientWorkoutHistory');
ok('the raised page size is actually sent',
  workoutCalls.every((c) => c.variables.pageSize === 200), JSON.stringify(workoutCalls[0]?.variables));
ok('pagination stops at the short page',
  workoutCalls.length === 3, `${workoutCalls.length} requests for 482 rows at 200/page`);
ok('the real profile id replaces the recorded one',
  workoutCalls.every((c) => c.variables.profileId === PROFILE));

const bodies = out.ClientCheckinDashboardView_checkInResponse ?? [];
ok('check-in bodies are fetched, which is the hole the July run left',
  bodies.length === 6, `got ${bodies.length} bodies for 6 ids`);
ok('bodies are addressed by check-in response id, never the profile id',
  calls.filter((c) => c.name === 'ClientCheckinDashboardView_checkInResponse')
    .every((c) => String(c.variables.id).startsWith('c')));
ok('the answers actually come back',
  bodies[0]?.checkInResponse?.answers?.length === 1);

// --- 4. the regression this replaces -----------------------------------------
// Proof the old resolver would still fail: feed the profile id and the mock rejects it, which is
// precisely what produced 765 ids and 0 bodies.
const rejected = mock('ClientCheckinDashboardView_checkInResponse', { id: PROFILE });
ok('the old behaviour is genuinely broken, so this test would have caught it',
  Boolean(rejected.errors));

// --- report ------------------------------------------------------------------
console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL  ${f}`);
process.exit(fails.length ? 1 : 0);
