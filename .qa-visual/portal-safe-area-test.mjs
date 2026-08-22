// The strip below the app shell must be the SAME COLOUR as the bottom nav, in both themes.
//
// WHY THIS FILE EXISTS. The member portal's shell is exactly 100dvh and `viewport-fit=cover` opens a
// band below it for the iPhone home indicator. Nothing inside the shell can paint there (the shell is
// overflow-hidden and the band is outside it), so `body` paints it, and if body's colour does not
// match the bar the bar appears to float above a gutter.
//
// It was black under a #121214 bar, which read as a seam. The fix used `var(--c-surface)` on body and
// made it WHITE on a black screen, which is a far worse version of the same fault, and it shipped.
// The cause is one line of CSS inheritance: `body` is the ANCESTOR of `.tf-portal`, custom properties
// inherit downward, so a token the portal re-points is NOT re-pointed on body. var(--c-surface) there
// resolves against :root, the light marketing palette.
//
// So this does not read the stylesheet or trust a literal. It renders the real portal in a real
// browser and compares two COMPUTED colours: the nav's and the body's. A future palette change that
// moves one and not the other fails here.
//
//   node --env-file=.env.local .qa-visual/portal-safe-area-test.mjs
//   node --env-file=.env.local .qa-visual/portal-safe-area-test.mjs http://127.0.0.1:3000
import { chromium } from '@playwright/test';
import { MEMBER, BASE_URL, signIn } from './qa-accounts.mjs';

const BASE = process.argv.find((a) => a.startsWith('http')) ?? BASE_URL;

/**
 * Resolve ANY CSS colour to RGBA, in the browser, by painting it.
 *
 * Not a regex over the computed string. Tailwind v4 emits `oklab(...)` for a colour carrying an
 * alpha modifier, and the first version of this test scraped digits out of it and compared oklab
 * components against sRGB ones. It happened to fail on the real bug, which is the most dangerous way
 * for a measurement to be wrong: right answer, wrong reason, and no signal when it drifts. A canvas
 * resolves every notation the platform supports and returns the bytes actually painted.
 */
const RESOLVE = `(value) => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}`;

/**
 * Perceptual-enough distance. Not zero-tolerance: the bar is `bg-surface/95` over the shell with a
 * backdrop blur, so its COMPUTED colour carries the alpha while body's is flat. What matters is that
 * a member cannot see the join, and 95% of #121214 over #000000 is #111113 against #121214.
 */
function distance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}
const TOLERANCE = 12;

const browser = await chromium.launch();
const failures = [];

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' });
  const page = await ctx.newPage();
  await signIn(page, MEMBER, BASE);
  // The theme lives on <html data-portal-theme>, written from her profile. Setting the cookie the
  // toggle sets is how to exercise both without mutating her row.
  await ctx.addCookies([{ name: 'portal_theme', value: theme, url: BASE }]);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1200);

  const measured = await page.evaluate((resolveSrc) => {
    const resolve = eval(resolveSrc);
    const nav = document.querySelector('nav[aria-label]');
    const shell = document.querySelector('.tf-portal');
    const navRaw = nav ? getComputedStyle(nav).backgroundColor : null;
    const shellRaw = shell ? getComputedStyle(shell).backgroundColor : null;
    const navPx = navRaw ? resolve(navRaw) : null;
    const shellPx = shellRaw ? resolve(shellRaw) : [0, 0, 0, 1];
    // The bar is bg-surface/95 over the shell, so what a member SEES is the composite. Comparing the
    // bar's raw colour against body's would let a 5% difference count as a mismatch, or hide one.
    const navSeen = navPx
      ? [0, 1, 2].map((i) => Math.round(navPx[i] * navPx[3] + shellPx[i] * (1 - navPx[3])))
      : null;
    return {
      theme: document.documentElement.getAttribute('data-portal-theme'),
      navRaw,
      navSeen,
      bodyRaw: getComputedStyle(document.body).backgroundColor,
      bodySeen: resolve(getComputedStyle(document.body).backgroundColor).slice(0, 3),
    };
  }, RESOLVE);

  const d = measured.navSeen && measured.bodySeen ? distance(measured.navSeen, measured.bodySeen) : null;
  const ok = d != null && d <= TOLERANCE;

  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  portal_theme=${theme} (rendered ${measured.theme})`);
  console.log(`          bar  rgb(${measured.navSeen?.join(', ')})   from ${measured.navRaw}`);
  console.log(`          strip rgb(${measured.bodySeen?.join(', ')})   from ${measured.bodyRaw}${d != null ? `   distance ${d}` : ''}`);

  if (!measured.navSeen) failures.push(`${theme}: no bottom nav found, so nothing was compared`);
  else if (!ok) {
    failures.push(
      `${theme}: the strip below the shell is rgb(${measured.bodySeen.join(', ')}) while the bar is` +
        ` rgb(${measured.navSeen.join(', ')}) (distance ${d}).` +
        ' A member sees that as the bar floating above a gutter.',
    );
  }
  await ctx.close();
}

await browser.close();

if (failures.length) {
  console.error(`\nFAIL (${failures.length})`);
  for (const f of failures) console.error('  - ' + f);
  console.error('\nRemember body is the ANCESTOR of .tf-portal: var(--c-surface) there resolves');
  console.error('against :root, not against the portal palette. Use the literal for each theme.');
  process.exit(1);
}
console.log('\nportal safe area: PASS, the strip below the shell matches the bar in both themes');
