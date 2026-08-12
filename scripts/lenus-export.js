// FULL LENUS EXPORT. Paste this whole file into the browser console on us.lenus.io.
//
// ============================== HOW TO RUN ==============================
//  1. Log in to https://us.lenus.io and open ANY client (that one page load teaches the script
//     every GraphQL query it needs; see "why" below).
//  2. Open the console and paste this entire file.
//  3. It asks for the migration token once. Paste the value of LENUS_INGEST_TOKEN.
//  4. It prints progress every client. Leave the tab open and awake.
//  5. Re-run it any time. Clients already stored are skipped, so an interrupted run resumes.
//
//     lenusExport.progress()   how far along
//     lenusExport.stop()       stop after the current client
//     lenusExport.retry()      re-attempt only the failures
// ========================================================================
//
// WHY IT HAS TO RUN HERE, IN THIS TAB, BY HAND
//
// Lenus authenticates with an httpOnly cookie. The identical request with credentials:'omit' comes
// back 400 "Not allowed to access private schema fields", so no script, cron or server outside a
// logged-in browser tab can ever call their API. The four x-lenus-* headers are required but do not
// authenticate.
//
// And their CSP restricts connect-src to their own origin, so this tab cannot fetch out either. A
// CORS-open third party (api.github.com) is blocked too, which is how we know it is CSP and not a
// missing header. Popups are blocked, downloads are silently dropped. `form-action` is a SEPARATE
// directive that they do NOT restrict, so a form POST into a hidden iframe is the one way out. It
// must target https: an https page cannot post to http://localhost under mixed content.
//
// RAW CAPTURE FIRST, MAPPING SECOND. The network pass against an account we lose on 31 August is the
// part that cannot be repeated. Turning JSON into rows can be redone any evening. So this stores
// every response verbatim in lenus.raw_client_extract, whose primary key is UNIQUE on
// (profile_id, operation) and therefore upserts on a re-run.
//
// TWO THINGS THIS GOT WRONG, FIXED 2026-08-12. Both were silent, which is the point.
//
//  1. IT PAGINATES NOW. Every operation replayed the variables the UI recorded, and the UI asks
//     ClientWorkoutHistory for pageSize 3. Because the ingest upserts on (profile_id, operation),
//     the row is REPLACED, so running this over the existing extract would have turned one client's
//     482 complete workouts into the 3 most recent. The re-run was the risk, not the original pull.
//     Page size is raised to 200 (confirmed accepted) and offsets loop to exhaustion. The ingest
//     route now also refuses a write that shrinks a stored payload, as a second line of defence.
//
//  2. CHECK-IN BODIES ARE FETCHED NOW. ClientCheckinDashboardView_checkInResponse takes a CHECK-IN
//     RESPONSE id, not a profile id, and the old resolver matched its `id` variable against the
//     profile-id list. It sent the profile id, Lenus errored, the error became null and the
//     operation was dropped without a word, for all 265 clients. The list operation stored 765
//     response IDs and not one body, which is why her portal shows 2 check-ins for 1 person. The
//     bodies are now fetched per id and stored as an array under the same operation name.
//
// The pagination and fan-out logic is covered by .qa-visual/lenus-export-test.mjs (22 assertions
// against a mock Lenus). Run it before pasting this anywhere: there is no second attempt at this
// account, so the logic is proven in Node first.

(() => {
  const INGEST = 'https://www.teamthickandfit.com/api/internal/lenus-ingest';

  // The 30 operations that carry client data. The app issues 66; the rest are feature flags, coach
  // settings and UI plumbing that say nothing about a client.
  const OPS = [
    'ClientPageQuery', 'FetchProfile', 'InfoSectionQuery', 'LoadClientInfo', 'OverviewSection_Profile',
    'MembershipOverviewQuery', 'PaymentsOverview_Payments', 'fetchClientChart', 'ClientMeasurements_Profile',
    'ClientInfoCheckinsContext_CheckInResponses', 'ClientCheckinDashboardView_checkInResponse',
    'HealthAssessmentFormResults', 'ClientWorkoutHistory', 'WorkoutSection_ProfileData',
    'UseFetchFoodDiaryOverview_FoodDiary', 'FetchMealPlan', 'LoadMealPlanMeals',
    'TinyHabitOverview_TinyHabitMetadata', 'TinyHabitsOverview_TinyHabitsCoach',
    'FitnessPackageCoachFiles_FILES', 'ProfileHistory_Profile', 'getFitnessPackageProfileData',
    'UseCheckInCycleTracker_menstrualCycle', 'LessonsCard_Lessons', 'TrackingGoalCoachQuery',
    'LeadInfoSection_Data', 'ClientReminders_Profile', 'clientPeriodWeeksQuery',
    'LinkedProfileDetailsQuery', 'TrainingBuilderPanelContext_WorkoutPlans',
  ];
  // Keys that carry a PROFILE id. `id` is deliberately NOT in this list, it is in the fallback
  // below, and that separation is the fix for the biggest hole in the export.
  //
  // ClientCheckinDashboardView_checkInResponse takes a CHECK-IN RESPONSE id in a variable named
  // `id`. The old resolver matched `id` in one flat list, so it sent the PROFILE id, Lenus answered
  // with an error, gql() turned that into null, and `if (d)` dropped the operation silently for all
  // 265 clients. That is exactly why raw_client_extract holds 765 check-in response IDs while
  // form_responses holds 2 rows for 1 person: the list was captured and the bodies never were.
  // Check-ins are what she reviews weekly, so this was the most expensive silent failure in the run.
  const PROFILE_KEYS = ['profileId', 'clientId', 'userId', 'profileID', 'profileIds'];
  // Used only when an operation has no explicit profile key AND is not a fan-out. Several
  // operations really do name the profile `id`, so it stays available, just no longer first.
  const PROFILE_FALLBACK_KEYS = ['id'];

  // Operations that fan out over ids harvested from ANOTHER operation's response instead of taking
  // a profile id. The list gives you {id, submittedAt}; the body needs a second call per id.
  const FANOUT = {
    ClientCheckinDashboardView_checkInResponse: { source: 'ClientInfoCheckinsContext_CheckInResponses', max: 500 },
  };

  // Pagination. The UI asks for what fits on screen, which for ClientWorkoutHistory is pageSize 3.
  // Replaying the recorded variables verbatim therefore fetches 3 rows and, because the ingest
  // upserts on (profile_id, operation), OVERWRITES the 482 complete rows already stored. Raising
  // the page size is not an optimisation here, it is what stops the re-run destroying good data.
  // 200 is confirmed accepted by the API.
  const PAGE = 200;
  const MAX_PAGES = 60; // 12,000 rows for one client and one operation, far past any real client
  const LIMIT_KEYS = ['pageSize', 'limit', 'first', 'take'];
  const OFFSET_KEYS = ['offset', 'skip', 'page'];
  const THROTTLE_MS = 120; // this is her live account, not a load test

  const S = {
    recipes: {}, headers: null, roster: [],
    done: {}, failed: {}, running: false, stop: false, token: null, shrunk: {},
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- 1. Learn the queries by watching the app issue them -------------------------------------
  // The 3 July export saved responses but NOT the query documents, which is exactly why it could
  // never be re-run. Recording the request is what makes this repeatable.
  function record(body, headers) {
    if (typeof body !== 'string') return;
    let parsed; try { parsed = JSON.parse(body); } catch { return; }
    for (const op of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!op || !op.query || /^\s*mutation/.test(String(op.query).trim())) continue;
      const name = op.operationName || 'anon';
      const prev = S.recipes[name];
      S.recipes[name] = {
        operationName: name, query: op.query, variables: op.variables || {},
        variableKeys: [...new Set([...(prev ? prev.variableKeys : []), ...Object.keys(op.variables || {})])],
      };
    }
    const keep = /^(x-lenus-|x-client-|content-type|accept)/i;
    const out = {};
    const put = (k, v) => { if (keep.test(k)) out[String(k).toLowerCase()] = String(v); };
    if (headers instanceof Headers) headers.forEach((v, k) => put(k, v));
    else if (Array.isArray(headers)) headers.forEach(([k, v]) => put(k, v));
    else if (headers) Object.entries(headers).forEach(([k, v]) => put(k, v));
    if (Object.keys(out).length) S.headers = { ...(S.headers || {}), ...out };
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      if (url && /graphql/i.test(url)) {
        record(init && typeof init.body === 'string' ? init.body : null, (init && init.headers) || (input && input.headers));
      }
    } catch { /* never break the app: a thrown interceptor logs her out mid-run */ }
    return origFetch.apply(this, arguments);
  };

  // ---- 2. Replay one operation ------------------------------------------------------------------
  async function gql(name, vars) {
    const r = S.recipes[name];
    if (!r) return null;
    await sleep(THROTTLE_MS);
    const res = await fetch('/graphql?operationName=' + encodeURIComponent(name), {
      method: 'POST', credentials: 'include', headers: S.headers,
      body: JSON.stringify({ operationName: name, query: r.query, variables: { ...r.variables, ...vars } }),
    });
    const j = await res.json();
    return j.errors ? null : j.data;
  }

  // Which variable carries the profile id for this operation, if any.
  function profileVars(r, pid) {
    let key = r.variableKeys.find((k) => PROFILE_KEYS.includes(k));
    if (!key && !FANOUT[r.operationName]) key = r.variableKeys.find((k) => PROFILE_FALLBACK_KEYS.includes(k));
    if (!key) return {};
    return { [key]: key === 'profileIds' ? [pid] : pid };
  }

  // Lenus states pagination two ways: flat ({ profileId, pageSize, offset }) and nested
  // ({ input: { limit, offset } }). Find whichever shape this operation actually recorded.
  function pagePath(r) {
    const find = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
      const keys = Object.keys(obj);
      const limitKey = keys.find((k) => LIMIT_KEYS.includes(k));
      const offsetKey = keys.find((k) => OFFSET_KEYS.includes(k));
      return limitKey && offsetKey ? { limitKey, offsetKey } : null;
    };
    const flat = find(r.variables);
    if (flat) return { container: null, ...flat };
    for (const [k, v] of Object.entries(r.variables || {})) {
      const nested = find(v);
      if (nested) return { container: k, ...nested };
    }
    return null;
  }

  function pageVars(r, base, index) {
    const p = pagePath(r);
    if (!p) return null;
    // `page` counts pages, `offset`/`skip` count rows. Getting this backwards silently re-fetches
    // page zero forever, which looks like a complete run and stores one page.
    const offsetVal = p.offsetKey === 'page' ? index : index * PAGE;
    if (!p.container) return { ...base, [p.limitKey]: PAGE, [p.offsetKey]: offsetVal };
    return {
      ...base,
      [p.container]: {
        ...((r.variables || {})[p.container] || {}),
        ...((base || {})[p.container] || {}),
        [p.limitKey]: PAGE,
        [p.offsetKey]: offsetVal,
      },
    };
  }

  // Concatenate arrays across pages, keep the last scalar (fullCount and friends are the same on
  // every page anyway). Shapes are identical page to page, so a structural merge is safe.
  function mergePages(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const out = { ...a };
      for (const k of Object.keys(b)) out[k] = k in out ? mergePages(out[k], b[k]) : b[k];
      return out;
    }
    return b === undefined || b === null ? a : b;
  }

  function dedupeById(node) {
    if (Array.isArray(node)) {
      const seen = new Set();
      const out = [];
      for (const item of node) {
        const id = item && typeof item === 'object' ? item.id : undefined;
        if (id !== undefined && id !== null) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        out.push(dedupeById(item));
      }
      return out;
    }
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = dedupeById(v);
      return out;
    }
    return node;
  }

  // Longest array anywhere in the payload, used as "how many rows did this page return".
  function biggestArray(node) {
    let max = 0;
    const walk = (n) => {
      if (Array.isArray(n)) { if (n.length > max) max = n.length; n.forEach(walk); }
      else if (n && typeof n === 'object') Object.values(n).forEach(walk);
    };
    walk(node);
    return max;
  }

  async function fetchAll(name, base) {
    const r = S.recipes[name];
    if (!pageVars(r, base, 0)) return gql(name, base); // not a paged operation
    let acc = null;
    for (let i = 0; i < MAX_PAGES; i++) {
      const d = await gql(name, pageVars(r, base, i));
      if (!d) break;
      acc = acc === null ? d : mergePages(acc, d);
      if (biggestArray(d) < PAGE) break; // a short page is the last page
    }
    return acc === null ? null : dedupeById(acc);
  }

  // Rows that carry an id and a timestamp are the records worth fetching bodies for.
  function harvestIds(node) {
    const ids = [];
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      const keys = Object.keys(n);
      const dated = keys.some((k) => /^(submitted|created|completed|answered)(_?at)$|^date$/i.test(k));
      if (n.id && dated) ids.push(n.id);
      Object.values(n).forEach(walk);
    };
    walk(node);
    return [...new Set(ids)];
  }

  async function pull(pid) {
    const out = {};
    for (const name of OPS) {
      const r = S.recipes[name];
      if (!r || FANOUT[name]) continue; // fan-outs need their source response first
      try {
        const d = await fetchAll(name, profileVars(r, pid));
        if (d) out[name] = d;
      } catch { /* one bad operation must not cost the other 29 */ }
    }

    // Second pass: the per-record bodies. Stored as an ARRAY of bodies under the operation name.
    // Nothing downstream depends on the old shape, because this operation has never once returned
    // a row.
    for (const [name, cfg] of Object.entries(FANOUT)) {
      const r = S.recipes[name];
      if (!r || !out[cfg.source]) continue;
      const idVar = r.variableKeys.find((k) => !PROFILE_KEYS.includes(k)) || 'id';
      const ids = harvestIds(out[cfg.source]).slice(0, cfg.max);
      const bodies = [];
      for (const id of ids) {
        try {
          const d = await gql(name, { [idVar]: id });
          if (d) bodies.push(d);
        } catch { /* one unreadable check-in must not cost the rest */ }
      }
      if (bodies.length) out[name] = bodies;
      // Say it out loud when the fan-out found ids and got nothing back. The whole reason this hole
      // survived a month is that it failed silently.
      if (ids.length && !bodies.length) console.warn(`  ${name}: ${ids.length} ids, 0 bodies (variable "${idVar}" may be wrong)`);
    }
    return out;
  }

  // ---- 3. The only way out: form POST into a hidden iframe ---------------------------------------
  let seq = 0;
  function post(payload) {
    return new Promise((resolve) => {
      const name = '__ing' + seq++;
      const f = document.createElement('iframe');
      f.name = name; f.style.display = 'none'; document.body.appendChild(f);
      const form = document.createElement('form');
      form.method = 'POST'; form.action = INGEST; form.target = name; form.enctype = 'text/plain';
      const i = document.createElement('input');
      i.name = 'payload'; i.value = JSON.stringify(payload);
      form.appendChild(i); document.body.appendChild(form);
      let settled = false;
      const done = (ok) => { if (settled) return; settled = true; form.remove(); setTimeout(() => f.remove(), 500); resolve(ok); };
      f.addEventListener('load', () => done(true));
      setTimeout(() => done(false), 30000); // one stuck POST must not hang the sweep
      try { form.submit(); } catch { done(false); }
    });
  }

  // ---- 4. The roster, from Lenus rather than from our database ----------------------------------
  // Our copy is the thing that is stale. A client we never imported is exactly the one not to skip:
  // Shanya Bulgin signed up 4 Aug and was in no table of ours at all.
  async function loadRoster() {
    const r = S.recipes['useClientListInfiniteScrolling_clientList'];
    if (!r) throw new Error('Open a client page first so the script can learn the queries.');
    const seen = new Map();
    for (let offset = 0; offset < 2000; offset += 100) {
      const d = await gql('useClientListInfiniteScrolling_clientList', {
        ...r.variables, offset, limit: 100, withMessages: false, filter: { and: [{ and: [] }] },
      });
      const list = (d && d.clientAudience && d.clientAudience.clientList) || [];
      for (const c of list) if (c.profile && c.profile.id) seen.set(c.profile.id, c.profile.fullName);
      if (list.length < 100) break;
    }
    S.roster = [...seen.entries()].map(([id, name]) => ({ id, name }));
    return S.roster.length;
  }

  async function sweep() {
    if (S.running) return 'already running';
    if (!S.token) { console.error('No token. Run lenusExport.start() first.'); return 'no token'; }
    S.running = true; S.stop = false;
    const t0 = Date.now();
    for (let n = 0; n < S.roster.length; n++) {
      if (S.stop) break;
      const c = S.roster[n];
      if (S.done[c.id]) continue;
      try {
        const ops = await pull(c.id);
        const count = Object.keys(ops).length;
        if (!count) { S.failed[c.id] = 'no-ops'; continue; }
        const ok = await post({ token: S.token, profileId: c.id, fullName: c.name, operations: ops });
        if (ok) { S.done[c.id] = count; delete S.failed[c.id]; }
        else S.failed[c.id] = 'post-failed';
      } catch (e) { S.failed[c.id] = String(e).slice(0, 60); }
      const d = Object.keys(S.done).length;
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`${d}/${S.roster.length} · ${c.name} · ${mins}m elapsed` + (Object.keys(S.failed).length ? ` · ${Object.keys(S.failed).length} failed` : ''));
    }
    S.running = false;
    console.log(`DONE. ${Object.keys(S.done).length} stored, ${Object.keys(S.failed).length} failed.`);
    if (Object.keys(S.failed).length) console.log('failed:', S.failed);
    return 'finished';
  }

  window.lenusExport = {
    async start() {
      const t = window.prompt('Paste LENUS_INGEST_TOKEN');
      if (!t) return 'cancelled';
      S.token = t.trim();
      console.log('Loading the client roster from Lenus...');
      const n = await loadRoster();
      console.log(`${n} clients. Starting. Leave this tab open and awake.`);
      return sweep();
    },
    resume: sweep,
    async retry() { for (const id of Object.keys(S.failed)) delete S.failed[id]; return sweep(); },
    stop() { S.stop = true; return 'stopping after the current client'; },
    progress: () => ({ done: Object.keys(S.done).length, failed: Object.keys(S.failed).length, total: S.roster.length, running: S.running }),
    state: S,
    // Test surface. This runs once, by hand, against an account that closes on 31 August, so the
    // pagination and fan-out logic is exercised in Node first: .qa-visual/lenus-export-test.mjs.
    _internals: { pull, fetchAll, pageVars, pagePath, mergePages, dedupeById, harvestIds, profileVars, biggestArray },
  };

  console.log('%cLenus export ready.', 'font-weight:bold');
  console.log('Open a client page if you have not, then run:  lenusExport.start()');
})();
