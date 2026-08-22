// Drive the invite screen against PRODUCTION and prove the whole chain, without emailing a real
// client. The one send goes to delivered@resend.dev, Resend's always-delivers test address.
//
//   node --env-file=.env.local .qa-visual/invite-desk-test.mjs
//
// IT SEEDS AND REMOVES ITS OWN INVITEE, and that is not a nicety.
//
// The first version assumed a "QA Invitee" contact somebody had created by hand during the session
// that wrote it. That contact was cleaned up at the end of the same session, so from the very next
// run the search found nothing, the Invite button never appeared, and the test died on a 30-second
// Playwright timeout. A launch-critical action - the one that emails 272 real women - had a checker
// that could never pass again, and it read as a broken product rather than a missing fixture.
//
// So the fixture is created here, from the same predicate `getInviteQueue` selects on, and removed
// afterwards whatever the result. Teardown also drops the `email_send_log` rows for the address:
// the screen reads that log to choose between "Invite" and "Invite again", so leaving them behind
// changes the button's label and breaks the next run in a second, less obvious way.
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { COACH } from './qa-accounts.mjs';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'https://www.teamthickandfit.com';
const { email: EMAIL, password: PASSWORD } = COACH;
const TEST_INVITEE = 'delivered@resend.dev';
const INVITEE_FIRST = 'QA';
const INVITEE_LAST = 'Invitee';
/** Stephanie's company. The invite queue is scoped to it, so the fixture has to live in it. */
const COMPANY_ID = 'c0ffee00-0000-4000-8000-000000000001';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('This test seeds its own invitee, so it needs NEXT_PUBLIC_SUPABASE_URL and');
  console.error('SUPABASE_SERVICE_ROLE_KEY. Run it as:');
  console.error('  node --env-file=.env.local .qa-visual/invite-desk-test.mjs');
  process.exit(1);
}
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/**
 * Remove any auth user minted for the disposable address by a previous run.
 *
 * generateLink({ type: 'invite' }) CREATES the user as a side effect of minting the link, so a run
 * that sends leaves one behind. listUsers has no email filter, hence the paging: perPage is the
 * only lever, and deleteUser needs the id.
 */
async function dropAuthUser() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === TEST_INVITEE);
    if (hit) {
      await svc.auth.admin.deleteUser(hit.id);
      return;
    }
    if (data.users.length < 1000) return;
  }
}

async function cleanupInvitee() {
  await dropAuthUser();
  await svc.from('email_send_log').delete().eq('to_email', TEST_INVITEE);
  await svc.from('contacts').delete().eq('email', TEST_INVITEE).eq('company_id', COMPANY_ID);
}

async function seedInvitee() {
  await cleanupInvitee();
  // The same shape getInviteQueue selects: a legacy CLIENT of this company, with an email and no
  // profile_id. Anything less and the row exists but never reaches the screen.
  const { error } = await svc.from('contacts').insert({
    company_id: COMPANY_ID,
    type: 'client',
    is_legacy: true,
    profile_id: null,
    email: TEST_INVITEE,
    first_name: INVITEE_FIRST,
    last_name: INVITEE_LAST,
    language: 'en',
    source: 'qa',
  });
  if (error) throw new Error(`could not seed the QA invitee: ${error.message}`);
}

const fails = [];
const ok = (label, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails.push(label); };

await seedInvitee();
console.log(`seeded ${INVITEE_FIRST} ${INVITEE_LAST} <${TEST_INVITEE}> as a waiting legacy client`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => fails.push('PAGEERROR: ' + String(e).slice(0, 160)));

await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 60_000 }).catch(() => {});
console.log(`signed in -> ${page.url()}\n`);

await page.goto(`${BASE}/coach/invites`, { waitUntil: 'networkidle', timeout: 60_000 });
const body = () => page.locator('body').innerText();

let text = await body();
ok('screen renders (no error boundary)', !/something went wrong/i.test(text));
ok('shows the three counters', /IN THE APP/i.test(text) && /INVITED/i.test(text) && /NOT ASKED YET/i.test(text));
ok('lists real clients waiting', /Invite/i.test(text));

// --- the batch guard: a wrong confirmation must send nothing --------------------------------
await page.getByRole('button', { name: /send a batch/i }).first().click();
await page.waitForTimeout(500);
const sendBatch = page.getByRole('button', { name: /send \d+ invites/i }).first();
ok('batch send is disabled until confirmed', await sendBatch.isDisabled());
await page.locator('input[placeholder="10"]').first().fill('99');
await page.waitForTimeout(300);
ok('batch send stays disabled on a WRONG number', await sendBatch.isDisabled());
await page.getByRole('button', { name: /send a batch/i }).first().click(); // close it again
await page.waitForTimeout(400);

// --- the real one: invite the disposable contact ---------------------------------------------
await page.locator('input[placeholder*="name or email" i]').first().fill('QA Invitee');
await page.waitForTimeout(600);
text = await body();
ok('search finds the test invitee', text.includes(TEST_INVITEE));

page.once('dialog', (d) => {
  console.log(`  confirm said: "${d.message().split('\n')[0]}"`);
  d.accept();
});
await page.getByRole('button', { name: /^invite$/i }).first().click();
await page.waitForTimeout(6000);
text = await body();
ok('reports the send', /invite sent to/i.test(text));

await page.screenshot({ path: '.qa-visual/invite_desk.png', fullPage: true });
console.log('\nshot -> .qa-visual/invite_desk.png');

await browser.close();
// Unconditionally, including after a failed assertion: a fixture left behind puts a fake client at
// the top of her real invite queue, and the next run inherits the wrong button label.
await cleanupInvitee();
console.log('cleaned up the QA invitee');

if (fails.length) { console.error(`\nFAIL (${fails.length})`); for (const f of fails) console.error('  - ' + f); }
else console.log('\ninvite-desk: PASS');
process.exit(fails.length ? 1 : 0);
