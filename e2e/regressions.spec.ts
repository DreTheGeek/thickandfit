// Regression specs for the 2026-07-18 bug-bash classes. Each spec pins a cross-surface product
// flow that page-level scanning cannot see, so these bugs cannot silently return:
//   1. signup captures a name and lands the member in the Clients CRM (+ GHL id link)
//   2. re-signup with an already-confirmed email says so instead of dead-ending at "check your email"
//   3. a member reply reaches the coach-side archive and notifies the coach team
//   4. a coach message notifies the member (bell row)
//   5. pre-Stripe, billing shows the plan + no-charges note, never a dead subscribe CTA
//
// Environment (set in CI secrets / .env.e2e):
//   E2E_BASE_URL              target app (defaults to http://127.0.0.1:3000)
//   SUPABASE_URL              project url (for REST asserts + cleanup)
//   E2E_SUPABASE_ADMIN_KEY admin key for asserts + cleanup (map from your platform secret in CI; never shipped to the app)
//   E2E_MEMBER_EMAIL/PASSWORD confirmed member test account (sample.sam)
//   E2E_COACH_EMAIL/PASSWORD  coach test account (sample.casey)
//   E2E_STRIPE_LIVE=1         set once real billing is armed; skips the pre-launch billing spec
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const SB = process.env.SUPABASE_URL ?? '';
const SVC = process.env.E2E_SUPABASE_ADMIN_KEY ?? '';
const MEMBER = process.env.E2E_MEMBER_EMAIL ?? 'sample.sam@thickandfit.test';
const MEMBER_PW = process.env.E2E_MEMBER_PASSWORD ?? '';
const COACH = process.env.E2E_COACH_EMAIL ?? 'sample.casey@thickandfit.test';
const COACH_PW = process.env.E2E_COACH_PASSWORD ?? '';

const REST = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const dbReady = Boolean(SB && SVC);

async function restGet(path: string): Promise<unknown[]> {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: REST });
  return (await r.json()) as unknown[];
}
async function restDelete(path: string): Promise<void> {
  await fetch(`${SB}/rest/v1/${path}`, { method: 'DELETE', headers: REST });
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30_000 });
}

test.describe('signup pipeline', () => {
  const email = `e2e.regression+${Date.now()}@thickandfit.test`;

  test.afterAll(async () => {
    if (!dbReady) return;
    // Admin cleanup: auth user (cascades profile), CRM contact, consent rows.
    const profs = (await restGet(`profiles?email=eq.${encodeURIComponent(email)}&select=id`)) as { id: string }[];
    await restDelete(`contacts?email=eq.${encodeURIComponent(email)}`);
    if (profs[0]) {
      await fetch(`${SB}/auth/v1/admin/users/${profs[0].id}`, { method: 'DELETE', headers: REST });
    }
  });

  test('signup asks for a name and creates the CRM contact at signup', async ({ page }) => {
    test.skip(!dbReady, 'needs SUPABASE_URL + service key for DB asserts');
    await page.goto(`${BASE}/auth/sign-up`);
    await page.fill('input[name=firstName]', 'Regression');
    await page.fill('input[name=lastName]', 'Spec');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'E2eRegression1!');
    await page.click('button[type=submit]');
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 20_000 });

    // The member must exist in the coach's world without onboarding: profile named + contact linked.
    await expect
      .poll(
        async () => {
          const rows = (await restGet(
            `contacts?email=eq.${encodeURIComponent(email)}&select=type,first_name,profile_id`,
          )) as { type: string; first_name: string | null; profile_id: string | null }[];
          return rows[0] ? `${rows[0].type}:${rows[0].first_name}:${Boolean(rows[0].profile_id)}` : 'missing';
        },
        { timeout: 20_000 },
      )
      .toBe('client:Regression:true');
  });

  test('re-signup with a confirmed email explains instead of dead-ending', async ({ page }) => {
    test.skip(!MEMBER_PW, 'needs a confirmed member account');
    await page.goto(`${BASE}/auth/sign-up`);
    await page.fill('input[name=firstName]', 'Already');
    await page.fill('input[name=lastName]', 'Registered');
    await page.fill('input[name=email]', MEMBER); // confirmed account
    await page.fill('input[name=password]', 'SomeNewPassword1!');
    await page.click('button[type=submit]');
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/check your email/i)).toHaveCount(0);
  });
});

test.describe('two-sided messaging', () => {
  const mark = `e2e regression msg ${Date.now()}`;

  test.afterAll(async () => {
    if (!dbReady) return;
    await restDelete(`messages?body=like.${encodeURIComponent(mark + '%')}`);
    await restDelete(`client_messages?body=like.${encodeURIComponent(mark + '%')}`);
    await restDelete(`notifications?type=eq.coach_message&created_at=gte.${new Date(Date.now() - 15 * 60_000).toISOString()}`);
  });

  test('member reply reaches the coach archive and notifies the coach team', async ({ page }) => {
    test.skip(!dbReady || !MEMBER_PW, 'needs member creds + DB asserts');
    await signIn(page, MEMBER, MEMBER_PW);
    await page.goto(`${BASE}/inbox`);
    const composer = page.locator('input[placeholder]').last();
    await composer.fill(`${mark} member`);
    await composer.press('Enter');
    await expect(page.getByText(`${mark} member`)).toBeVisible({ timeout: 15_000 });

    // Archive row (what /coach/clients + /coach/inbox read) and at least one coach notification.
    await expect
      .poll(
        async () =>
          ((await restGet(
            `client_messages?body=eq.${encodeURIComponent(`${mark} member`)}&select=is_from_coach`,
          )) as { is_from_coach: boolean }[])[0]?.is_from_coach,
        { timeout: 20_000 },
      )
      .toBe(false);
    await expect
      .poll(
        async () =>
          ((await restGet(
            `notifications?type=eq.coach_message&link=eq.${encodeURIComponent('/coach/inbox')}&select=id&limit=1&order=created_at.desc`,
          )) as unknown[]).length,
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
  });

  test('coach send notifies the member', async ({ page }) => {
    test.skip(!dbReady || !COACH_PW, 'needs coach creds + DB asserts');
    await signIn(page, COACH, COACH_PW);
    // Open the member thread through the picker-free deep link: first thread is fine, we assert by
    // the unique body, not the thread identity.
    await page.goto(`${BASE}/coach/inbox`);
    const composer = page.locator('main input[placeholder]').last();
    await composer.fill(`${mark} coach`);
    await composer.press('Enter');
    await expect(page.getByText(`${mark} coach`)).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(
        async () =>
          ((await restGet(
            `notifications?type=eq.coach_message&link=eq.${encodeURIComponent('/inbox')}&select=id&limit=1&order=created_at.desc`,
          )) as unknown[]).length,
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
  });
});

test.describe('billing pre-launch honesty', () => {
  test('no dead subscribe CTA while billing is not live', async ({ page }) => {
    test.skip(Boolean(process.env.E2E_STRIPE_LIVE), 'billing is live; pre-launch state no longer applies');
    test.skip(!MEMBER_PW, 'needs a member account');
    await signIn(page, MEMBER, MEMBER_PW);
    await page.goto(`${BASE}/account/billing`);
    await expect(page.getByText(/billing hasn't started yet/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/start subscription/i)).toHaveCount(0);
  });
});
