// Shared Supabase Management API query helper for the import scripts.
//
// Extracted after the sweep import died 10,502 statements into a 13,338-statement run. The gateway
// returned an HTML error page, the caller did JSON.parse on it, and the process exited with
// `SyntaxError: Unexpected token '<'`. Two lessons, both encoded here:
//
//   1. A NON-JSON RESPONSE IS A TRANSIENT GATEWAY ERROR, NOT A QUERY ERROR. It means the request
//      never reached Postgres. Retrying is correct; crashing loses the rest of the run.
//   2. Long imports must survive one bad minute. A 20-minute job that has to be babysat is a job
//      that will not get re-run on 30 August when it matters.
//
// Errors that ARE the query's fault (a real Postgres error comes back as JSON with a `message`)
// still throw immediately. Retrying a syntax error just wastes six minutes before failing anyway.

import { execFileSync } from 'node:child_process';

const SLEEP = (ms) => execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`]);

export function makeSql({ tries = 5, maxBuffer = 128 * 1024 * 1024 } = {}) {
  return function sql(query) {
    let lastNonJson = null;
    for (let i = 0; i < tries; i += 1) {
      let out;
      try {
        out = execFileSync('node', ['.qa-visual/sql.cjs', query], { encoding: 'utf8', maxBuffer });
      } catch (e) {
        // The child itself failed (network, spawn). Same treatment: back off and try again.
        lastNonJson = String(e.message || e).slice(0, 200);
        SLEEP(1000 * (i + 1) * (i + 1));
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(out);
      } catch {
        lastNonJson = out.slice(0, 120).replace(/\s+/g, ' ');
        SLEEP(1000 * (i + 1) * (i + 1));
        continue;
      }
      if (parsed && parsed.message) throw new Error(parsed.message);
      return parsed;
    }
    throw new Error(`Management API did not return JSON after ${tries} tries. Last: ${lastNonJson}`);
  };
}

/**
 * Batch independent statements into as few API calls as possible.
 *
 * By CHARACTER budget, never by statement count: one call per statement rate-limits the API at
 * roughly 800, and a 120-statement batch blew the OS argument limit (ENAMETOOLONG) because the
 * query travels as an argv entry. ~6 KB clears both.
 */
export function runBatched(sql, label, statements, { maxChars = 6000, pauseMs = 120, onProgress } = {}) {
  let done = 0;
  let buf = [];
  let bufLen = 0;
  const flush = () => {
    if (!buf.length) return;
    sql(buf.join('\n'));
    done += buf.length;
    if (onProgress) onProgress(done, statements.length);
    buf = [];
    bufLen = 0;
  };
  for (const st of statements) {
    if (bufLen + st.length > maxChars) {
      flush();
      SLEEP(pauseMs);
    }
    buf.push(st);
    bufLen += st.length;
  }
  flush();
  console.log(`${label}: applied ${done}/${statements.length}`);
  return done;
}
