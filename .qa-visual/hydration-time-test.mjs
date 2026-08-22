// Fail the build when a client component renders an INSTANT without suppressHydrationWarning.
//
// THE CLASS. Text formatted from a timestamp with no explicit `timeZone` renders in whatever zone
// the runtime is in. Vercel is UTC and the member's browser is not, so the server HTML and the
// hydrated DOM carry different text, React calls that a failed hydration, throws #418, and
// re-renders the whole route on the client. Nothing about it is statically wrong, so tsc, eslint and
// `next build` are all green, and it does not reproduce on `next dev` either.
//
// It has cost this repo four times, and the fourth is why this file exists:
//
//   /inbox                    member message timestamps           (fixed, message-thread.tsx)
//   /coach/inbox              conversation timestamps             (fixed, coach-conversation.tsx)
//   /coach/clients            the Joined column                   (fixed, clients-table.tsx)
//   /coach/clients/[id]       the chat rail's group stamp         (fixed, client-chat-rail.tsx)
//
// The last one was found only after a production sweep, and only after a first fix landed on the
// WRONG file: client-detail-tabs.tsx renders the same data below xl, was guarded, and is not what a
// coach on a laptop sees. A grep would have found both in one pass. So: grep, in CI.
//
//   node .qa-visual/hydration-time-test.mjs
//
// WHAT IS SAFE AND WHY. `new Date(`${value}T00:00:00`)` parses a DATE-ONLY string as LOCAL midnight,
// so it formats to the same calendar day in every zone. That pattern is all over the coach console
// and is deliberately not flagged. What is flagged is `new Date(value)` on a real timestamp, then
// formatted with an hour or a minute, and anything measuring against "now".
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.tsx')) files.push(p.split(path.sep).join('/'));
  }
})(ROOT);

/** Options that put a CLOCK on screen. A date without one cannot drift by a timezone offset. */
const HAS_TIME = /\b(hour|minute|second)\s*:|timeStyle|toLocaleTimeString/;
/** Measuring against the moment of render, which differs between server and browser by definition. */
const RELATIVE_NOW = /Date\.now\(\)|new Date\(\s*\)/;
/** The safe shape: a date-only string forced to local midnight. */
const DATE_ONLY = /T00:00:00/;

const findings = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/^\s*['"]use client['"]/m.test(src)) continue; // server output ships in the RSC payload; it does not re-render

  // Local helpers in this file that produce a drifting string.
  const risky = new Set();
  const fnRe = /(?:function\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{|const\s+([A-Za-z0-9_]+)\s*=\s*\([^)]*\)(?::[^=]+)?\s*=>\s*)/g;
  let m;
  while ((m = fnRe.exec(src))) {
    const name = m[1] ?? m[2];
    if (!name) continue;
    const body = src.slice(m.index, m.index + 500);
    const formatsTime = HAS_TIME.test(body);
    const usesNow = RELATIVE_NOW.test(body);
    const dateOnly = DATE_ONLY.test(body);
    if ((formatsTime && !dateOnly) || usesNow) risky.add(name);
  }
  if (risky.size === 0 && !HAS_TIME.test(src)) continue;

  const lines = src.split('\n');
  const callRe = risky.size ? new RegExp(`\\{\\s*(?:${[...risky].join('|')})\\s*\\(`) : null;

  lines.forEach((line, i) => {
    const rendersRisky = callRe ? callRe.test(line) : false;
    // An inline formatter inside a JSX expression, e.g. {new Intl.DateTimeFormat(...).format(d)}
    const rendersInline = /\{[^}]*(?:toLocaleTimeString|toLocaleString|Intl\.DateTimeFormat)/.test(line) && HAS_TIME.test(line) && !DATE_ONLY.test(line);
    if (!rendersRisky && !rendersInline) return;

    // Guarded on this line, or on the opening tag up to 4 lines above (attributes wrap).
    const window = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
    if (/suppressHydrationWarning/.test(window)) return;
    findings.push(`${file}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}

if (findings.length) {
  console.error(`FAIL: ${findings.length} client render(s) of an instant without suppressHydrationWarning`);
  for (const f of findings) console.error('  - ' + f);
  console.error('');
  console.error('Each one is a React #418 waiting for a member in a non-UTC timezone.');
  console.error('Fix: wrap the value in <span suppressHydrationWarning>, the way message-thread.tsx does,');
  console.error('or format it from a DATE-ONLY string with the `${value}T00:00:00` pattern.');
  process.exit(1);
}
console.log(`OK: ${files.length} components checked, no unguarded instant reaches hydration`);
