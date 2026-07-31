// Smart-scan eval CLI. Calls the secret-gated internal route and renders the comparison table.
// Usage:  pnpm eval:scan                       (against http://localhost:3000, default eval)
//         pnpm eval:scan -- --base https://<prod-url> --eval smart-scan-golden-v1
// Env:    CRON_SECRET (required; loaded via node --env-file=.env.local in the pnpm script)
//         EVAL_BASE_URL (optional default for --base)
// Zero dependencies. Run after any model or prompt change; eval scans cost real OpenRouter spend.

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', process.env.EVAL_BASE_URL || 'http://localhost:3000');
const EVAL_NAME = arg('eval', undefined);
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error('CRON_SECRET is not set (expected via --env-file=.env.local)');
  process.exit(1);
}

function pct(n) {
  return n == null ? 'n/a' : `${Math.round(n * 100)}%`;
}
function delta(cur, prev, invert = false) {
  if (prev == null || cur == null) return '';
  const d = cur - prev;
  if (d === 0) return ' (=)';
  const good = invert ? d < 0 : d > 0;
  return ` (${d > 0 ? '+' : ''}${Math.round(d * 1000) / 1000}${good ? ' better' : ' worse'})`;
}

const res = await fetch(`${BASE}/api/internal/run-scan-eval`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(EVAL_NAME ? { evalName: EVAL_NAME } : {}),
});
const json = await res.json().catch(() => null);
if (!json) {
  console.error(`HTTP ${res.status}: unreadable response`);
  process.exit(1);
}
if (json.status !== 'ok') {
  console.error(`Eval did not run: ${JSON.stringify(json)}`);
  console.error(json.status === 'noCases' ? '\nSeed cases first: pnpm eval:seed -- --dir <folder-with-manifest>' : '');
  process.exit(1);
}

console.log('\nPer-case results:');
console.table(
  json.perCase.map((c) => ({
    case: c.caseId.slice(0, 8),
    pass: c.passed ? 'PASS' : 'FAIL',
    score: c.score,
    f1: c.f1,
    'mape%': c.mape == null ? 'n/a' : Math.round(c.mape * 100),
    'ms': c.latencyMs,
    note: c.note,
  })),
);

const cur = json.current;
const prev = json.previous;
console.log('\n=== CURRENT RUN ===');
console.log(`run       ${cur.runId}`);
console.log(`model     ${cur.model}  prompt ${cur.promptVersion}`);
console.log(`pass rate ${cur.passed}/${cur.cases} (${pct(cur.passed / Math.max(1, cur.cases))})${prev ? delta(cur.passed / cur.cases, prev.passed / Math.max(1, prev.cases)) : ''}`);
console.log(`avg score ${cur.avgScore}${prev ? delta(cur.avgScore, prev.avgScore) : ''}`);
console.log(`avg F1    ${cur.avgF1}${prev ? delta(cur.avgF1, prev.avgF1) : ''}`);
console.log(`avg MAPE  ${pct(cur.avgMape)}${prev ? delta(cur.avgMape, prev.avgMape, true) : ''}`);
console.log(`avg ms    ${cur.avgLatencyMs}${prev ? delta(cur.avgLatencyMs, prev.avgLatencyMs, true) : ''}`);
// Signed fat error (PRD-D). NEGATIVE = UNDERestimating, which is the NIH/NIDDK finding: every
// tested competitor misses ~30g/meal of invisible fat (oil, butter, dressing). Reported only; it is
// deliberately not a pass bar until a baseline exists.
const fatG = (v) => (v === null || v === undefined ? 'n/a (no fat labels)' : `${v > 0 ? '+' : ''}${v}g`);
console.log(`fat bias  ${fatG(cur.meanFatBiasG)}   (oil plates ${fatG(cur.meanFatBiasOilG)})`);
if (prev) {
  console.log(`\n(previous run ${prev.runId.slice(0, 8)}: model ${prev.model}, prompt ${prev.promptVersion}, ${prev.passed}/${prev.cases} passed)`);
} else {
  console.log('\n(no previous run to compare; this run is the baseline)');
}
