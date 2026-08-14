// Lenus capture driver. Paste into the DevTools console of a logged-in us.lenus.io tab.
//
// WHY THIS FILE EXISTS
// The driver that produced the 2026-08-12/13 sweep (every file in .capture/sweep/) lived only as
// pasted-console JS inside a Claude session transcript. scripts/lenus-export.js is the OLDER 2026-08-09
// driver and is NOT interchangeable with it: ChatList_Events and ChatConversationWeb are absent from its
// op list so it never fetches messages at all, and check-in bodies need one call per response id, which
// its flat one-call-per-client loop cannot express. Re-running the 09 Aug driver on 29 Aug would have
// produced a capture missing every message and 858 of 859 check-ins, and reported success.
//
// The account closes 2026-08-31. This file is the thing that has to work on that Saturday.
//
// NO CREDENTIALS LIVE HERE, ON PURPOSE
// Lenus authenticates with an httpOnly session cookie: JS cannot read it, and no Node process can
// present it. The x-lenus-df-key / x-lenus-coach-id / x-client-version headers are REQUIRED but do not
// authenticate. They are harvested from live traffic below rather than hardcoded, because a saved copy
// is a credential sitting on disk (which is exactly what .planning/lenus-recipes.json is, and why it is
// gitignored). x-client-version is pinned to a Lenus release SHA, so harvesting also survives them
// shipping a new build.
//
// HOW BYTES GET OUT
// Not fetch: Lenus sends default-src https://us.lenus.io plus a connect-src allowlist and
// upgrade-insecure-requests, so this tab cannot talk to localhost. Not downloads: the first anchor click
// lands, every one after is silently dropped by Chrome's multiple-download permission. So the payload is
// parked on window.name, the tab is navigated to the local collector by the EXTENSION (a browser-level
// navigation, which no page CSP governs), and the collector posts it back same-origin.
//   Terminal:  node scripts/lenus-sweep-receiver.mjs .capture/sweep 8877
//   Then:      __TF.park(__TF.out.threads)  ->  navigate to http://localhost:8877/?name=lenus-threads.json
//
// A NAVIGATION DESTROYS THIS DRIVER. Re-paste after every trip to the collector.
//
// FIVE PINNED VALUES THAT WERE WRONG IN THE RECIPE BOOK, FIXED HERE
//   1. ChatList_Events carried bundleTrackingEvents:true, which collapses individual activity logs into
//      opaque {id,createdAt,count} bundles. 3,865 bundles hid 16,274 rows: we captured 14% of her
//      clients' tracked activity and the importer recorded "not importable". It is a server-side
//      argument. It is false here.
//   2. ClientCheckinDashboardView_checkInResponse pinned responseId to one recorded sample, so every
//      client returned the same check-in. Bodies are fetched per id from the ids pass instead.
//   3. The food window was pinned to 2026-08-09..08-15, six days against a 405-day history.
//      Parameterised, and defaults to everything.
//   4. skipFullFoodDiaryDetails was true, which drops the whole ingredient/nutrient block behind a
//      GraphQL @skip. False here.
//   5. ClientWorkoutHistory recorded pageSize:3, the UI's own chunk size. Paginated properly here.
//
// USAGE
//   __TF.install()            harvest headers, then reload a client page once if it reports none
//   await __TF.roster()       full client list from Lenus, not from our DB
//   await __TF.messages()     threads + activity (the long one, roughly 2 h)
//   await __TF.checkins()     ids pass then bodies pass
//   await __TF.workouts()     paginated, all of them
//   await __TF.food()         full history with details
//   await __TF.goals()        per-client tracking goals
//   __TF.status()             progress of whatever is running
//   __TF.park(__TF.out.X)     stage a payload for the collector

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Harvest the required headers off real traffic instead of storing them. Any GraphQL request the app
  // makes carries them; we keep the first set we see.
  const REQUIRED = ['x-lenus-df-key', 'x-lenus-coach-id', 'x-lenus-product', 'x-client-version'];
  function installRecorder() {
    if (window.__TF_REC) return;
    window.__TF_REC = { headers: null, ops: {} };
    const orig = window.fetch;
    window.fetch = async function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/graphql/i.test(url) && init && init.headers) {
          const h = {};
          const src = init.headers;
          if (src instanceof Headers) src.forEach((v, k) => { h[k.toLowerCase()] = v; });
          else for (const k of Object.keys(src)) h[k.toLowerCase()] = src[k];
          if (!window.__TF_REC.headers && REQUIRED.every((k) => h[k])) {
            window.__TF_REC.headers = {
              accept: '*/*',
              'content-type': 'application/json',
              'x-lenus-product': h['x-lenus-product'],
              'x-lenus-coach-id': h['x-lenus-coach-id'],
              'x-client-version': h['x-client-version'],
              'x-lenus-df-key': h['x-lenus-df-key'],
            };
          }
          // Keep the live query documents too. If Lenus changes a schema, the embedded copies below go
          // stale silently, and this is the only warning you would get.
          if (init.body) {
            try {
              const b = JSON.parse(init.body);
              if (b && b.operationName) window.__TF_REC.ops[b.operationName] = { query: b.query, variables: b.variables };
            } catch (e) { /* not json, ignore */ }
          }
        }
      } catch (e) { /* never break the app */ }
      return orig.apply(this, arguments);
    };
  }

  const Q = {
    clientList: `query TFClientList($offset: Int, $limit: Int, $filter: ClientSegmentFilter!) {
  clientAudience(segmentFilter: $filter, offset: $offset, limit: $limit) {
    total
    clientList { id profile { id fullName email createdAt isActive locale } }
  }
}`,

    // bundleTrackingEvents:false is fix 1. With true, TrackingActivityLogBundle nodes come back as
    // {id,createdAt,count} and the underlying rows are unreachable.
    events: `query ChatList_Events($globalClientId: ID!, $after: String, $first: Int!) {
  node(id: $globalClientId) { ... on Client { id events(first: $first, after: $after, bundleTrackingEvents: false) {
    pageInfo { hasNextPage endCursor }
    edges { node { __typename
      ... on Message { id body isFromCoach createdAt createdByName readAt type archivedAt attachments { id name mimeType kind publicPath } }
      ... on TrackingActivityLog { id createdAt trackedAt trackingActivityType: type customActivityName comment rating distanceInMeters durationInSeconds energyInCalories }
      ... on TrackingActivityLogBundle { id createdAt count }
    } } } } }
}`,

    checkinIds: `query ClientInfoCheckinsContext_CheckInResponses($id: ID!) {
  profile(id: $id) {
    id
    checkInResponses { id submittedAt }
    checkInResponsesContainingProgressPictures { id submittedAt }
  }
}`,

    // Fix 2: responseId comes from the ids pass, one call per response.
    checkinBody: `query ClientCheckinDashboardView_checkInResponse($responseId: ID!, $profileId: ID!) {
  checkInResponse(id: $responseId) {
    id
    submittedAt
    blocks {
      formBlock { id type title }
      answers {
        firstAnswer { id value }
        latestAnswer { id value question { id metricType label type data { id type value coachFormQuestionId } } }
        previousAnswer { id value question { id metricType label } }
      }
    }
  }
  profile(id: $profileId) {
    id
    weightGoalOverall { id type targetInKilograms targetDate }
    settings { displayWeightMeasurement }
  }
}`,

    // comment is the 976 workout notes ("I subbed clam shells for the abductors"). It was always in the
    // response and the importer dropped it; keep requesting it.
    workouts: `query ClientWorkoutHistory($offset: Int!, $pageSize: Int!, $profileId: ID) {
  clientWorkoutHistory: clientWorkoutHistory(offset: $offset, pageSize: $pageSize, profileId: $profileId) {
    id completionPct enjoymentScore exhaustionScore startAt sessionName workoutPlanName isClientCreated fullCount comment __typename
  }
}`,

    // foodDiaryGoals carries the per-client macro TARGETS (242 clients, 100 of them on a bespoke split
    // that calories alone cannot regenerate). amountUnit is the portion unit for the 72% of entries that
    // are not gram-denominated. Both were captured before and dropped importer-side.
    food: `query UseFetchFoodDiaryOverview_FoodDiary($profileId: ID!, $from: Date!, $to: Date!, $skipFullFoodDiaryDetails: Boolean!) {
  profile(id: $profileId) {
    id
    foodDiaryGoals { kcal carbGrams proteinGrams fatGrams }
    foodDiary(from: $from, to: $to) {
      id kcal mealType name foodSource logDate amount amountUnit
      macros { carbohydrate fat protein }
    }
  }
}`,

    goals: `query TrackingGoalCoachQuery($profileId: ID!) {
  profile(id: $profileId) { id
    trackingGoalsCoach { id type target frequency displayUnit start createdAt updatedAt createdByClient } }
}`,
  };

  async function post(opName, query, variables, tries = 4) {
    const T = window.__TF;
    for (let i = 0; i < tries; i += 1) {
      try {
        const r = await fetch('/graphql?operationName=' + opName + '&platform=dashboard', {
          method: 'POST',
          credentials: 'include', // the session cookie is the auth; omit it and Lenus 400s
          headers: T.H,
          body: JSON.stringify({ operationName: opName, query, variables }),
        });
        if (r.status === 429 || r.status >= 500) { await sleep(500 * (i + 1) * (i + 1)); continue; }
        const j = await r.json();
        if (j.errors && !j.data) return { __error: JSON.stringify(j.errors).slice(0, 300) };
        return j.data;
      } catch (e) { await sleep(500 * (i + 1) * (i + 1)); }
    }
    return { __error: 'exhausted' };
  }

  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => {
      for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); }
    }));
    return out;
  }

  const T = {
    H: null,
    Q,
    out: {},
    progress: {},
    post,
    pool,
    sleep,

    install() {
      installRecorder();
      const rec = window.__TF_REC;
      if (rec.headers) { T.H = rec.headers; return 'headers harvested, ready'; }
      return 'recorder armed but no GraphQL seen yet. Navigate to any client page, then run __TF.install() again.';
    },

    // window.name is the only way out of this origin. Returns the byte count so you can sanity check it
    // against what the collector reports having saved.
    park(obj) { window.name = JSON.stringify(obj); return window.name.length; },

    status() { return JSON.parse(JSON.stringify(T.progress)); },

    async roster() {
      const all = [];
      for (let off = 0; off < 3000; off += 100) {
        const d = await post('TFClientList', Q.clientList, { offset: off, limit: 100, filter: { or: [{ and: [{ and: [] }, { and: [] }] }] } });
        if (d.__error) break;
        all.push(...d.clientAudience.clientList.map((c) => ({
          id: c.profile.id, fullName: c.profile.fullName, email: c.profile.email,
          createdAt: c.profile.createdAt, isActive: c.profile.isActive, locale: c.profile.locale,
        })));
        if (all.length >= d.clientAudience.total) break;
        await sleep(100);
      }
      T.out.clients = all;
      T.out.targets = all.map((c) => c.id);
      return 'roster ' + all.length;
    },

    // The long one. Concurrency 3 and a 50 ms page gap were tuned against Lenus's throttler: higher
    // concurrency starts returning 429s that the backoff then serialises anyway.
    async messages() {
      const targets = T.out.targets || [];
      T.progress.msgs = { done: 0, total: targets.length, errors: 0, items: 0 };
      T.out.threads = {};
      await pool(targets, 3, async (pid) => {
        const gid = btoa('Client:' + pid); // ChatList_Events keys on a base64 global id, not the raw uuid
        const items = [];
        let after = null;
        for (let page = 0; page < 500; page += 1) {
          const d = await post('ChatList_Events', Q.events, { globalClientId: gid, first: 100, after });
          if (d.__error || !d.node || !d.node.events) { T.progress.msgs.errors += 1; break; }
          const ev = d.node.events;
          for (const e of (ev.edges || [])) if (e.node) items.push(e.node);
          if (!ev.pageInfo.hasNextPage) break;
          after = ev.pageInfo.endCursor;
          await sleep(50);
        }
        T.out.threads[pid] = items;
        T.progress.msgs.items += items.length;
        T.progress.msgs.done += 1;
      });
      T.progress.msgs.finished = true;
      return 'threads ' + Object.keys(T.out.threads).length + ', items ' + T.progress.msgs.items;
    },

    // Two passes on purpose. The ids query returns only {id, submittedAt}; the body needs its own call
    // per response. A one-call-per-client loop returns 1 check-in, not 859.
    async checkins() {
      const targets = T.out.targets || [];
      T.progress.checkinIds = { done: 0, total: targets.length, errors: 0 };
      const flat = [];
      await pool(targets, 4, async (pid) => {
        const d = await post('ClientInfoCheckinsContext_CheckInResponses', Q.checkinIds, { id: pid });
        T.progress.checkinIds.done += 1;
        if (d.__error || !d.profile) { T.progress.checkinIds.errors += 1; return; }
        const photo = new Set((d.profile.checkInResponsesContainingProgressPictures || []).map((r) => r.id));
        for (const r of (d.profile.checkInResponses || [])) flat.push({ id: r.id, pid, hasPhotos: photo.has(r.id) });
      });
      T.out.checkinFlat = flat;

      T.progress.bodies = { done: 0, total: flat.length, errors: 0 };
      T.out.checkins = [];
      await pool(flat, 4, async (row) => {
        const d = await post('ClientCheckinDashboardView_checkInResponse', Q.checkinBody, { responseId: row.id, profileId: row.pid });
        T.progress.bodies.done += 1;
        if (d.__error || !d.checkInResponse) { T.progress.bodies.errors += 1; return; }
        T.out.checkins.push({
          profileId: row.pid,
          hasPhotos: row.hasPhotos,
          response: d.checkInResponse,
          weightGoal: (d.profile && d.profile.weightGoalOverall) || null,
          displayWeightMeasurement: (d.profile && d.profile.settings && d.profile.settings.displayWeightMeasurement) || null,
        });
      });
      T.progress.bodies.finished = true;
      return 'checkins ' + T.out.checkins.length + ' of ' + flat.length;
    },

    // Fix 5. fullCount is the server's own total for this client, so page until we have it. The recipe
    // book's pageSize:3 is the UI's chunk size and returns three workouts per client.
    async workouts() {
      const targets = T.out.targets || [];
      T.progress.workouts = { done: 0, total: targets.length, errors: 0, rows: 0 };
      T.out.workouts = {};
      await pool(targets, 4, async (pid) => {
        const rows = [];
        for (let off = 0; off < 5000; off += 100) {
          const d = await post('ClientWorkoutHistory', Q.workouts, { offset: off, pageSize: 100, profileId: pid });
          if (d.__error || !d.clientWorkoutHistory) { T.progress.workouts.errors += 1; break; }
          const page = d.clientWorkoutHistory;
          rows.push(...page);
          const full = page.length ? page[0].fullCount : 0;
          if (!page.length || rows.length >= full) break;
          await sleep(50);
        }
        T.out.workouts[pid] = rows;
        T.progress.workouts.rows += rows.length;
        T.progress.workouts.done += 1;
      });
      T.progress.workouts.finished = true;
      return 'workout rows ' + T.progress.workouts.rows;
    },

    // Fixes 3 and 4. Defaults span her whole Lenus history rather than the recorded six-day window, and
    // details are ON so ingredient identity and nutrients come back.
    async food(fromISO, toISO) {
      const from = Date.parse(fromISO || '2024-01-01T00:00:00Z');
      const to = Date.parse(toISO || new Date().toISOString().slice(0, 10) + 'T23:59:59Z');
      const targets = T.out.targets || [];
      T.progress.food = { done: 0, total: targets.length, errors: 0, entries: 0 };
      T.out.food = {};
      await pool(targets, 3, async (pid) => {
        const d = await post('UseFetchFoodDiaryOverview_FoodDiary', Q.food, {
          profileId: pid, from, to, skipFullFoodDiaryDetails: false,
        });
        T.progress.food.done += 1;
        if (d.__error || !d.profile) { T.progress.food.errors += 1; return; }
        T.out.food[pid] = { goals: d.profile.foodDiaryGoals || null, entries: d.profile.foodDiary || [] };
        T.progress.food.entries += (d.profile.foodDiary || []).length;
      });
      T.progress.food.finished = true;
      return 'food entries ' + T.progress.food.entries;
    },

    async goals() {
      const targets = T.out.targets || [];
      T.progress.goals = { done: 0, total: targets.length, errors: 0, goals: 0 };
      T.out.goals = {};
      await pool(targets, 4, async (pid) => {
        const d = await post('TrackingGoalCoachQuery', Q.goals, { profileId: pid });
        T.progress.goals.done += 1;
        if (d.__error || !d.profile) { T.progress.goals.errors += 1; return; }
        const g = d.profile.trackingGoalsCoach || [];
        T.out.goals[pid] = g;
        T.progress.goals.goals += g.length;
      });
      T.progress.goals.finished = true;
      return 'tracking goals ' + T.progress.goals.goals;
    },
  };

  window.__TF = T;
  installRecorder();
  return 'lenus-capture installed. Run __TF.install() to harvest headers, then __TF.roster().';
})();
