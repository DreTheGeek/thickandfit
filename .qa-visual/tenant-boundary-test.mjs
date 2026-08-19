// Static audit of the tenant boundary across every RLS policy in the schema.
//
// This is the test that found the hole, generalised so it cannot come back. It reads every
// migration in order, resolves each policy to its FINAL definition (later migrations drop and
// recreate), and asserts that no policy grants on public.is_coach() without also constraining the
// company.
//
// Why static rather than against the database: the rule is a property of the SQL, the SQL is in the
// repo, and a test that needs credentials is a test nobody runs. It also catches the next one — a
// new table shipping a copy-pasted `using (public.is_coach() or profile_id = auth.uid())` fails
// here, in the diff, instead of a year later when a second tenant exists.
//
// Run: node .qa-visual/tenant-boundary-test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';

// webhook_events (0025) is the Stripe idempotency ledger and has no company_id column to scope by.
// 0142 narrows it to operators instead of inventing a tenant column on an ops ledger. Listed here
// with its reason so the exemption is a decision on the record, not a silent gap in the audit.
const EXEMPT = new Map([
  ['public.webhook_events|webhook_events_operator_read', 'no company_id column; narrowed to is_operator() in 0142'],
]);

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const final = new Map(); // "table|policy" -> { file, body }

for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  const re = /create policy\s+(\w+)\s+on\s+(public\.\w+)([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    final.set(`${m[2]}|${m[1]}`, { file: f, body: m[0] });
  }
  // A dropped-and-not-recreated policy must leave the map, or the audit judges a policy that is
  // no longer there. Order matters: this runs after the creates in the SAME file, so a
  // drop-then-create pair inside one migration still lands on the create.
  const dre = /drop policy if exists\s+(\w+)\s+on\s+(public\.\w+)/gi;
  let d;
  while ((d = dre.exec(sql)) !== null) {
    const key = `${d[2]}|${d[1]}`;
    const created = new RegExp(`create policy\\s+${d[1]}\\s+on\\s+${d[2].replace('.', '\\.')}`, 'i').test(sql);
    if (!created) final.delete(key);
  }
}

const offenders = [];
let coachPolicies = 0;
for (const [key, { file, body }] of final) {
  const flat = body.replace(/\s+/g, ' ');
  if (!/public\.is_coach\(\)/.test(flat)) continue;
  coachPolicies += 1;
  if (EXEMPT.has(key)) continue;
  if (!/company_id/.test(flat)) offenders.push({ key, file, flat });
}

// Guard against the audit silently passing because the regex stopped matching anything.
if (final.size < 50) {
  console.error(`only ${final.size} policies parsed — the parser is broken, not the schema`);
  process.exit(1);
}
if (coachPolicies < 15) {
  console.error(`only ${coachPolicies} is_coach() policies found — expected ~21; parser drift`);
  process.exit(1);
}

if (offenders.length > 0) {
  console.error(`\n${offenders.length} policy/policies grant on is_coach() with no company_id predicate:\n`);
  for (const o of offenders) {
    console.error(`  ✗ ${o.key}  (${o.file})`);
    console.error(`      ${o.flat.slice(0, 160)}\n`);
  }
  console.error('Every policy here is PERMISSIVE, so adding a scoped policy beside a broad one does');
  console.error('not narrow it — the broad one has to be replaced. See 0142_tenant_boundary.sql.\n');
  process.exit(1);
}

console.log(`✓ ${final.size} policies parsed, ${coachPolicies} grant on is_coach(), all tenant-scoped`);
for (const [key, why] of EXEMPT) console.log(`  (exempt) ${key} — ${why}`);
