// Recover Stephanie's workout programs out of Lenus before the account closes on 31 August.
//
// WHY THIS IS URGENT AND WHY IT IS DIFFERENT FROM THE JULY EXTRACT.
//
// The July run captured 27 GraphQL operations for all 265 clients, 7,134 rows, and I searched every
// one of them for "sets", "reps" and exerciseId. Zero hits. ClientWorkoutHistory records only what
// she DID at session level (sessionName, workoutPlanName, completion, enjoyment) and
// WorkoutSection_ProfileData records preferences. The CONTENTS of her programs were never fetched,
// because nobody walked the training-plan builder while the recorder was running. She authored 159
// distinct plans; this app has one demo.
//
// So this cannot replay a known operation the way the exercise-library pull did. It has to DISCOVER
// the operation first, which is the whole design below: record everything, look at the shape of the
// responses, and recognise a plan by the fact that it contains exercises with sets and reps.
//
// HOW TO USE, about five minutes:
//   1. Log in to us.lenus.io as Stephanie.
//   2. Open DevTools, Console, paste this whole file, press Enter. It goes quiet and starts watching.
//   3. Navigate to the training plans: Toolbox (or Library) -> Training plans -> OPEN ONE PLAN so
//      the exercises are on screen. That single act teaches it the operation.
//   4. It will say "LEARNED" in the console and then pull the rest by itself.
//   5. When it says DONE, run:  copy(__tfPlans())   and paste into a file.
//
// If step 3 never prints LEARNED, open a plan's individual DAY too; some builders load the day
// separately from the plan. Run __tfSeen() at any point to list what it has recorded, which is what
// to send me if it does not find them.
//
// PRIVACY. This records the plan library, which is her intellectual property and the thing we are
// migrating. It also keeps the auth headers in memory to replay with; those never leave the tab and
// are not included in __tfPlans(). Treat any dump as confidential and do not commit it.

(() => {
  if (window.__tfCapturing) {
    console.log('%c[tf] already running. __tfSeen() to inspect, __tfPlans() to dump.', 'color:#5EBE62');
    return;
  }
  window.__tfCapturing = true;

  const ops = new Map(); // operationName -> { query, variables, sampleShape }
  const plans = new Map(); // id -> payload
  let headers = null;
  let endpoint = null;
  let learned = null; // the operation that returns plan contents

  const KEEP = /^(authorization|x-lenus-|apollographql-|content-type|accept|x-app-|x-client-)/i;
  const log = (msg, color = '#888') => console.log(`%c[tf] ${msg}`, `color:${color}`);

  function noteHeaders(h) {
    if (!h) return;
    const out = {};
    const put = (k, v) => KEEP.test(k) && (out[k.toLowerCase()] = String(v));
    if (h instanceof Headers) h.forEach((v, k) => put(k, v));
    else if (Array.isArray(h)) h.forEach(([k, v]) => put(k, v));
    else Object.entries(h).forEach(([k, v]) => put(k, v));
    if (Object.keys(out).length) headers = { ...(headers || {}), ...out };
  }

  // A plan is recognised by SHAPE, not by name, because the operation name is exactly the thing we
  // do not know. Anything carrying an array whose members have both a sets-ish and a reps-ish key,
  // or an explicit exercise reference, is the payload worth having.
  function looksLikeProgram(node, depth = 0) {
    if (!node || depth > 8) return false;
    if (Array.isArray(node)) return node.some((n) => looksLikeProgram(n, depth + 1));
    if (typeof node !== 'object') return false;
    const keys = Object.keys(node).map((k) => k.toLowerCase());
    const hasSets = keys.some((k) => /^sets?$/.test(k) || k === 'setcount' || k === 'numsets');
    const hasReps = keys.some((k) => /^reps?$/.test(k) || k === 'repetitions' || k === 'repcount');
    const hasEx = keys.some((k) => k === 'exercise' || k === 'exerciseid' || k === 'exercises');
    if ((hasSets && hasReps) || (hasEx && (hasSets || hasReps))) return true;
    return Object.values(node).some((v) => looksLikeProgram(v, depth + 1));
  }

  function record(url, bodyText, hdrs, responseJson) {
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return;
    }
    for (const op of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!op || !op.query) continue;
      const name =
        op.operationName || (String(op.query).match(/(?:query|mutation)\s+(\w+)/) || [])[1] || 'anonymous';
      if (!ops.has(name)) ops.set(name, { query: op.query, variables: op.variables, hits: 0, program: false });
      const entry = ops.get(name);
      entry.hits += 1;
      entry.variables = op.variables ?? entry.variables;
      endpoint = endpoint || url;
      noteHeaders(hdrs);

      if (responseJson && looksLikeProgram(responseJson)) {
        entry.program = true;
        if (!learned) {
          learned = name;
          log(`LEARNED: "${name}" returns program contents. Pulling the rest now.`, '#5EBE62');
          setTimeout(() => void sweep(), 400);
        }
        // Keep every program payload we see, keyed on whatever id the variables carried.
        const key = JSON.stringify(op.variables ?? {}) || String(plans.size);
        plans.set(key, { operation: name, variables: op.variables ?? null, data: responseJson });
      }
    }
  }

  async function call(query, variables) {
    const res = await window.__tfFetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: JSON.stringify({ query, variables, operationName: (String(query).match(/(?:query|mutation)\s+(\w+)/) || [])[1] }),
    });
    return res.json();
  }

  // Once the plan operation is known, the ids come from anywhere we have already seen them: the
  // recorded variables, and any list response that mentioned a plan.
  function harvestIds() {
    const ids = new Set();
    const walk = (n, d = 0) => {
      if (!n || d > 8) return;
      if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
      if (typeof n !== 'object') return;
      const t = String(n.__typename || '');
      if (/plan|program|workout/i.test(t) && typeof n.id === 'string') ids.add(n.id);
      Object.values(n).forEach((v) => walk(v, d + 1));
    };
    for (const p of plans.values()) walk(p.data);
    for (const o of ops.values()) walk(o.variables);
    return [...ids];
  }

  async function sweep() {
    const entry = ops.get(learned);
    if (!entry) return;
    const ids = harvestIds();
    log(`sweeping ${ids.length} candidate plan ids...`);
    let ok = 0;
    for (const id of ids) {
      // Try the learned operation with each id substituted into whichever variable held an id.
      const vars = { ...(entry.variables || {}) };
      for (const k of Object.keys(vars)) if (/id$/i.test(k)) vars[k] = id;
      if (!Object.keys(vars).some((k) => /id$/i.test(k))) vars.id = id;
      try {
        const json = await call(entry.query, vars);
        if (json && looksLikeProgram(json)) {
          plans.set(id, { operation: learned, variables: vars, data: json.data ?? json });
          ok += 1;
        }
      } catch (e) {
        console.warn('[tf] sweep failed for', id, e);
      }
      await new Promise((r) => setTimeout(r, 250)); // be a polite client
    }
    log(`DONE. ${ok} programs captured, ${plans.size} payloads total. Run: copy(__tfPlans())`, '#5EBE62');
  }

  // --- patch the wire ---------------------------------------------------------
  window.__tfFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const res = await window.__tfFetch(input, init);
    try {
      if (url && /graphql/i.test(url) && init?.body) {
        // Clone so the app still gets its body.
        const json = await res.clone().json();
        record(url, String(init.body), init.headers, json);
      }
    } catch {
      /* never break the app we are observing */
    }
    return res;
  };

  const OpenX = XMLHttpRequest.prototype.open;
  const SendX = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    this.__tfUrl = u;
    return OpenX.call(this, m, u, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__tfUrl && /graphql/i.test(this.__tfUrl) && body) {
      this.addEventListener('load', () => {
        try {
          record(this.__tfUrl, String(body), null, JSON.parse(this.responseText));
        } catch {
          /* ignore */
        }
      });
    }
    return SendX.call(this, body);
  };

  window.__tfSeen = () =>
    [...ops.entries()].map(([name, o]) => ({ name, hits: o.hits, program: o.program }));
  window.__tfPlans = () =>
    JSON.stringify({ capturedAt: new Date().toISOString(), operation: learned, count: plans.size, plans: [...plans.values()] }, null, 1);
  window.__tfSweep = () => void sweep();

  log('watching. Now open Toolbox -> Training plans -> open ONE plan.', '#5EBE62');
})();
