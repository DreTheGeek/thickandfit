// Paste-into-the-page recorder for the Lenus coach app.
//
// WHY THIS EXISTS. The July 3 extract captured 27 GraphQL operations across 265 clients, but it
// saved only the operation NAME, the variables and the response. Not the query document. Without
// the document there is nothing to replay, so the sync cannot be re-run and the data has been
// frozen at 3 July ever since. The contract ends 31 August.
//
// So this records the recipe, not just the meal: for every GraphQL call the app makes, it keeps the
// operation name, the full query text, the variables, and the exact request headers (Lenus sends
// x-lenus-df-key and friends, which a plain cookie-authenticated fetch does not reproduce).
//
// HOW TO USE
//   1. Log in to us.lenus.io.
//   2. Paste this whole file into the console. It patches fetch and XHR and returns silently.
//   3. Walk the app: home, clients, one client's every tab, chat, leads, toolbox. Each page teaches
//      it another operation.
//   4. Run `copy(__lenusDump())` or read `__lenusDump()` to get the recipe book out.
//
// It records REQUESTS ONLY, never responses, so nothing here carries client data. The recipe book
// is a set of query templates plus auth headers, and the headers are the sensitive part: treat the
// dump as a credential and do not commit it.

(() => {
  if (window.__lenusRecording) {
    console.log('[lenus-record] already running,', Object.keys(window.__lenusRecipes).length, 'operations so far');
    return;
  }
  window.__lenusRecording = true;
  window.__lenusRecipes = {};
  window.__lenusHeaders = null;

  // Header names worth keeping. An allowlist rather than "everything": the full header set carries
  // per-request noise (content-length, trace ids) that would make two recordings of the same
  // operation look different, and replaying a stale trace id is meaningless.
  const KEEP = /^(authorization|x-lenus-|apollographql-|content-type|accept|x-app-|x-client-)/i;

  function noteHeaders(headers) {
    const out = {};
    if (!headers) return;
    const put = (k, v) => {
      if (KEEP.test(k)) out[k.toLowerCase()] = v;
    };
    if (headers instanceof Headers) headers.forEach((v, k) => put(k, v));
    else if (Array.isArray(headers)) headers.forEach(([k, v]) => put(k, v));
    else Object.entries(headers).forEach(([k, v]) => put(k, String(v)));
    // Last writer wins: the freshest request has the freshest token.
    if (Object.keys(out).length) window.__lenusHeaders = { ...(window.__lenusHeaders || {}), ...out };
  }

  function record(url, bodyText, headers) {
    if (!bodyText || typeof bodyText !== 'string') return;
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return;
    }
    // A GraphQL batch is an array; treat each entry as its own recipe.
    for (const op of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!op || typeof op !== 'object' || !op.query) continue;
      const name = op.operationName || (String(op.query).match(/(?:query|mutation)\s+(\w+)/) || [])[1] || 'anonymous';
      // Mutations are deliberately skipped. This is a read-only export of her own data; recording a
      // write recipe would make it possible to replay a change into a live account by accident.
      if (/^\s*mutation/.test(String(op.query).trim())) continue;
      const prev = window.__lenusRecipes[name];
      window.__lenusRecipes[name] = {
        operationName: name,
        url,
        query: op.query,
        // Keep the LAST variables seen, plus every distinct shape, so the replayer can see which
        // keys vary per client (profileId, cursor, limit) rather than guessing.
        variables: op.variables ?? {},
        seen: (prev?.seen ?? 0) + 1,
        variableKeys: [...new Set([...(prev?.variableKeys ?? []), ...Object.keys(op.variables ?? {})])],
      };
    }
    noteHeaders(headers);
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && /graphql/i.test(url)) {
        const body = init?.body ?? (typeof input === 'object' ? input?._bodyText : null);
        record(url, typeof body === 'string' ? body : null, init?.headers ?? (typeof input === 'object' ? input?.headers : null));
      }
    } catch {
      // Never let recording break the app: a thrown interceptor would log her out mid-walk.
    }
    return origFetch.apply(this, arguments);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__lenusUrl = url;
    this.__lenusHdrs = {};
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__lenusHdrs) this.__lenusHdrs[k] = v;
    return origSet.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__lenusUrl && /graphql/i.test(this.__lenusUrl)) {
        record(this.__lenusUrl, typeof body === 'string' ? body : null, this.__lenusHdrs);
      }
    } catch {
      /* see above */
    }
    return origSend.apply(this, arguments);
  };

  window.__lenusDump = () =>
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        endpointGuess: Object.values(window.__lenusRecipes)[0]?.url ?? null,
        headers: window.__lenusHeaders,
        operations: window.__lenusRecipes,
      },
      null,
      0,
    );

  window.__lenusStatus = () =>
    `${Object.keys(window.__lenusRecipes).length} operations, headers: ${
      window.__lenusHeaders ? Object.keys(window.__lenusHeaders).join(', ') : 'none yet'
    }`;

  console.log('[lenus-record] on. Walk the app, then run __lenusStatus() and __lenusDump().');
})();
