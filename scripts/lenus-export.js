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
  const ID_KEYS = ['profileId', 'clientId', 'userId', 'profileID', 'id', 'profileIds'];

  const S = {
    recipes: {}, headers: null, roster: [],
    done: {}, failed: {}, running: false, stop: false, token: null,
  };

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
    const res = await fetch('/graphql?operationName=' + encodeURIComponent(name), {
      method: 'POST', credentials: 'include', headers: S.headers,
      body: JSON.stringify({ operationName: name, query: r.query, variables: { ...r.variables, ...vars } }),
    });
    const j = await res.json();
    return j.errors ? null : j.data;
  }

  async function pull(pid) {
    const out = {};
    for (const name of OPS) {
      const r = S.recipes[name];
      if (!r) continue;
      const key = r.variableKeys.find((k) => ID_KEYS.includes(k));
      const vars = key ? { [key]: key === 'profileIds' ? [pid] : pid } : {};
      try {
        const d = await gql(name, vars);
        if (d) out[name] = d;
      } catch { /* one bad operation must not cost the other 29 */ }
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
  };

  console.log('%cLenus export ready.', 'font-weight:bold');
  console.log('Open a client page if you have not, then run:  lenusExport.start()');
})();
