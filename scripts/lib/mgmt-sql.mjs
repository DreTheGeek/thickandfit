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
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SLEEP = (ms) => execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`]);

/**
 * Windows caps a command line near 32 KB, and the query travels as an argv entry.
 *
 * One meal plan's JSON reaches 39 KB on its own, so no batching budget can keep it inline: the
 * spawn fails with ENAMETOOLONG before Postgres ever sees it. sql.cjs already accepts --file= for
 * this; anything past the threshold goes via a temp file.
 */
const INLINE_LIMIT = 24_000;
const TMP_DIR = '.capture/.sqltmp';
let tmpSeq = 0;

export function makeSql({ tries = 5, maxBuffer = 128 * 1024 * 1024 } = {}) {
  return function sql(query) {
    let lastNonJson = null;
    for (let i = 0; i < tries; i += 1) {
      let out;
      let tmpPath = null;
      try {
        let args;
        if (query.length > INLINE_LIMIT) {
          mkdirSync(TMP_DIR, { recursive: true });
          tmpPath = join(TMP_DIR, `q${process.pid}-${tmpSeq++}.sql`);
          writeFileSync(tmpPath, query, 'utf8');
          args = ['.qa-visual/sql.cjs', `--file=${tmpPath}`];
        } else {
          args = ['.qa-visual/sql.cjs', query];
        }
        out = execFileSync('node', args, { encoding: 'utf8', maxBuffer });
      } catch (e) {
        if (tmpPath) rmSync(tmpPath, { force: true });
        // The child itself failed (network, spawn). Same treatment: back off and try again.
        lastNonJson = String(e.message || e).slice(0, 200);
        SLEEP(1000 * (i + 1) * (i + 1));
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(out);
      } catch {
        if (tmpPath) rmSync(tmpPath, { force: true });
        lastNonJson = out.slice(0, 120).replace(/\s+/g, ' ');
        SLEEP(1000 * (i + 1) * (i + 1));
        continue;
      }
      if (tmpPath) rmSync(tmpPath, { force: true });
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
