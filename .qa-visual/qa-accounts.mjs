// The one place the QA sign-ins live.
//
// WHY THIS FILE EXISTS. Every browser-driving tool in .qa-visual carried its own copy of the test
// credentials as a default. The accounts were then rotated - `sample.sam` / `sample.casey` /
// `sample.faye` at `@thickandfit.test` were deleted and replaced by `qa.member` / `qa.coach` at
// `@teamthickandfit.com` - and only the tools written AFTER the rotation were updated.
//
// The two written before it kept their old defaults and have been failing at the sign-in step ever
// since, which is the worst possible way for a checker to break:
//
//   - `portal-shots.mjs`, which CLAUDE.md names as THE verification for the member portal ("run it
//     after any portal change", "it exits non-zero, so it is a test, not a gallery"), stopped at
//     "FAILED to sign in" and never reached a screen. Behind it, /progress had been rendering a
//     weight chart with NaN coordinates - a blank card and twelve console errors on the default tab
//     of a screen every new member opens.
//   - `e2e/regressions.spec.ts` pins five cross-surface flows that page scanning cannot see. Its
//     passwords defaulted to the empty string, so a run without CI secrets fails at the login form
//     rather than reporting that it has no credentials.
//
// A checker that cannot log in reports a red that looks like a broken app and is really a broken
// checker, so people stop reading it. That is how the bug above survived three portal releases.
//
// Env vars still win, so CI keeps its secrets and nothing here needs to be a real password in a
// public repo. These are deliberately committed: they belong to disposable accounts on a
// pre-launch project, exactly as `TFSample2026!` was before them.
//
// WHEN THE ACCOUNTS ROTATE AGAIN, change them HERE and nowhere else. Then run
// `node .qa-visual/qa-accounts-check.mjs`, which signs both of them in against production and
// tells you which one is wrong instead of leaving you to read it out of a Playwright timeout.

/** A member on the paid tier, used for every /dashboard, /workouts, /nutrition, /progress sweep. */
export const MEMBER = {
  email: process.env.E2E_MEMBER_EMAIL ?? 'qa.member@teamthickandfit.com',
  password: process.env.E2E_MEMBER_PASSWORD ?? 'TFQaMember2026!',
};

/** A coach in Stephanie's company, same role and company_id as hers, so the console is identical. */
export const COACH = {
  email: process.env.E2E_COACH_EMAIL ?? 'qa.coach@teamthickandfit.com',
  password: process.env.E2E_COACH_PASSWORD ?? 'TFQaCoach2026!',
};

export const BASE_URL = process.env.E2E_BASE_URL ?? 'https://www.teamthickandfit.com';

/**
 * Sign in through the real form and land wherever the app sends this role.
 *
 * Throws rather than returning a flag: every caller's next line assumes an authenticated session,
 * and a silent false turns "the credentials are stale" into "every screen is broken".
 */
export async function signIn(page, { email, password }, base = BASE_URL) {
  await page.goto(`${base}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await page
    .waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 60_000 })
    .catch(() => {});
  if (page.url().includes('sign-in')) {
    const said = await page
      .locator('[role=alert], .text-danger, form')
      .first()
      .innerText()
      .catch(() => '');
    throw new Error(
      `could not sign in as ${email} (still at ${page.url()}).\n` +
        `The form said: ${said.replace(/\s+/g, ' ').trim().slice(0, 200)}\n` +
        `If the QA accounts were rotated, update .qa-visual/qa-accounts.mjs - not this tool.`,
    );
  }
  return page.url();
}

// The self-check that proves these two still sign in lives in `qa-accounts-check.mjs`, NOT here.
//
// It has to be a separate file. Playwright transpiles an imported .mjs into CommonJS for
// `e2e/regressions.spec.ts`, and `import.meta` - the only way a module can tell it was run
// directly - is a syntax error once transpiled. Every spec in that suite fails to LOAD, which is a
// worse red than the one this file was written to remove.
