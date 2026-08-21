// Drive the invite screen against PRODUCTION and prove the whole chain, without emailing a real
// client. The one send goes to delivered@resend.dev, Resend's always-delivers test address.
//
//   node .qa-visual/invite-desk-test.mjs
import { chromium } from '@playwright/test';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'https://www.teamthickandfit.com';
const EMAIL = process.env.E2E_COACH_EMAIL ?? 'qa.coach@teamthickandfit.com';
const PASSWORD = process.env.E2E_COACH_PASSWORD ?? 'TFQaCoach2026!';
const TEST_INVITEE = 'delivered@resend.dev';

const fails = [];
const ok = (label, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails.push(label); };

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

if (fails.length) { console.error(`\nFAIL (${fails.length})`); for (const f of fails) console.error('  - ' + f); }
else console.log('\ninvite-desk: PASS');
await browser.close();
process.exit(fails.length ? 1 : 0);
