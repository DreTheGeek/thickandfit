// Walk a real workout on PRODUCTION and report whether the set actually reaches the server.
//
// The owner completed a workout and nothing landed: workout_logs, set_logs and
// workout_completion_history were all empty, and api_request_log showed no POST to
// /api/workouts/log at all. So the request never left the browser. This drives the real UI and
// watches the network and the console, because that is the only place the answer can be.
//
//   node .qa-visual/workout-log-repro.mjs
import { chromium } from '@playwright/test';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'https://www.teamthickandfit.com';
const EMAIL = process.env.E2E_MEMBER_EMAIL ?? 'qa.member@teamthickandfit.com';
const PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? 'TFQaMember2026!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const posts = [];
const errors = [];
page.on('request', (r) => {
  if (r.method() === 'POST') posts.push(`-> POST ${r.url().replace(BASE, '')}`);
});
page.on('response', async (r) => {
  if (r.request().method() === 'POST' && r.url().includes('/api/')) {
    posts.push(`<- ${r.status()} ${r.url().replace(BASE, '')}`);
  }
});
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 60_000 }).catch(() => {});
if (page.url().includes('sign-in')) {
  console.error(`FAILED to sign in as ${EMAIL}`);
  process.exit(1);
}
console.log('signed in ->', page.url());

await page.goto(`${BASE}/workouts`, { waitUntil: 'networkidle', timeout: 60_000 });

// The health acknowledgement gate stands in front of every training surface for a member who has
// not accepted it. A real member clears it once; the harness has to as well or it never sees a
// workout at all.
const ack = page.getByRole('button', { name: /understand and accept|entiendo/i }).first();
if (await ack.count()) {
  await ack.click();
  await page.waitForTimeout(2500);
  console.log('accepted the health gate');
  await page.goto(`${BASE}/workouts`, { waitUntil: 'networkidle', timeout: 60_000 });
}

const startBtn = page.getByRole('link', { name: /start workout|empezar/i }).first();
if (!(await startBtn.count())) {
  console.error('no "Start workout" control on /workouts');
  console.log(await page.locator('body').innerText());
  process.exit(1);
}
await startBtn.click();
await page.waitForURL(/\/workout\//, { timeout: 60_000 });
await page.waitForTimeout(3000);
console.log('player ->', page.url());

// Log a handful of sets, exactly as she would.
for (let i = 0; i < 4; i++) {
  const btn = page.getByRole('button', { name: /log set|mark complete|done|finish/i }).first();
  if (!(await btn.count())) {
    console.log(`no log control at step ${i}; screen says:`);
    console.log((await page.locator('body').innerText()).slice(0, 500));
    break;
  }
  const label = (await btn.innerText()).trim();
  await btn.click();
  console.log(`tapped "${label}" (${i + 1})`);
  await page.waitForTimeout(1200);
  // A rest overlay swallows the next tap; skip it the way she would.
  const skip = page.getByRole('button', { name: /skip/i }).first();
  if (await skip.count()) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

console.log('\n--- POSTs seen so far ---');
console.log(posts.length ? posts.join('\n') : '(NONE - nothing was sent to the server)');

// Now leave the way a member leaves: the OS/browser back gesture.
await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
console.log('\nafter back ->', page.url());

console.log('\n--- ALL POSTs ---');
console.log(posts.length ? posts.join('\n') : '(NONE)');
console.log('\n--- console errors ---');
console.log(errors.length ? errors.slice(0, 8).join('\n') : '(none)');

await browser.close();
