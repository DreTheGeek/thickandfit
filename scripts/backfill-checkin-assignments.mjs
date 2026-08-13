// Give every existing member the weekly check-in that new members now get at onboarding.
//
// WHY. src/lib/checkins/assign-default.ts assigns the check-in when a member finishes onboarding,
// which fixes everyone from now on. It does nothing for the people already here, and they are most
// of the business. Until this runs, the "Start Check-in" button on their Today screen opens
// "No check-ins assigned yet."
//
// MIRRORS src/lib/checkins/assign-default.ts, including the oldest-published tie-break when a
// company has more than one check-in form. If that rule changes there, change it here.
//
// IDEMPOTENT. form_assignments is UNIQUE(form_id, profile_id) (0005), so the insert skips anyone who
// already has it and nobody's assigned_at gets moved.
//
// Run: node scripts/backfill-checkin-assignments.mjs [--apply]
// Without --apply it reports what it WOULD do and writes nothing.

import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};

console.log(APPLY ? 'APPLY: writing.\n' : 'DRY RUN: nothing is written. Add --apply once the numbers look right.\n');

// Oldest published check-in, the same choice assign-default.ts makes and for the same reason: the
// established form is the one a member should get, and a newly published one is as likely to be a
// one-off as a new standard.
const forms = sql(`
  select id, title_en, created_at
  from forms
  where company_id = '${COMPANY}' and type = 'check_in' and status = 'published'
  order by created_at asc
`);

if (!forms.length) {
  console.log('No published check-in form for this company. Nothing to assign.');
  process.exit(0);
}
if (forms.length > 1) {
  console.log(`${forms.length} published check-in forms. Using the oldest:`);
  for (const f of forms) console.log(`  ${f.created_at.slice(0, 10)}  ${f.title_en ?? f.id}${f.id === forms[0].id ? '   <- this one' : ''}`);
  console.log('');
}
const form = forms[0];
console.log(`Form: ${form.title_en ?? form.id}  (${form.id})`);

// Members, not staff. A coach or operator has no use for a check-in assigned to themselves, and
// they would then show up in every "assigned" count for the rest of time.
const missing = sql(`
  select p.id, p.full_name, p.email
  from profiles p
  where p.company_id = '${COMPANY}'
    and p.role in ('subscriber', 'free')
    and not exists (
      select 1 from form_assignments a
      where a.form_id = '${form.id}' and a.profile_id = p.id
    )
  order by p.created_at asc
`);

console.log(`\nmembers without this check-in: ${missing.length}`);
if (!missing.length) {
  console.log('Everyone already has it. Nothing to do.');
  process.exit(0);
}
for (const m of missing.slice(0, 8)) console.log(`  ${m.full_name ?? m.email ?? m.id}`);
if (missing.length > 8) console.log(`  ... and ${missing.length - 8} more`);

if (!APPLY) {
  console.log('\nRe-run with --apply to assign.');
  process.exit(0);
}

// One statement rather than N. The select drives the insert, so it stays correct if a member is
// created between the count above and this write.
const res = sql(`
  insert into form_assignments (company_id, form_id, profile_id)
  select '${COMPANY}', '${form.id}', p.id
  from profiles p
  where p.company_id = '${COMPANY}'
    and p.role in ('subscriber', 'free')
  on conflict (form_id, profile_id) do nothing
  returning profile_id
`);

console.log(`\nassigned: ${Array.isArray(res) ? res.length : 0}`);
console.log('Re-run this script to confirm it reports 0 remaining.');
